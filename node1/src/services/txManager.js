const { getPool, currentNodeId } = require('../db');
const { queueReplicationForRow, runAutoReplicationBatch } = require('./replication');
const { isNodeOnline } = require('../state/nodeStatus');

const ISOLATION_LEVELS = [
  'READ UNCOMMITTED',
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE'
];

//in-memory map of active transactions: txId -> metadata
const txStore = new Map();

//timeout
const TX_IDLE_TIMEOUT_MS = parseInt(
  process.env.TX_IDLE_TIMEOUT_MS || '5000', //default is 5 seconds
  10
);
const TX_SWEEP_INTERVAL_MS = parseInt(
  process.env.TX_SWEEP_INTERVAL_MS || '500', //sweep every 0.5 seconds
  10
);

let txCleanupTimer = null;

function normalizeIsolationLevel(level) {
  if (!level) return null;
  const upper = String(level).trim().toUpperCase();
  if (ISOLATION_LEVELS.includes(upper)) {
    return upper;
  }
  return null;
}

function generateTxId() {
  return `tx-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function abortTxBecauseNodeOffline(tx) {
  if (!tx || tx.status !== 'active' || !tx.connection) {
    return;
  }

  try {
    await tx.connection.rollback();
  } catch (rollbackErr) {
    console.error(
      `[TX] Failed to rollback transaction ${tx.txId} after node ${tx.nodeId} went offline:`,
      rollbackErr
    );
  }

  try {
    tx.connection.release();
  } catch (releaseErr) {
    console.error(
      `[TX] Failed to release connection for transaction ${tx.txId} after node ${tx.nodeId} went offline:`,
      releaseErr
    );
  }

  tx.status = 'rolledback';
  tx.finishedAt = new Date();
  tx.connection = null;
  txStore.delete(tx.txId);
}

async function requireTx(txId) {
  const tx = txStore.get(txId);
  if (!tx) {
    throw new Error(`Transaction ${txId} not found or already finished`);
  }
  if (tx.status !== 'active') {
    throw new Error(`Transaction ${txId} is not active (status: ${tx.status})`);
  }

  //if node is offline, immediately roll back to simulate crash.
  if (!(await isNodeOnline(tx.nodeId))) {
    await abortTxBecauseNodeOffline(tx);
    throw new Error(
      `Node ${tx.nodeId} is offline in this simulation; transaction ${txId} was rolled back`
    );
  }

  //track last activity for idle-timeout
  tx.lastActivityAt = new Date();
  return tx;
}

//to implement to fix "lock wait timeout exceeded"
  // try {
  //    UPDATE (row lock)
  // } catch (error) {
  //    try {
  //       ROLLBACK
  //       release pool
  //    } catch {
  //       
  //    }
  // }

//to keep updateTrans/deleteTrans clean
async function failAndCleanupTx(tx, context, originalError) {
  try {
    //1. ROLLBACK
    await tx.connection.rollback();
  } catch (rollbackErr) {
    console.error(
      `[TX] Failed to rollback transaction ${tx.txId} after error in ${context}:`,
      rollbackErr
    );
  }

  try {
    //2. RELEASE POOL
    tx.connection.release();
  } catch (releaseErr) {
    console.error(
      `[TX] Failed to release connection for transaction ${tx.txId} after error in ${context}:`,
      releaseErr
    );
  }

  tx.status = 'rolledback';
  tx.finishedAt = new Date();
  tx.connection = null; // avoid accidental reuse

  txStore.delete(tx.txId);

  throw originalError;
}

//start new transaction on given node with a specified isolation level
async function startTransaction({ nodeId, isolationLevel, description }) {
  const node = parseInt(nodeId || currentNodeId, 10);
  if (![1, 2, 3].includes(node)) {
    throw new Error('nodeId must be 1, 2, or 3');
  }

  if (!(await isNodeOnline(node))) {
    throw new Error(
      `Node ${node} is offline in this simulation; cannot start a new transaction on it`
    );
  }

  const iso = normalizeIsolationLevel(isolationLevel);
  if (!iso) {
    throw new Error(
      `Invalid isolationLevel. Expected one of: ${ISOLATION_LEVELS.join(', ')}`
    );
  }

  const pool = getPool(node);
  const conn = await pool.getConnection();

  try {
    //configure isolation level and start transaction
    await conn.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${iso}`);
    await conn.beginTransaction();

    const txId = generateTxId();
    const now = new Date();
    const tx = {
      txId,
      nodeId: node,
      isolationLevel: iso,
      description: description || null,
      status: 'active',
      startedAt: now,
      lastActivityAt: now,
      operations: [],
      connection: conn
    };

    txStore.set(txId, tx);

    console.log(
      `[TX] Started transaction ${txId} on node ${node} (${iso})`
    );

    return {
      txId,
      nodeId: node,
      isolationLevel: iso,
      description: tx.description,
      startedAt: tx.startedAt
    };
  } catch (err) {
    conn.release();
    throw err;
  }
}

