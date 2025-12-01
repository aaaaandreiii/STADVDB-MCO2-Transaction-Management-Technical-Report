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

function requireTx(txId) {
  const tx = txStore.get(txId);
  if (!tx) {
    throw new Error(`Transaction ${txId} not found or already finished`);
  }
  if (tx.status !== 'active') {
    throw new Error(`Transaction ${txId} is not active (status: ${tx.status})`);
  }
  //integrate node failure into normal operations:
  //    if a node is marked offline, existing transactions on that node cannot proceed.
  if (!isNodeOnline(tx.nodeId)) {
    throw new Error(
      `Node ${tx.nodeId} is offline in this simulation; transaction ${txId} cannot proceed`
    );
  }
  return tx;
}

//start new transaction on given node with a specified isolation level
async function startTransaction({ nodeId, isolationLevel, description }) {
  const node = parseInt(nodeId || currentNodeId, 10);
  if (![1, 2, 3].includes(node)) {
    throw new Error('nodeId must be 1, 2, or 3');
  }

  if (!isNodeOnline(node)) {
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
    const tx = {
      txId,
      nodeId: node,
      isolationLevel: iso,
      description: description || null,
      status: 'active',
      startedAt: new Date(),
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
  const tx = requireTx(txId);
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

  if (!isNodeOnline(node)) {
    throw new Error(
      `Node ${node} is offline in this simulation; cannot insert on it`
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
  const tx = requireTx(txId);
  const id = parseInt(transId, 10);
  const deltaAmount = Number(amountDelta || 0);
  const deltaBalance = Number(balanceDelta || 0);

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
}

//DELETE row inside a transaction
async function deleteTrans({ txId, transId }) {
  const tx = requireTx(txId);
  const id = parseInt(transId, 10);

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
}

//COMMIT transaction
async function commitTransaction({ txId }) {
  const tx = requireTx(txId);

  await tx.connection.commit();
  tx.connection.release();

  tx.status = 'committed';
  tx.finishedAt = new Date();

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
  const tx = requireTx(txId);

  await tx.connection.rollback();
  tx.connection.release();

  tx.status = 'rolledback';
  tx.finishedAt = new Date();

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
  listTransactions
};
