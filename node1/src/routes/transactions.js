const express = require('express');
const router = express.Router();
const { getPool, currentNodeId } = require('../db');

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

// show all transactions on the current node
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

    // total count to compute total pages
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM trans'
    );
    const totalCount = count;
    const totalPages =
      totalCount === 0 ? 1 : Math.max(Math.ceil(totalCount / pageSize), 1);

    // clamp page to the valid range
    if (page > totalPages) {
      page = totalPages;
    }

    const offset = (page - 1) * pageSize;

    // fetch current page rows
    const [rowsRaw] = await pool.query(
      'SELECT * FROM trans ORDER BY trans_id ASC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );

    // format date for display (Handlebars can't call toISOString())
    const rows = rowsRaw.map((row) => ({
      ...row,
      newdateFormatted:
        row.newdate && typeof row.newdate.toISOString === 'function'
          ? row.newdate.toISOString().slice(0, 10)
          : row.newdate
    }));

    const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endRow = Math.min(page * pageSize, totalCount);

    const prevPage = page > 1 ? page - 1 : 1;
    const nextPage = page < totalPages ? page + 1 : totalPages;

    const pageSizeOptions = [10, 25, 50, 100, 200].map((size) => ({
      value: size,
      selected: size === pageSize
    }));

    res.render('transactions', {
      rows,
      page,
      pageSize,
      totalPages,
      totalCount,
      startRow,
      endRow,
      prevPage,
      nextPage,
      pageSizeOptions,
      isFirstPage: page === 1,
      isLastPage: page === totalPages,
      hasRows: rows.length > 0
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
