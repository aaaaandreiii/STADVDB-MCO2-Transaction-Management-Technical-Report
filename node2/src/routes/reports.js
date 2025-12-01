const express = require('express');
const router = express.Router();
const { getPool, currentNodeId } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool(currentNodeId);

    // Example report 1: total amount per type
    const [byType] = await pool.query(
      `
      SELECT type, COUNT(*) AS cnt, SUM(amount) AS total_amount
      FROM trans
      GROUP BY type
      ORDER BY type
      `
    );

    // Example report 2: per day totals
    const [byDay] = await pool.query(
      `
      SELECT DATE(newdate) AS day,
             COUNT(*) AS cnt,
             SUM(amount) AS total_amount
      FROM trans
      GROUP BY DATE(newdate)
      ORDER BY day DESC
      LIMIT 30
      `
    );

    res.render('reports', {
      byType,
      byDay
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
