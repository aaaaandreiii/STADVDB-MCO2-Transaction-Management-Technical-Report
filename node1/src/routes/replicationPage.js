const express = require('express');
const router = express.Router();
const { nodes } = require('../config/nodes');
const { getAllStatuses } = require('../state/nodeStatus');

//manual (not automated) replication experimentation on /replication
router.get('/', (req, res) => {
  res.render('replication', {
    nodes: Object.values(nodes),
    status: getAllStatuses()
  });
});

module.exports = router;
