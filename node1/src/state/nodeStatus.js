const { nodes } = require('../config/nodes');
const { getPool } = require('../db');

//store node_status on all nodes
const STATUS_DB_NODE_IDS = [1, 2, 3];

//online/offline flag for each node
//for DB/network failure during replication test

//try to check each status DB node
//    callback receives (pool, statusDbNodeId)
async function forEachStatusDb(fn) {
  for (const statusDbNodeId of STATUS_DB_NODE_IDS) {
    try {
      const pool = getPool(statusDbNodeId);
      await fn(pool, statusDbNodeId);
    } catch (err) {
      console.error(
        `[nodeStatus] Error talking to status DB node ${statusDbNodeId}:`,
        err.message
      );
      // continue with the next status DB
    }
  }
}

//init node_status table
//    ensure rows exist for all nodes
async function initNodeStatus() {
  await forEachStatusDb(async (pool, statusDbNodeId) => {
    //create table if it doesn't exist
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

    console.log(
      `[nodeStatus] Initialized node_status table on DB node ${statusDbNodeId}`
    );
  });
}

//check if node is online according to the shared node_status table
async function isNodeOnline(nodeId) {
  const all = await getAllStatuses();
  const status = all[nodeId];
  //fail-open
  //  if unexpected error, default to online node
  return status ? !!status.online : true;
}

//set a node's online flag in ALL reachable status DBs
//    best effort
async function setNodeOnline(nodeId, online) {
  let wrote = 0;

  await forEachStatusDb(async (pool, statusDbNodeId) => {
    await pool.query(
      `
      INSERT INTO node_status (node_id, online_status)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE online_status = VALUES(online_status)
      `,
      [nodeId, online ? 1 : 0]
    );
    wrote++;
    console.log(
      `[nodeStatus] Set node ${nodeId} online=${online} on DB node ${statusDbNodeId}`
    );
  });

  if (wrote === 0) {
    throw new Error(
      'Unable to update node_status on any metadata database node'
    );
  }
}

//get map of all node statuses
//    by reading and merging all node_status rows from ALL reachable DBs
//  { [nodeId]: { online: boolean } }
async function getAllStatuses() {
  const merged = {}; // nodeId -> { online, updatedAt: Date }

  await forEachStatusDb(async (pool, statusDbNodeId) => {
    const [rows] = await pool.query(
      'SELECT node_id, online_status, updated_at FROM node_status'
    );
    
    //for each node_id, pick row with the latest updated_at
    for (const row of rows) {
      const nodeId = row.node_id;
      const online = row.online_status === 1 || row.online_status === true;
      const updatedAt =
        row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);

      const existing = merged[nodeId];
      if (!existing || updatedAt > existing.updatedAt) {
        merged[nodeId] = { online, updatedAt };
      }
    }
  });

  //fill missing nodes as online by default
  for (const id of Object.keys(nodes)) {
    const nodeId = parseInt(id, 10);
    if (!merged[nodeId]) {
      merged[nodeId] = { online: true, updatedAt: new Date(0) };
    }
  }

  //remove updatedAt from public API
  const result = {};
  for (const [id, entry] of Object.entries(merged)) {
    result[parseInt(id, 10)] = { online: entry.online };
  }

  return result;
}

module.exports = {
  initNodeStatus,
  isNodeOnline,
  setNodeOnline,
  getAllStatuses
};
