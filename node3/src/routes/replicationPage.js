const express = require('express');
const router = express.Router();
const { nodes } = require('../config/nodes');
const { getAllStatuses } = require('../state/nodeStatus');
const { getPool, currentNodeId } = require('../db');

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

const VALID_SORT_COLUMNS = [
  'id',
  'source_node',
  'target_node',
  'trans_id',
  'op_type',
  'created_at',
  'applied',
  'applied_at'
];

const DEFAULT_SORT_BY = 'id';
const DEFAULT_SORT_DIR = 'desc';

// manual (not automated) replication experimentation on /replication
router.get('/', (req, res) => {
  res.render('replication', {
    nodes: Object.values(nodes),
    status: getAllStatuses()
  });
});

// /replication/logs – view replication_log entries on this node
router.get('/logs', async (req, res, next) => {
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

  // sorting
  let sortBy = req.query.sortBy || DEFAULT_SORT_BY;
  if (!VALID_SORT_COLUMNS.includes(sortBy)) {
    sortBy = DEFAULT_SORT_BY;
  }

  let sortDir = (req.query.sortDir || DEFAULT_SORT_DIR).toLowerCase();
  if (sortDir !== 'asc' && sortDir !== 'desc') {
    sortDir = DEFAULT_SORT_DIR;
  }
  const sortDirSql = sortDir.toUpperCase();

  // simple search across a few key columns
  const search = (req.query.search || '').trim();
  let whereSql = '';
  let searchParams = [];

  if (search) {
    const like = `%${search}%`;
    searchParams = [like, like, like, like, like];
    whereSql = `
      WHERE
        CAST(id AS CHAR) LIKE ?
        OR CAST(trans_id AS CHAR) LIKE ?
        OR CAST(source_node AS CHAR) LIKE ?
        OR CAST(target_node AS CHAR) LIKE ?
        OR op_type LIKE ?
    `;
  }

  try {
    const pool = getPool(currentNodeId);

    // total count
    const countSql = `SELECT COUNT(*) AS count FROM replication_log ${whereSql}`;
    const [[{ count }]] = await pool.query(countSql, searchParams);
    const totalCount = count;

    const totalPages =
      totalCount === 0 ? 1 : Math.max(Math.ceil(totalCount / pageSize), 1);

    if (page > totalPages) {
      page = totalPages;
    }

    const offset = (page - 1) * pageSize;

    const rowsSql = `
      SELECT *
      FROM replication_log
      ${whereSql}
      ORDER BY ${sortBy} ${sortDirSql}
      LIMIT ?
      OFFSET ?
    `;
    const rowsParams = search
      ? [...searchParams, pageSize, offset]
      : [pageSize, offset];

    const [rowsRaw] = await pool.query(rowsSql, rowsParams);

    const rows = rowsRaw.map((row) => ({
      ...row,
      createdAtFormatted:
        row.created_at && typeof row.created_at.toISOString === 'function'
          ? row.created_at.toISOString().slice(0, 19).replace('T', ' ')
          : row.created_at,
      appliedAtFormatted:
        row.applied_at && typeof row.applied_at.toISOString === 'function'
          ? row.applied_at.toISOString().slice(0, 19).replace('T', ' ')
          : row.applied_at
    }));

    const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endRow = Math.min(page * pageSize, totalCount);

    const prevPage = page > 1 ? page - 1 : 1;
    const nextPage = page < totalPages ? page + 1 : totalPages;

    const pageSizeOptions = [10, 25, 50, 100, 200].map((size) => ({
      value: size,
      selected: size === pageSize
    }));

    res.render('replication_logs', {
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

      // sorting + search
      currentSortBy: sortBy,
      currentSortDir: sortDir,
      searchQuery: search,
      hasSearch: !!search
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;