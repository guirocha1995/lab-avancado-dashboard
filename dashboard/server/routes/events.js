const express = require('express');
const { query, execute } = require('../db');
const { addClient, broadcast } = require('../sse');

const router = express.Router();

// GET /api/events — list last 100 events
router.get('/', async (req, res) => {
  try {
    const events = await query(`
      SELECT TOP 100 Id, EventType, Source, Payload, OrderId, Severity, CreatedAt
      FROM EventLog
      ORDER BY CreatedAt DESC
    `);

    const parsed = events.map((e) => ({
      ...e,
      Payload: e.Payload ? JSON.parse(e.Payload) : null,
    }));

    res.json(parsed);
  } catch (err) {
    console.error('Error fetching events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/stream — SSE endpoint
router.get('/stream', (req, res) => {
  addClient(req, res);
});

// POST /api/events/notify — webhook for Azure Functions to notify events
router.post('/notify', async (req, res) => {
  try {
    const { eventType, source, payload, orderId, severity } = req.body;

    if (!eventType || !source) {
      return res.status(400).json({ error: 'eventType and source are required' });
    }

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});

    // Save to EventLog
    await execute(
      `INSERT INTO EventLog (EventType, Source, Payload, OrderId, Severity, CreatedAt)
       VALUES (@eventType, @source, @payload, @orderId, @severity, GETUTCDATE())`,
      {
        eventType,
        source,
        payload: payloadStr,
        orderId: orderId || null,
        severity: severity || 'info',
      }
    );

    // Broadcast via SSE to all connected clients
    const broadcastEvent = broadcast({
      type: eventType,
      source,
      payload: typeof payload === 'string' ? JSON.parse(payload) : (payload || {}),
      severity: severity || 'info',
    });

    res.status(201).json({
      message: 'Event received and broadcast',
      event: broadcastEvent,
    });
  } catch (err) {
    console.error('Error processing event notification:', err.message);
    res.status(500).json({ error: 'Failed to process event notification' });
  }
});

// GET /api/events/stats — aggregated counts by type and source (last 24h)
router.get('/stats', async (req, res) => {
  try {
    const byType = await query(`
      SELECT EventType, COUNT(*) AS Count
      FROM EventLog
      WHERE CreatedAt >= DATEADD(HOUR, -24, GETUTCDATE())
      GROUP BY EventType
      ORDER BY Count DESC
    `);

    const bySource = await query(`
      SELECT Source, COUNT(*) AS Count
      FROM EventLog
      WHERE CreatedAt >= DATEADD(HOUR, -24, GETUTCDATE())
      GROUP BY Source
      ORDER BY Count DESC
    `);

    const bySeverity = await query(`
      SELECT Severity, COUNT(*) AS Count
      FROM EventLog
      WHERE CreatedAt >= DATEADD(HOUR, -24, GETUTCDATE())
      GROUP BY Severity
      ORDER BY Count DESC
    `);

    res.json({
      byType,
      bySource,
      bySeverity,
      period: 'last_24h',
    });
  } catch (err) {
    console.error('Error fetching event stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch event stats' });
  }
});

module.exports = router;
