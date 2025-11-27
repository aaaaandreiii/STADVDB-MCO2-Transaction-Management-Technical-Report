// replication.js
const axios = require('axios');
const pool = require('./db');
require('dotenv').config();

const NODE_ID = process.env.NODE_ID;
const NODE1_URL = process.env.NODE1_URL;
const NODE2_URL = process.env.NODE2_URL;
const NODE3_URL = process.env.NODE3_URL;

// Helper: record opId to replication_log to enforce idempotence
async function markApplied(opId) {
  const sql = `INSERT IGNORE INTO replication_log (op_id, applied_at) VALUES (?, NOW())`;
  await pool.query(sql, [opId]);
}

async function isApplied(opId) {
  const [rows] = await pool.query('SELECT op_id FROM replication_log WHERE op_id = ?', [opId]);
  return rows.length > 0;
}

// Called by controllers when local write happens: build payload and replicate
async function replicateOutbound(payload) {
  // payload: { opId, origin, trans_id, amount, type }
  // If this node is central, forward to fragment owner(s).
  // If fragment, send to central.
  const { opId, origin, trans_id, amount, type } = payload;

  // Avoid replicating same op locally twice
  if(await isApplied(opId)) return;

  try {
    if (NODE_ID === 'node1') {
      // central -> forward to appropriate fragment(s)
      if (type === 'Credit') {
        await axios.post(`${NODE2_URL}/applyUpdate`, payload, { timeout: 5000 });
      } else {
        // Debit or other -> node3
        await axios.post(`${NODE3_URL}/applyUpdate`, payload, { timeout: 5000 });
      }
    } else {
      // fragment -> always send to central
      await axios.post(`${NODE1_URL}/applyUpdate`, payload, { timeout: 5000 });
    }
    // On success, mark as applied on origin's DB by request flow (controllers will also call markApplied where appropriate)
  } catch (err) {
    // If network failure, schedule retry via simple in-memory retry (or rely on reattempt from client)
    console.error('replicateOutbound error', err.message);
    // don't throw; replication will be retried by caller/logic or after manual retry
    throw err;
  }
}

module.exports = { replicateOutbound, isApplied, markApplied };
