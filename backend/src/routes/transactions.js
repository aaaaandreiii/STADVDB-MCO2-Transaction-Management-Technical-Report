const express = require('express');
const router = express.Router();
const { getPool, currentNodeId } = require('../db');
// const NODE_ID = process.env.NODE_ID || 1;

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

//show all transactions on the current node
router.get('/local', async (req, res, next) => {
  let page = parseInt(req.query.page || '1', 10);
  if (Number.isNaN(page) || page < 1) {
    page = 1;
  }

  let pageSize = parseInt(req.query.pageSize || DEFAULT_PAGE_SIZE, 10);
  if (Number.isNaN(pageSize) || pageSize <= 0) {
    pageSize = DEFAULT_PAGE_SIZE;
  }
  if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
  }

  try {
    const pool = getPool(currentNodeId);

    //total count to compute total pages
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM trans'
    );
    const totalCount = count;
    const totalPages =
      totalCount === 0 ? 1 : Math.max(Math.ceil(totalCount / pageSize), 1);

    //xlamp page to the valid range
    if (page > totalPages) {
      page = totalPages;
    }

    const offset = (page - 1) * pageSize;

    //fetch current page rows
    const [rows] = await pool.query(
      'SELECT * FROM trans ORDER BY trans_id ASC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );

    res.render('transactions', {
      rows,
      page,
      pageSize,
      totalPages,
      totalCount
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
