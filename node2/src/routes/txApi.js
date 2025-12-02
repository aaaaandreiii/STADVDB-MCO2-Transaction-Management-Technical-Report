const express = require('express');
const router = express.Router();
const txManager = require('../services/txManager');

//helper to wrap async handlers and send JSON errors cleanly
function wrap(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res, next);
      if (!res.headersSent) {
        res.json({ ok: true, ...result });
      }
    } catch (err) {
      console.error('[API/tx] Error:', err);

      //special case for when MySQL lock wait timeout
      if (err && (err.code === 'ER_LOCK_WAIT_TIMEOUT' || err.errno === 1205)) {
        return res.status(409).json({
          ok: false,
          error:
            'Row is locked by another transaction. That transaction may have been rolled back automatically; please check the log.'
        });
      }

      //special case for when transaction already finished
      if (err && /Transaction .* is not active/.test(err.message || '')) {
        return res.status(409).json({
          ok: false,
          error: err.message
        });
      }

      // default
      res.status(400).json({
        ok: false,
        error: err && err.message ? err.message : 'Unknown error'
      });
    }
  };
}

// POST /api/tx/start
router.post(
  '/start',
  wrap(async (req) => {
    const { nodeId, isolationLevel, description } = req.body;
    const txInfo = await txManager.startTransaction({
      nodeId,
      isolationLevel,
      description
    });
    return { tx: txInfo };
  })
);

// POST /api/tx/insert
router.post(
  '/insert',
  wrap(async (req) => {
    const {
      nodeId,
      accountId,
      newdate,
      type,
      amount,
      balance
    } = req.body;

    const result = await txManager.insertTrans({
      nodeId,
      accountId,
      newdate,
      type,
      amount,
      balance
    });

    return { result };
  })
);

// POST /api/tx/read
router.post(
  '/read',
  wrap(async (req) => {
    const { txId, transId } = req.body;
    const result = await txManager.readTrans({ txId, transId });
    return { result };
  })
);

// POST /api/tx/update
router.post(
  '/update',
  wrap(async (req) => {
    const { txId, transId, amountDelta, balanceDelta } = req.body;
    const result = await txManager.updateTrans({
      txId,
      transId,
      amountDelta,
      balanceDelta
    });
    return { result };
  })
);

// POST /api/tx/delete
router.post(
  '/delete',
  wrap(async (req) => {
    const { txId, transId } = req.body;
    const result = await txManager.deleteTrans({ txId, transId });
    return { result };
  })
);

// POST /api/tx/commit
router.post(
  '/commit',
  wrap(async (req) => {
    const { txId } = req.body;
    const result = await txManager.commitTransaction({ txId });
    return { result };
  })
);

// POST /api/tx/rollback
router.post(
  '/rollback',
  wrap(async (req) => {
    const { txId } = req.body;
    const result = await txManager.rollbackTransaction({ txId });
    return { result };
  })
);

// GET /api/tx/list
router.get(
  '/list',
  wrap(async () => {
    const list = txManager.listTransactions();
    return { transactions: list };
  })
);

module.exports = router;
