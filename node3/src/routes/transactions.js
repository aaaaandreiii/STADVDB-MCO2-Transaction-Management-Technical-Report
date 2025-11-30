const express = require('express');
const router = express.Router();
const { getPool, currentNodeId } = require('../db');

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

//allowed sortable columns
const VALID_SORT_COLUMNS = [
  'trans_id',
  'account_id',
  'newdate',
  'type',
  'amount',
  'balance',
  'last_updated_by_node',
  'version'
];

const DEFAULT_SORT_BY = 'trans_id';
const DEFAULT_SORT_DIR = 'asc';

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

  //sort
  let sortBy = req.query.sortBy || DEFAULT_SORT_BY;
  if (!VALID_SORT_COLUMNS.includes(sortBy)) {
    sortBy = DEFAULT_SORT_BY;
  }

  let sortDir = (req.query.sortDir || DEFAULT_SORT_DIR).toLowerCase();
  if (sortDir !== 'asc' && sortDir !== 'desc') {
    sortDir = DEFAULT_SORT_DIR;
  }
  const sortDirSql = sortDir.toUpperCase();

  //search
  const search = (req.query.search || '').trim();
  let whereSql = '';
  let searchParams = [];

  if (search) {
    const like = `%${search}%`;
    //search across id, account, date (YYYY-MM-DD), type, amount, balance, last_updated_by_node, version
    searchParams = [like, like, like, like, like, like, like, like];
    whereSql = `
      WHERE
        CAST(trans_id AS CHAR) LIKE ?
        OR CAST(account_id AS CHAR) LIKE ?
        OR DATE_FORMAT(newdate, '%Y-%m-%d') LIKE ?
        OR type LIKE ?
        OR CAST(amount AS CHAR) LIKE ?
        OR CAST(balance AS CHAR) LIKE ?
        OR CAST(last_updated_by_node AS CHAR) LIKE ?
        OR CAST(version AS CHAR) LIKE ?
    `;
  }

  try {
    const pool = getPool(currentNodeId);

    // total count to compute total pages
    const countSql = `SELECT COUNT(*) AS count FROM trans ${whereSql}`;
    const [[{ count }]] = await pool.query(countSql, searchParams);
    const totalCount = count;

    const totalPages =
      totalCount === 0 ? 1 : Math.max(Math.ceil(totalCount / pageSize), 1);

    // clamp page to the valid range
    if (page > totalPages) {
      page = totalPages;
    }

    const offset = (page - 1) * pageSize;

    // fetch current page rows
    const rowsSql = `
      SELECT *
      FROM trans
      ${whereSql}
      ORDER BY ${sortBy} ${sortDirSql}
      LIMIT ?
      OFFSET ?
    `;

    const rowsParams = search
      ? [...searchParams, pageSize, offset]
      : [pageSize, offset];

    const [rowsRaw] = await pool.query(rowsSql, rowsParams);

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
      hasRows: rows.length > 0,

      // sorting + search stuff
      currentSortBy: sortBy,
      currentSortDir: sortDir, // asc/desc
      searchQuery: search,
      hasSearch: !!search
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
