const app = require('./app');
const { initPools, currentNodeId, currentNode } = require('./db');
const { startAutoReplication } = require('./services/replication');

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await initPools();

    app.listen(PORT, () => {
      startAutoReplication();
      console.log(
        `[HTTP] Node ${currentNodeId} (${currentNode.role}) listening on port: http://localhost:${PORT}`
      );
      console.log(process.env.DB_HOST_NODE1)
      console.log(process.env.DB_PORT_NODE1)
      console.log(process.env.DB_NAME_NODE1)
      console.log(process.env.DB_USER_NODE1)
      console.log(process.env.DB_PASS_NODE1)
    });
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
  }
})();
