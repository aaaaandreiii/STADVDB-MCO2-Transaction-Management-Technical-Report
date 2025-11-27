

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const NODE_ID = process.env.NODE_ID || 'node1';
const PORT = parseInt(process.env.PORT || '3001', 10);
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'mydb_node1',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const CENTRAL_NODE_URL = process.env.CENTRAL_NODE_URL; // e.g. http://node1:3001
const NODE2_URL = process.env.NODE2_URL;
const NODE3_URL = process.env.NODE3_URL;

const app = express();
app.use(express.json());

// Create pool
const pool = mysql.createPool(DB_CONFIG);

// In-memory tx map: txId -> { conn, isolation, writes: [ {trans_id, op, data} ] }
const activeTxs = new Map();

// Ensure replication_log exists (idempotent)
async function ensureReplicationLog() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS replication_log (
        op_id VARCHAR(128) PRIMARY KEY,
        origin_node VARCHAR(64),
        trans_id INT,
        op_type VARCHAR(16),
        payload JSON,
        ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
  } finally {
    conn.release();
  }
}

// Helper: generate op id
function mkOpId() {
  return `${NODE_ID}-${Date.now()}-${Math.random().toString(36).slice(2,8)}-${uuidv4().slice(0,8)}`;
}

// Start a transaction
app.post('/tx/start', async (req, res) => {
  const isolation = (req.body && req.body.isolation) || 'READ COMMITTED'; // default
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  try {
    const conn = await pool.getConnection();
    // Map incoming friendly names to MySQL syntax if needed
    const isoMap = {
      'READ UNCOMMITTED': 'READ UNCOMMITTED',
      'READ COMMITTED': 'READ COMMITTED',
      'REPEATABLE READ': 'REPEATABLE READ',
      'SERIALIZABLE': 'SERIALIZABLE'
    };
    const chosen = isoMap[isolation.toUpperCase()] || 'READ COMMITTED';
    await conn.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${chosen}`);
    await conn.query('START TRANSACTION');
    activeTxs.set(txId, { conn, isolation: chosen, writes: [] });
    res.json({ ok: true, txId, isolation: chosen });
  } catch (err) {
    console.error('tx start err', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Read inside transaction
app.post('/tx/:txid/read', async (req, res) => {
  const txId = req.params.txid;
  const trans_id = req.body.trans_id;
  const tx = activeTxs.get(txId);
  if (!tx) return res.status(400).json({ ok:false, error: 'tx not found' });
  try {
    // Use SELECT ... FOR SHARE in case we want to lock for read under stricter isolation
    const [rows] = await tx.conn.query(
      `SELECT trans_id, account_id, newdate, type, amount FROM ${DB_CONFIG.database}.node${NODE_ID.slice(-1)}_trans WHERE trans_id = ? LIMIT 1`,
      [trans_id]
    );
    res.json({ ok:true, row: rows[0] || null });
  } catch (err) {
    console.error('tx read err', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Write/update) inside transaction does NOT replicate yet; replication on commit
app.post('/tx/:txid/write', async (req, res) => {
  const txId = req.params.txid;
  const { trans_id, amount, type } = req.body;
  const tx = activeTxs.get(txId);
  if (!tx) return res.status(400).json({ ok:false, error: 'tx not found' });

  try {
    // Acquire row-level lock for update using SELECT ... FOR UPDATE to serialize writers
    // Note: SELECT FOR UPDATE must be done on same connection before UPDATE to ensure locking
    await tx.conn.query(`SELECT trans_id FROM ${DB_CONFIG.database}.node${NODE_ID.slice(-1)}_trans WHERE trans_id = ? FOR UPDATE`, [trans_id]);

    await tx.conn.query(
      `UPDATE ${DB_CONFIG.database}.node${NODE_ID.slice(-1)}_trans SET amount = ? ${type ? ', type = ?' : ''} WHERE trans_id = ?`,
      type ? [amount, type, trans_id] : [amount, trans_id]
    );

    // buffer the write for replication on commit - capture changed fields and type (for routing)
    tx.writes.push({ trans_id, amount, type, op: 'UPDATE' });

    res.json({ ok:true, note:'update executed within tx; pending commit' });
  } catch (err) {
    console.error('tx write err', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Delete inside transaction (optional)
app.post('/tx/:txid/delete', async (req, res) => {
  const txId = req.params.txid;
  const { trans_id } = req.body;
  const tx = activeTxs.get(txId);
  if (!tx) return res.status(400).json({ ok:false, error: 'tx not found' });

  try {
    await tx.conn.query(`SELECT trans_id FROM ${DB_CONFIG.database}.node${NODE_ID.slice(-1)}_trans WHERE trans_id = ? FOR UPDATE`, [trans_id]);
    await tx.conn.query(`DELETE FROM ${DB_CONFIG.database}.node${NODE_ID.slice(-1)}_trans WHERE trans_id = ?`, [trans_id]);
    tx.writes.push({ trans_id, op: 'DELETE' });
    res.json({ ok:true, note:'delete executed within tx; pending commit' });
  } catch (err) {
    console.error('tx delete err', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Commit: commit locally and then replicate buffered writes (synchronous replicate-on-commit)
app.post('/tx/:txid/commit', async (req, res) => {
  const txId = req.params.txid;
  const tx = activeTxs.get(txId);
  if (!tx) return res.status(400).json({ ok:false, error:'tx not found' });

  try {
    await tx.conn.query('COMMIT');

    // replicate each write AFTER commit to guarantee durability at origin
    for (const w of tx.writes) {
      const opId = mkOpId();
      const payload = {
        opId,
        origin: NODE_ID,
        trans_id: w.trans_id,
        op: w.op,
        amount: w.amount === undefined ? null : w.amount,
        type: w.type || null,
        ts: Date.now()
      };

      // Node2/3 send to central; central forwards to fragment nodes
      if (NODE_ID === 'node1') {
        // apply locally already done; now forward to fragment owners
        await applyAndForwardOnCentral(payload).catch(e => {
          console.error('central forward error', e.message);
        });
      } else {
        // send to central
        try {
          await axios.post(`${CENTRAL_NODE_URL}/applyUpdate`, payload, { timeout: 5000 });
        } catch (err) {
          // if central down or network error: log and return partial success - you might implement retry/queue for Step 4
          console.error('replicate to central failed', err.message);
        }
      }
    }

    tx.conn.release();
    activeTxs.delete(txId);
    res.json({ ok:true, committed: true, replicatedOps: tx.writes.length });
  } catch (err) {
    try { await tx.conn.query('ROLLBACK'); } catch(e){ }
    tx.conn.release();
    activeTxs.delete(txId);
    console.error('commit err', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Abort / rollback
app.post('/tx/:txid/abort', async (req, res) => {
  const txId = req.params.txid;
  const tx = activeTxs.get(txId);
  if (!tx) return res.status(400).json({ ok:false, error:'tx not found' });

  try {
    await tx.conn.query('ROLLBACK');
    tx.conn.release();
    activeTxs.delete(txId);
    res.json({ ok:true, aborted:true });
  } catch (err) {
    console.error('rollback err', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Replication receiver - idempotent via replication_log
app.post('/applyUpdate', async (req, res) => {
  const op = req.body;
  if (!op || !op.opId) return res.status(400).json({ ok:false, error:'missing opId' });

  const conn = await pool.getConnection();
  try {
    // try insert opId into replication_log - if already exists then skip
    const [r] = await conn.query('SELECT op_id FROM replication_log WHERE op_id = ? LIMIT 1', [op.opId]);
    if (r && r.length > 0) {
      conn.release();
      return res.json({ ok:true, applied:false, reason:'already applied' });
    }

    // apply op on this node's fragment table (nodeX_trans)
    const tableName = `${DB_CONFIG.database}.node${NODE_ID.slice(-1)}_trans`;
    if (op.op === 'UPDATE') {
      // update fields if row exists; if not, do upsert
      await conn.query(`UPDATE ${tableName} SET amount = ? ${op.type ? ', type = ?' : ''} WHERE trans_id = ?`,
        op.type ? [op.amount, op.type, op.trans_id] : [op.amount, op.trans_id]);
      // optionally insert if not found
      await conn.query(`INSERT INTO ${tableName} (trans_id, amount, type) SELECT ?, ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ${tableName} WHERE trans_id = ?)`,
        [op.trans_id, op.amount, op.type || '', op.trans_id]);
    } else if (op.op === 'DELETE') {
      await conn.query(`DELETE FROM ${tableName} WHERE trans_id = ?`, [op.trans_id]);
    }

    // record replication log
    await conn.query('INSERT INTO replication_log (op_id, origin_node, trans_id, op_type, payload) VALUES (?, ?, ?, ?, ?)', [op.opId, op.origin, op.trans_id, op.op, JSON.stringify(op)]);
    await conn.commit(); // commit the changes and log together
    conn.release();

    // If we're central and this request came from a fragment, forward to the fragment owners (to keep them consistent)
    if (NODE_ID === 'node1') {
      // Central might receive writes from node2/node3; central must forward to other fragment if required
      // We'll forward to the appropriate fragment(s) depending on type or simple strategy: send to both nodes for safety
      // But to respect fragmentation: if op.type === 'Credit' -> send to node2, else to node3
      try {
        if (op.type && op.type === 'Credit') {
          if (NODE2_URL) await axios.post(`${NODE2_URL}/applyUpdate`, op).catch(e=>console.error('forward->node2', e.message));
        } else {
          if (NODE3_URL) await axios.post(`${NODE3_URL}/applyUpdate`, op).catch(e=>console.error('forward->node3', e.message));
        }
      } catch (e) {
        console.error('central forward error', e.message);
      }
    }

    return res.json({ ok:true, applied:true });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch(e) {}
    conn.release();
    console.error('applyUpdate err', err);
    return res.status(500).json({ ok:false, error: err.message });
  }
});

// Helper used when Node1 needs to forward after local commit (applies and logs op on central)
async function applyAndForwardOnCentral(payload) {
  // Use pool.getConnection and transaction to apply + log atomically
  const conn = await pool.getConnection();
  try {
    await conn.query('START TRANSACTION');
    // insert into replication_log if not exists
    const [exists] = await conn.query('SELECT op_id FROM replication_log WHERE op_id = ? LIMIT 1', [payload.opId]);
    if (!(exists && exists.length > 0)) {
      // apply to central node1_trans table
      const tableName = `${DB_CONFIG.database}.node1_trans`;
      if (payload.op === 'UPDATE') {
        await conn.query(`UPDATE ${tableName} SET amount = ? ${payload.type ? ', type = ?' : ''} WHERE trans_id = ?`,
          payload.type ? [payload.amount, payload.type, payload.trans_id] : [payload.amount, payload.trans_id]);
        await conn.query(`INSERT INTO ${tableName} (trans_id, amount, type) SELECT ?, ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ${tableName} WHERE trans_id = ?)`,
          [payload.trans_id, payload.amount, payload.type || '', payload.trans_id]);
      } else if (payload.op === 'DELETE') {
        await conn.query(`DELETE FROM ${tableName} WHERE trans_id = ?`, [payload.trans_id]);
      }
      await conn.query('INSERT INTO replication_log (op_id, origin_node, trans_id, op_type, payload) VALUES (?, ?, ?, ?, ?)',
        [payload.opId, payload.origin, payload.trans_id, payload.op, JSON.stringify(payload)]);
    }
    await conn.query('COMMIT');
    conn.release();

    // forward to fragment nodes
    // route by payload.type if present; otherwise send to both fragment nodes (safer)
    if (payload.type && payload.type === 'Credit') {
      if (NODE2_URL) await axios.post(`${NODE2_URL}/applyUpdate`, payload).catch(e=>console.error('forward->node2', e.message));
    } else {
      if (NODE3_URL) await axios.post(`${NODE3_URL}/applyUpdate`, payload).catch(e=>console.error('forward->node3', e.message));
    }
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch(e){}
    conn.release();
    throw err;
  }
}

// Health & debug
app.get('/info', (req, res) => {
  res.json({ node: NODE_ID, db: DB_CONFIG.database });
});

app.get('/data', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT trans_id, account_id, newdate, type, amount FROM ${DB_CONFIG.database}.node${NODE_ID.slice(-1)}_trans LIMIT 100`);
    res.json({ ok:true, rows });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Start server and ensure replication_log exists
(async () => {
  try {
    await ensureReplicationLog();
    app.listen(PORT, () => {
      console.log(`Node ${NODE_ID} running on port ${PORT} (DB=${DB_CONFIG.database})`);
    });
  } catch (e) {
    console.error('startup error', e);
    process.exit(1);
  }
})();