//read a specific trans row inside a transaction
async function readTrans({ txId, transId }) {
  const tx = await requireTx(txId);
  const id = parseInt(transId, 10);

  const [rows] = await tx.connection.query(
    `SELECT * FROM trans WHERE trans_id = ?`,
    [id]
  );

  const row = rows[0] || null;

  tx.operations.push({
    type: 'READ',
    transId: id,
    at: new Date(),
    rowSnapshot: row
  });

  return { row, nodeId: tx.nodeId, isolationLevel: tx.isolationLevel };
}

//INSERT a new row inside its own short transaction
async function insertTrans({ nodeId, accountId, newdate, type, amount, balance }) {
  const node = parseInt(nodeId || currentNodeId, 10);
  if (![1, 2, 3].includes(node)) {
    throw new Error('nodeId must be 1, 2, or 3');
  }

  if (!(await isNodeOnline(node))) {
    throw new Error(
      `Node ${node} is offline in this simulation; cannot insert on it`
    );
  }

  const normalizedType = String(type || '').trim();

  //additional validation: enforce fragmentation rules on fragment nodes
  if (node === 2 && normalizedType !== 'Credit') {
    throw new Error(
      'Node 2 is the "Credit" fragment. You may only insert rows with type = "Credit" on this node.'
    );
  }
  if (
    node === 3 &&
    normalizedType !== 'Debit (Withdrawal)' &&
    normalizedType !== 'VYBER'
  ) {
    throw new Error(
      'Node 3 is the "Debit/VYBER" fragment. You may only insert rows with type = "Debit (Withdrawal)" or "VYBER" on this node.'
    );
  }

  const pool = getPool(node);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    //insert the row
    //ASSUME trans_id is AUTO_INCREMENT
    const [result] = await conn.query(
      `
      INSERT INTO trans
        (account_id, newdate, type, amount, balance, last_updated_by_node, version)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      `,
      [accountId, newdate, type, amount, balance, node]
    );

    const transId = result.insertId;

    // Queue replication for this new row
    await queueReplicationForRow(conn, {
      sourceNodeId: node,
      transId,
      type,
      opType: 'INSERT',
      amountBefore: null,
      balanceBefore: null,
      amountAfter: amount,
      balanceAfter: balance
    });

    await conn.commit();

    // Immediately trigger replication
    try {
      await runAutoReplicationBatch();
    } catch (err) {
      console.error(
        `[TX] Failed to run replication after INSERT trans_id=${transId}:`,
        err.message
      );
    }

    return {
      nodeId: node,
      transId,
      accountId,
      newdate,
      type,
      amount,
      balance
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error('[TX] Failed to rollback INSERT transaction:', rollbackErr);
    }
    throw err;
  } finally {
    conn.release();
  }
}

