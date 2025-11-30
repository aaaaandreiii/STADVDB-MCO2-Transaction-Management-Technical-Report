const { getPool } = require('../db');
const { isNodeOnline } = require('../state/nodeStatus');

// Data Replication:
// decides which nodes should receive a replica of a row
//      based on (1) the node where the write originated 
//               and (2) the transaction type

// This is accomplished by:
//    writing on Node 1 propagate DOWN to the appropriate fragment/s
//    writing on Node 2 and Node 3 propagate UP to Node 1

// Fragmentation rules:
//    Node 1 (central): full copy of all rows.
//    Node 2 (fragment): rows where type = 'Credit'
//    Node 3 (fragment): rows where type != 'Credit' 
//                            AKA ('Debit (Withdrawal)', 'VYBER')

function determineTargets(sourceNodeId, txType) {
  const type = (txType || '').trim();

  //central node writes: 
  //    push down to the relevant fragment
  if (sourceNodeId === 1) {
    if (type === 'Credit') return [2];
    if (type === 'Debit (Withdrawal)' || type === 'VYBER') return [3];
    //if type doesn't belong to any fragment, DO NOT replicate to fragments
    return [];
  }

  //fragment writes: 
  //    always replicate up to central
  if (sourceNodeId === 2 || sourceNodeId === 3) {
    return [1];
  }

  return [];
}

//queue replication log entries for trans_id row
async function queueReplicationForRow(conn, params) {
  const {
    sourceNodeId,
    transId,
    type,
    opType,
    amountBefore,
    balanceBefore,
    amountAfter,
    balanceAfter
  } = params;

  const targets = determineTargets(sourceNodeId, type);

  if (targets.length === 0) {
    return { queued: 0, targets: [] };
  }

  for (const targetNode of targets) {
    await conn.query(
      `
      INSERT INTO replication_log
        (source_node, target_node, trans_id, op_type,
         amount_before, balance_before, amount_after, balance_after)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sourceNodeId,
        targetNode,
        transId,
        opType,
        amountBefore,
        balanceBefore,
        amountAfter,
        balanceAfter
      ]
    );
  }

  return { queued: targets.length, targets };
}

//apply a single replication_log entry from source --> target
async function applySingleEvent(logRow, sourceNodeId, targetNodeId) {
  if (!isNodeOnline(targetNodeId)) {
    return {
      id: logRow.id,
      status: 'skipped',
      reason: `Target node ${targetNodeId} is marked offline`
    };
  }

  const targetPool = getPool(targetNodeId);
  const sourcePool = getPool(sourceNodeId);
  const targetConn = await targetPool.getConnection();

  try {
    await targetConn.beginTransaction();

    if (logRow.op_type === 'UPDATE') {
      await targetConn.query(
        `
        UPDATE trans
        SET amount = ?, balance = ?, last_updated_by_node = ?, version = version + 1
        WHERE trans_id = ?
        `,
        [logRow.amount_after, logRow.balance_after, logRow.source_node, logRow.trans_id]
      );
    } else if (logRow.op_type === 'DELETE') {
      await targetConn.query(
        `DELETE FROM trans WHERE trans_id = ?`,
        [logRow.trans_id]
      );
    } else if (logRow.op_type === 'INSERT') {
      //INSERT: --> we need the full row from the source node
      const [rows] = await sourcePool.query(
        `SELECT * FROM trans WHERE trans_id = ?`,
        [logRow.trans_id]
      );

      if (!rows || rows.length === 0) {
        throw new Error(
          `Source row trans_id=${logRow.trans_id} not found on node ${sourceNodeId} for INSERT replication`
        );
      }

      const r = rows[0];

      await targetConn.query(
        `
        INSERT INTO trans
          (trans_id, account_id, newdate, type, amount, balance,
           last_updated_by_node, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          account_id = VALUES(account_id),
          newdate = VALUES(newdate),
          type = VALUES(type),
          amount = VALUES(amount),
          balance = VALUES(balance),
          last_updated_by_node = VALUES(last_updated_by_node),
          version = version + 1
        `,
        [
          r.trans_id,
          r.account_id,
          r.newdate,
          r.type,
          r.amount,
          r.balance,
          logRow.source_node,
          r.version
        ]
      );
    } else {
      throw new Error(`Unknown op_type "${logRow.op_type}" in replication_log`);
    }

    await targetConn.commit();

    //mark log row as applied on the source node
    await sourcePool.query(
      `UPDATE replication_log SET applied = 1, applied_at = NOW() WHERE id = ?`,
      [logRow.id]
    );

    return {
      id: logRow.id,
      status: 'applied',
      opType: logRow.op_type
    };
  } catch (err) {
    try {
      await targetConn.rollback();
    } catch (rollbackErr) {
      console.error(
        `[REPLICATION] Failed to rollback target transaction:`,
        rollbackErr
      );
    }
    return {
      id: logRow.id,
      status: 'error',
      error: err.message
    };
  } finally {
    targetConn.release();
  }
}

//run one replication batch from source --> target
async function runReplicationOnce(params) {
  const { sourceNodeId, targetNodeId, limit = 10 } = params;

  const sourcePool = getPool(sourceNodeId);
  const [rows] = await sourcePool.query(
    `
    SELECT *
    FROM replication_log
    WHERE applied = 0 AND target_node = ?
    ORDER BY id ASC
    LIMIT ?
    `,
    [targetNodeId, limit]
  );

  const results = [];

  for (const logRow of rows) {
    const outcome = await applySingleEvent(logRow, sourceNodeId, targetNodeId);
    results.push(outcome);
  }

  return {
    sourceNodeId,
    targetNodeId,
    requested: rows.length,
    results
  };
}

module.exports = {
  determineTargets,
  queueReplicationForRow,
  runReplicationOnce
};
