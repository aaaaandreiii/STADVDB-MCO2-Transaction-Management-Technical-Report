const { nodes } = require('../config/nodes');
const { getPool } = require('../db');

//store node_status on the central node 1's DB
const STATUS_DB_NODE_ID = 1;

//online/offline flag for each node
//for DB/network failure during replication test

//init node_status table
//  ensure rows exist for all nodes
async function initNodeStatus() {
  const pool = getPool(STATUS_DB_NODE_ID);

  // Create table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS node_status (
      node_id INT PRIMARY KEY,
      online_status TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  //make sure a row for each configured node (1, 2, 3) exists
  for (const id of Object.keys(nodes)) {
    const nodeId = parseInt(id, 10);
    await pool.query(
      'INSERT IGNORE INTO node_status (node_id, online_status) VALUES (?, 1)',
      [nodeId]
    );
  }
}

//check if node is online according to the shared node_status table
async function isNodeOnline(nodeId) {
  const pool = getPool(STATUS_DB_NODE_ID);
  const [rows] = await pool.query(
    'SELECT online_status FROM node_status WHERE node_id = ?',
    [nodeId]
  );

  if (!rows || rows.length === 0) {
    // if no row in db, default to online           //TODO: might change later
    return true;
  }

  const onlineFlag = rows[0].online_status;
  return onlineFlag === 1 || onlineFlag === true;
}

//set a node's online flag in the shared node_status table
async function setNodeOnline(nodeId, online_status) {
  const pool = getPool(STATUS_DB_NODE_ID);
  await pool.query(
    `
    INSERT INTO node_status (node_id, online)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE online = VALUES(online)
    `,
    [nodeId, online_status ? 1 : 0]
  );
}

//get map of all node statuses
//  { [nodeId]: { online: boolean } }
async function getAllStatuses() {
  const pool = getPool(STATUS_DB_NODE_ID);
  const [rows] = await pool.query('SELECT node_id, online_status FROM node_status');

  const result = {};
  for (const row of rows) {
    result[row.node_id] = {
      online_status: row.online_status === 1 || row.online_status === true
    };
  }

  //fill missing nodes as online by default
  for (const id of Object.keys(nodes)) {
    const nodeId = parseInt(id, 10);
    if (!result[nodeId]) {
      result[nodeId] = { online_status: true };
    }
  }

  return result;
}

module.exports = {
  initNodeStatus,
  isNodeOnline,
  setNodeOnline,
  getAllStatuses
};