//1. UPDATE a row inside a transaction
//2. queue replication log entries for the change
async function updateTrans(params) {
  const { txId, transId, amountDelta, balanceDelta } = params;
  const tx = await requireTx(txId);
  const id = parseInt(transId, 10);
  const deltaAmount = Number(amountDelta || 0);
  const deltaBalance = Number(balanceDelta || 0);

  try {
    //read current state 
    //    then lock row for this transaction
    const [rows] = await tx.connection.query(
      `SELECT * FROM trans WHERE trans_id = ? FOR UPDATE`,
      [id]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`trans_id ${id} not found on node ${tx.nodeId}`);
    }

    const current = rows[0];
    const amountBefore = current.amount;
    const balanceBefore = current.balance;
    const amountAfter = amountBefore + deltaAmount;
    const balanceAfter = balanceBefore + deltaBalance;

    await tx.connection.query(
      `
      UPDATE trans
      SET amount = ?, balance = ?, last_updated_by_node = ?, version = version + 1
      WHERE trans_id = ?
      `,
      [amountAfter, balanceAfter, tx.nodeId, id]
    );

  //queue replication log entries
    await queueReplicationForRow(tx.connection, {
      sourceNodeId: tx.nodeId,
      transId: id,
      type: current.type,
      opType: 'UPDATE',
      amountBefore,
      balanceBefore,
      amountAfter,
      balanceAfter
    });

    const op = {
      type: 'UPDATE',
      transId: id,
      at: new Date(),
      amountBefore,
      balanceBefore,
      amountAfter,
      balanceAfter
    };

    tx.operations.push(op);

    return {
      nodeId: tx.nodeId,
      isolationLevel: tx.isolationLevel,
      op
    };
  } catch (err) {
    //1. rollback
    //2. release lock
    //3. mark transaction as finished
    return failAndCleanupTx(tx, 'UPDATE', err);
  }
}

//DELETE row inside a transaction
async function deleteTrans({ txId, transId }) {
  const tx = await requireTx(txId);
  const id = parseInt(transId, 10);

  try {
    //read current state --> logging and replication
    const [rows] = await tx.connection.query(
      `SELECT * FROM trans WHERE trans_id = ? FOR UPDATE`,
      [id]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`trans_id ${id} not found on node ${tx.nodeId}`);
    }

    const current = rows[0];

    await tx.connection.query(
      `DELETE FROM trans WHERE trans_id = ?`,
      [id]
    );

    await queueReplicationForRow(tx.connection, {
      sourceNodeId: tx.nodeId,
      transId: id,
      type: current.type,
      opType: 'DELETE',
      amountBefore: current.amount,
      balanceBefore: current.balance,
      amountAfter: null,
      balanceAfter: null
    });

    const op = {
      type: 'DELETE',
      transId: id,
      at: new Date(),
      amountBefore: current.amount,
      balanceBefore: current.balance
    };

    tx.operations.push(op);

    return {
      nodeId: tx.nodeId,
      isolationLevel: tx.isolationLevel,
      op
    };
  } catch (err) {
    // Auto-cleanup: rollback + release + mark tx finished
    return failAndCleanupTx(tx, 'DELETE', err);
  }
}

//COMMIT transaction
async function commitTransaction({ txId }) {
  const tx = await requireTx(txId);

  try {
    await tx.connection.commit();
  } catch (err) {
    //best-effort rollback if commit fails
    try {
      await tx.connection.rollback();
    } catch (rollbackErr) {
      console.error(
        `[TX] Failed to rollback after commit failure for ${tx.txId}:`,
        rollbackErr
      );
    }
    try {
      tx.connection.release();
    } catch (releaseErr) {
      console.error(
        `[TX] Failed to release connection after commit failure for ${tx.txId}:`,
        releaseErr
      );
    }

    tx.status = 'rolledback';
    tx.finishedAt = new Date();
    tx.connection = null;
    txStore.delete(tx.txId);

    throw err;
  }

  tx.connection.release();

  tx.status = 'committed';
  tx.finishedAt = new Date();
  tx.connection = null;
  txStore.delete(tx.txId);

  console.log(
    `[TX] Committed transaction ${tx.txId} on node ${tx.nodeId}`
  );

  //immediately try to replicate after successful commit
  try {
    await runAutoReplicationBatch();
    console.log(
      `[TX] Triggered replication batch after commit of ${tx.txId}`
    );
  } catch (err) {
    console.error(
      `[TX] Failed to run replication after commit of ${tx.txId}:`,
      err.message
    );
  }

  return {
    txId: tx.txId,
    nodeId: tx.nodeId,
    isolationLevel: tx.isolationLevel,
    status: tx.status,
    finishedAt: tx.finishedAt
  };
}

