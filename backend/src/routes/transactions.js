const express = require('express');
const router = express.Router();
const { getPool, currentNodeId } = require('../db');
// const NODE_ID = process.env.NODE_ID || 1;

const queries_per_page = 100;

//show all transactions on the current node
router.get('/local', async (req, res, next) => {
  var incremental_page = 1

  try {
    const pool = getPool(currentNodeId);
    const [rows] = await pool.query(
      "SELECT * FROM trans ORDER BY trans_id ASC " +
        "LIMIT " + queries_per_page +
        " OFFSET " + (incremental_page-1) + ";"
      );
    res.render('transactions', { rows });

    incremental_page = incremental_page + queries_per_page;
  } catch (err) {
    next(err);
  }
});

module.exports = router;
