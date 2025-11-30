const mysql = require('mysql2/promise');
const { nodes, currentNodeId, currentNode } = require('../config/nodes');

const pools = {};

// init connection pools for all nodes
//    lets any app instance talk to any DB node
async function initPools() {
  for (const [id, node] of Object.entries(nodes)) {
    const nodeId = parseInt(id, 10);
    const config = node.db;

    pools[nodeId] = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  console.log(
    '[DB] Initialized pools for nodes:',
    Object.entries(nodes)
      .map(([id, n]) => `${id}(${n.role})`)
      .join(', ')
  );
}

//get the pool for a specific node; default current node
function getPool(nodeId = currentNodeId) {
  const pool = pools[nodeId];
  if (!pool) {
    throw new Error(`No pool initialized for node ${nodeId}`);
  }
  return pool;
}

//get the pool for a specific node
// function getPool(nodeId) {
//   const pool = pools[nodeId];
//   if (!pool) {
//     throw new Error(`No pool initialized for node ${nodeId}`);
//   }
//   return pool;
// }

//acquire single connection
//  run a function
//  release
async function withConnection(nodeId, fn) {
  const pool = getPool(nodeId);
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

module.exports = {
  initPools,
  getPool,
  withConnection,
  pools,
  currentNodeId,
  currentNode,
  nodes
};