//ROLLBACK transaction
async function rollbackTransaction({ txId }) {
  const tx = await requireTx(txId);

  try {
    await tx.connection.rollback();
  } finally {
    try {
      tx.connection.release();
    } catch (releaseErr) {
      console.error(
        `[TX] Failed to release connection for transaction ${tx.txId} during rollback:`,
        releaseErr
      );
    }
  }

  tx.status = 'rolledback';
  tx.finishedAt = new Date();
  tx.connection = null;
  txStore.delete(tx.txId);

  console.log(
    `[TX] Rolled back transaction ${tx.txId} on node ${tx.nodeId}`
  );

  return {
    txId: tx.txId,
    nodeId: tx.nodeId,
    isolationLevel: tx.isolationLevel,
    status: tx.status,
    finishedAt: tx.finishedAt
  };
}

async function sweepExpiredTransactions() {
  if (TX_IDLE_TIMEOUT_MS <= 0) {
    // timeout disabled
    return;
  }

  const nowMs = Date.now();

  for (const tx of txStore.values()) {
    if (tx.status !== 'active') continue;

    const last = tx.lastActivityAt || tx.startedAt || new Date(0);
    const lastMs = last.getTime();
    const idleMs = nowMs - lastMs;

    if (idleMs >= TX_IDLE_TIMEOUT_MS) {
      console.log(
        `[TX] Auto-rollback of idle transaction ${tx.txId} on node ${tx.nodeId} after ${Math.round(
          idleMs / 1000
        )}s idle`
      );

      try {
        if (tx.connection) {
          try {
            await tx.connection.rollback();
          } catch (rollbackErr) {
            console.error(
              `[TX] Failed auto-rollback for idle transaction ${tx.txId}:`,
              rollbackErr
            );
          }

          try {
            tx.connection.release();
          } catch (releaseErr) {
            console.error(
              `[TX] Failed to release connection for idle transaction ${tx.txId}:`,
              releaseErr
            );
          }
        }
      } finally {
        tx.status = 'timeout_rolledback';
        tx.finishedAt = new Date();
        tx.connection = null;
      }
    }
  }
}

function startTxCleanupWorker() {
  if (TX_IDLE_TIMEOUT_MS <= 0) {
    console.log(
      '[TX] Idle transaction timeout disabled (TX_IDLE_TIMEOUT_MS <= 0)'
    );
    return;
  }

  if (txCleanupTimer) {
    // already running
    return;
  }

  txCleanupTimer = setInterval(() => {
    sweepExpiredTransactions().catch((err) => {
      console.error('[TX] Error in idle-transaction cleanup worker:', err);
    });
  }, TX_SWEEP_INTERVAL_MS);

  console.log(
    `[TX] Idle transaction cleanup worker started (timeout=${TX_IDLE_TIMEOUT_MS}ms, sweep=${TX_SWEEP_INTERVAL_MS}ms)`
  );
}


//DEBUGGING: find all active/finished transactions
function listTransactions() {
  return Array.from(txStore.values()).map((tx) => ({
    txId: tx.txId,
    nodeId: tx.nodeId,
    isolationLevel: tx.isolationLevel,
    description: tx.description,
    status: tx.status,
    startedAt: tx.startedAt,
    finishedAt: tx.finishedAt || null,
    operationCount: tx.operations.length
  }));
}

module.exports = {
  ISOLATION_LEVELS,
  startTransaction,
  insertTrans,
  readTrans,
  updateTrans,
  deleteTrans,
  commitTransaction,
  rollbackTransaction,
  listTransactions,
  startTxCleanupWorker
};
