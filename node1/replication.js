
const axios = require('axios');
const pool = require('./db');
require('dotenv').config();

const NODE_ID = process.env.NODE_ID;
const NODE1_URL = process.env.NODE1_URL;
const NODE2_URL = process.env.NODE2_URL;
const NODE3_URL = process.env.NODE3_URL;

async function markApplied(opId) {
  const sql = `INSERT IGNORE INTO replication_log (op_id, applied_at) VALUES (?, NOW())`;
  await pool.query(sql, [opId]);
}

async function isApplied(opId) {
  const [rows] = await pool.query('SELECT op_id FROM replication_log WHERE op_id = ?', [opId]);
  return rows.length > 0;
}

async function replicateOutbound(payload) {
  const { opId, origin, trans_id, amount, type } = payload;

  if(await isApplied(opId)) return;

  try {
    if (NODE_ID === 'node1') {
      // central -> forward to appropriate fragment
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
  } catch (err) {
    console.error('replicateOutbound error', err.message);
    // don't throw; replication will be retried by caller/logic or after manual retry
    throw err;
  }
}

module.exports = { replicateOutbound, isApplied, markApplied };
