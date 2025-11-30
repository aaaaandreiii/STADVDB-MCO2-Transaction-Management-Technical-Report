const express = require('express');
const router = express.Router();
const { nodes } = require('../config/nodes');
const { ISOLATION_LEVELS } = require('../services/txManager');

//shows controls for Tx A and Tx B
//    start transactions on different nodes with different isolation levels
//    able to READ, UPDATE, COMMIT, ROLLBACK
router.get('/', (req, res) => {
  res.render('concurrency', {
    nodes: Object.values(nodes),
    isolationLevels: ISOLATION_LEVELS
  });
});

module.exports = router;