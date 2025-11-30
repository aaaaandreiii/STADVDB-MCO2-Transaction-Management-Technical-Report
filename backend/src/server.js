const app = require('./app');
const { initPools, currentNodeId, currentNode } = require('./db');

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await initPools();

    app.listen(PORT, () => {
      console.log(
        `[HTTP] Node ${currentNodeId} (${currentNode.role}) listening on port ${PORT}`
      );
    });
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
  }
})();
