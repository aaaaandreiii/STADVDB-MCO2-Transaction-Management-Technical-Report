const { nodes } = require('../config/nodes');

//online/offline flag for each node
//for DB/network failure during replication test

const status = {};

for (const id of Object.keys(nodes)) {
  status[parseInt(id, 10)] = { online: true };
}

function isNodeOnline(nodeId) {
  const s = status[nodeId];
  return !s ? false : s.online !== false;
}

function setNodeOnline(nodeId, online) {
  if (!status[nodeId]) {
    status[nodeId] = {};
  }
  status[nodeId].online = !!online;
}

function getAllStatuses() {
  return { ...status };
}

module.exports = {
  isNodeOnline,
  setNodeOnline,
  getAllStatuses
};
