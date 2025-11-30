const express = require('express');
const router = express.Router();
const { nodes } = require('../config/nodes');
const { getAllStatuses, setNodeOnline } = require('../state/nodeStatus');

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
router.get('/panel', (req, res) => {
  const status = getAllStatuses();
  res.render('admin_panel', {
    nodes: Object.values(nodes),
    status
  });
});

// GET /admin/node-status
router.get(
  '/node-status',
  wrap(() => {
    const status = getAllStatuses();
    return { nodes, status };
  })
);

// POST /admin/node-status/:nodeId
router.post(
  '/node-status/:nodeId',
  wrap((req) => {
    const nodeId = parseInt(req.params.nodeId, 10);
    const node = nodes[nodeId];
    if (!node) {
      throw new Error(`Unknown nodeId ${nodeId}`);
    }
    const online = !!req.body.online;
    setNodeOnline(nodeId, online);

    // body: { online: true/false }
    const status = getAllStatuses()[nodeId];
    return { nodeId, online: status.online };
  })
);

module.exports = router;
