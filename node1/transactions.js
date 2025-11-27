// transactions.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { replicateOutbound, markApplied, isApplied } = require('./replication');
const crypto = require('crypto');

function mkOpId() {
  return `${process.env.NODE_ID}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Start a transaction: client obtains a transient tx token and connection is stored in memory.
// For simplicity we store a connection per txid in server memory (works for local/demo).
const txConns = new Map();

router.post('/tx/start', async (req, res) => {
  const { txid, isolation = 'READ COMMITTED' } = req.body;
  if (!txid) return res.status(400).json({ error: 'txid required' });

  const conn = await pool.getConnection();
  // set isolation
  await conn.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${isolation}`);
  await conn.beginTransaction();
  txConns.set(txid, conn);
  res.json({ ok: true, txid, isolation });
});

router.post('/tx/read', async (req, res) => {
  const { txid, trans_id } = req.body;
  if (!txid || !trans_id) return res.status(400).json({ error: 'txid and trans_id required' });
  const conn = txConns.get(txid);
  if (!conn) return res.status(400).json({ error: 'transaction not started or expired' });

  try {
    // Use FOR SHARE for read depending on needs; FOR UPDATE would lock
    const table = `${process.env.NODE_ID}_trans`;
    const [rows] = await conn.query(`SELECT * FROM \`${table}\` WHERE trans_id = ?`, [trans_id]);
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tx/update', async (req, res) => {
  const { txid, trans_id, amount, type } = req.body;
  if (!txid || !trans_id || amount == null) return res.status(400).json({ error: 'txid, trans_id, amount required' });
  const conn = txConns.get(txid);
  if (!conn) return res.status(400).json({ error: 'transaction not started or expired' });

  try {
    const table = `${process.env.NODE_ID}_trans`;
    // Optionally lock row for update:
    await conn.query(`SELECT trans_id FROM \`${table}\` WHERE trans_id = ? FOR UPDATE`, [trans_id]);
    await conn.query(`UPDATE \`${table}\` SET amount = ? WHERE trans_id = ?`, [amount, trans_id]);
    // Do NOT replicate yet — replicate only after commit to ensure atomicity (we'll replicate after commit below)
    res.json({ ok: true, note: 'updated in TX (pending commit)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tx/commit', async (req, res) => {
  const { txid } = req.body;
  if (!txid) return res.status(400).json({ error: 'txid required' });
  const conn = txConns.get(txid);
  if (!conn) return res.status(400).json({ error: 'transaction not started or expired' });

  try {
    // find what was updated in this transaction by reading bin or use application-level bookkeeping.
    // For simplicity: commit then scan last few changes by timestamp (or pass updates in request)
    await conn.commit();

    // If client sent the updates to replicate, we expect a `pending_rep` object saved at request time.
    // For demo, we expect client to POST commit with `replications` list (array of {trans_id, amount, type})
    // but to keep simple we accept optional replications in body
    const replications = req.body.replications || [];

    // For each replication op, build opId, persist replication_log and call replicateOutbound
    for (const r of replications) {
      const opId = mkOpId();
      const payload = { opId, origin: process.env.NODE_ID, trans_id: r.trans_id, amount: r.amount, type: r.type };
      // mark applied locally (avoid reapply) - insert replication_log
      await pool.query('INSERT IGNORE INTO replication_log (op_id, applied_at) VALUES (?, NOW())', [opId]);
      try {
        await replicateOutbound(payload);
      } catch (err) {
        // replication failure -> log and continue; replication can be retried by separate process
        console.error('replication failed for op', opId, err.message);
      }
    }

    conn.release();
    txConns.delete(txid);
    res.json({ ok: true });
  } catch (err) {
    // rollback on error
    try { await conn.rollback(); conn.release(); } catch(e) {}
    txConns.delete(txid);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tx/rollback', async (req,res) => {
  const { txid } = req.body;
  if (!txid) return res.status(400).json({ error: 'txid required' });
  const conn = txConns.get(txid);
  if (!conn) return res.status(400).json({ error: 'transaction not started or expired' });
  try {
    await conn.rollback();
    conn.release();
    txConns.delete(txid);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * applyUpdate endpoint: receives replication payload from peer.
 * Payload: { opId, origin, trans_id, amount, type }
 * This endpoint MUST be idempotent.
 */
router.post('/applyUpdate', async (req, res) => {
  const { opId, origin, trans_id, amount, type } = req.body;
  if (!opId || !trans_id) return res.status(400).json({ error: 'opId and trans_id required' });

  try {
    // check replication_log for opId
    const [rows] = await pool.query('SELECT op_id FROM replication_log WHERE op_id = ?', [opId]);
    if (rows.length > 0) return res.json({ ok: true, note: 'already applied' });

    // apply to local fragment table
    const table = `${process.env.NODE_ID}_trans`;
    await pool.query(`UPDATE \`${table}\` SET amount = ? WHERE trans_id = ?`, [amount, trans_id]);

    // record applied op
    await pool.query('INSERT IGNORE INTO replication_log (op_id, applied_at) VALUES (?, NOW())', [opId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('applyUpdate error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
