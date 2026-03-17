const express = require('express');
const { query, getPool } = require('../db');

const router = express.Router();

// GET /api/metrics/dashboard — calls sp_GetDashboardMetrics
router.get('/dashboard', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().execute('sp_GetDashboardMetrics');

    if (result.recordset.length === 0) {
      return res.json({
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        lowStockCount: 0,
        eventsLastHour: 0,
        avgProcessingTime: 0,
      });
    }

    const row = result.recordset[0];
    res.json({
      totalOrders: row.TotalOrders,
      totalRevenue: row.TotalRevenue,
      pendingOrders: row.PendingOrders,
      lowStockCount: row.LowStockCount,
      eventsLastHour: row.EventsLastHour,
      avgProcessingTime: row.AvgProcessingTimeSeconds,
    });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// GET /api/metrics/pipeline — counts per pipeline stage
router.get('/pipeline', async (req, res) => {
  try {
    const stages = await query(`
      SELECT Status, COUNT(*) AS Count
      FROM Orders
      GROUP BY Status
      ORDER BY
        CASE Status
          WHEN 'pending' THEN 1
          WHEN 'processing' THEN 2
          WHEN 'approved' THEN 3
          WHEN 'shipped' THEN 4
          WHEN 'delivered' THEN 5
          WHEN 'cancelled' THEN 6
          ELSE 7
        END
    `);

    const pipeline = {
      pending: 0,
      processing: 0,
      approved: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const stage of stages) {
      pipeline[stage.Status] = stage.Count;
    }

    res.json(pipeline);
  } catch (err) {
    console.error('Error fetching pipeline metrics:', err.message);
    res.status(500).json({ error: 'Failed to fetch pipeline metrics' });
  }
});

module.exports = router;
