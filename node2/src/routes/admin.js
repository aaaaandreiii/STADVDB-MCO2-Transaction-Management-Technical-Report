const express = require('express');
const router = express.Router();
const { nodes } = require('../config/nodes');
const { getAllStatuses, setNodeOnline } = require('../state/nodeStatus');
const { getPool } = require('../db');
const { runAutoReplicationBatch } = require('../services/replication');

function wrap(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res, next);
      if (!res.headersSent) {
        res.json({ ok: true, ...result });
      }
    } catch (err) {
      console.error('[API/admin] Error:', err);
      res.status(400).json({ ok: false, error: err.message });
    }
  };
}

// GET /admin/panel
// admin UI to toggle node online/offline;
// and see statuses
router.get('/panel', async (req, res, next) => {
  try {
    const status = await getAllStatuses();
    res.render('admin_panel', {
      nodes: Object.values(nodes),
      status
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/node-status
router.get(
  '/node-status',
  wrap(async () => {
    const status = await getAllStatuses();
    return { nodes, status };
  })
);

// GET /admin/health
//actually try to connect to each DB node
router.get(
  '/health',
  wrap(async () => {
    const results = {};

    for (const [id, node] of Object.entries(nodes)) {
      const nodeId = parseInt(id, 10);
      try {
        const pool = getPool(nodeId);
        await pool.query('SELECT 1');
        results[nodeId] = { reachable: true };
      } catch (err) {
        results[nodeId] = { reachable: false, error: err.message };
      }
    }

    return { health: results };
  })
);

// POST /admin/node-status/:nodeId
router.post(
  '/node-status/:nodeId',
  wrap(async (req) => {
    const nodeId = parseInt(req.params.nodeId, 10);
    const node = nodes[nodeId];
    if (!node) {
      throw new Error(`Unknown nodeId ${nodeId}`);
    }
    const online = !!req.body.online;

    await setNodeOnline(nodeId, online);

    const statusMap = await getAllStatuses();
    const status = statusMap[nodeId];

    //if node just turned ONLINE
    //    replication should catch-up
    if (online) {
      try {
        await runAutoReplicationBatch();
        console.log(
          `[admin] Node ${nodeId} marked ONLINE; ran replication catch-up batch.`
        );
      } catch (err) {
        console.error(
          `[admin] Failed to run replication catch-up after node ${nodeId} ONLINE:`,
          err.message
        );
      }
    }

    return { nodeId, online: status.online };
  })
);


module.exports = router;
