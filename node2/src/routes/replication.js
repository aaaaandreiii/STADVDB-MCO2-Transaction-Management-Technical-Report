const express = require('express');
const router = express.Router();
const { nodes } = require('../config/nodes');
const { runReplicationOnce } = require('../services/replication');

function wrap(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res, next);
      if (!res.headersSent) {
        res.json({ ok: true, ...result });
      }
    } catch (err) {
      console.error('[API/replication] Error:', err);
      res.status(400).json({ ok: false, error: err.message });
    }
  };
}

// POST /api/replication/run-once
router.post(
  '/run-once',
  wrap(async (req) => {
    const sourceNodeId = parseInt(req.body.sourceNodeId, 10);
    const targetNodeId = parseInt(req.body.targetNodeId, 10);
    // const limit = req.body.limit ? parseInt(req.body.limit, 10) : 10;

    let limit = parseInt(req.body.limit, 10);
    if (Number.isNaN(limit) || limit <= 0) {
      limit = 10;
    }
    const MAX_LIMIT = 1000;
    if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }

    if (!nodes[sourceNodeId]) {
      throw new Error(`Unknown sourceNodeId ${sourceNodeId}`);
    }
    if (!nodes[targetNodeId]) {
      throw new Error(`Unknown targetNodeId ${targetNodeId}`);
    }

    //body: { sourceNodeId, targetNodeId, limit }
    const outcome = await runReplicationOnce({
      sourceNodeId,
      targetNodeId,
      limit
    });

    return { outcome };
  })
);

module.exports = router;
