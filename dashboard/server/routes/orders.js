const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../db');
const { broadcast } = require('../sse');
const { getAccessToken } = require('../auth');

const router = express.Router();

// Lazy-load Service Bus client to avoid startup failures when env vars are missing
let sbSender = null;

async function getServiceBusSender() {
  if (sbSender) return sbSender;

  const connectionString = process.env.SERVICEBUS_CONNECTION_STRING;
  const queueName = process.env.SERVICEBUS_QUEUE_NAME || 'order-queue';

  if (!connectionString) {
    console.warn('SERVICEBUS_CONNECTION_STRING not configured. Messages will not be sent.');
    return null;
  }

  try {
    const { ServiceBusClient } = require('@azure/service-bus');
    const client = new ServiceBusClient(connectionString);
    sbSender = client.createSender(queueName);
    console.log(`Service Bus sender created for queue: ${queueName}`);
    return sbSender;
  } catch (err) {
    console.error('Failed to create Service Bus sender:', err.message);
    return null;
  }
}

// Helper: send order directly to Service Bus (bypassing APIM)
async function sendDirectToServiceBus(orderId, customerName, totalAmount, items) {
  try {
    const sender = await getServiceBusSender();
    if (sender) {
      await sender.sendMessages({
        body: {
          orderId,
          customerName,
          totalAmount,
          items,
          createdAt: new Date().toISOString(),
        },
        contentType: 'application/json',
        subject: 'order.created',
      });
      console.log(`Order ${orderId} sent to Service Bus queue (direct)`);
    }
  } catch (sbErr) {
    console.error('Failed to send to Service Bus:', sbErr.message);
    // Non-blocking: order is created even if Service Bus fails
  }
}

// GET /api/orders — list all orders with items, most recent first
router.get('/', async (req, res) => {
  try {
    const orders = await query(`
      SELECT o.Id, o.CustomerName, o.TotalAmount, o.Status, o.CreatedAt, o.UpdatedAt,
             oi.Id AS ItemId, oi.ProductId, oi.ProductName, oi.Quantity, oi.UnitPrice
      FROM Orders o
      LEFT JOIN OrderItems oi ON o.Id = oi.OrderId
      ORDER BY o.CreatedAt DESC
    `);

    const ordersMap = new Map();
    for (const row of orders) {
      if (!ordersMap.has(row.Id)) {
        ordersMap.set(row.Id, {
          id: row.Id,
          customerName: row.CustomerName,
          totalAmount: row.TotalAmount,
          status: row.Status,
          createdAt: row.CreatedAt,
          updatedAt: row.UpdatedAt,
          items: [],
        });
      }

      if (row.ItemId) {
        ordersMap.get(row.Id).items.push({
          id: row.ItemId,
          productId: row.ProductId,
          productName: row.ProductName,
          quantity: row.Quantity,
          unitPrice: row.UnitPrice,
        });
      }
    }

    res.json(Array.from(ordersMap.values()));
  } catch (err) {
    console.error('Error fetching orders:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id — get order with items
router.get('/:id', async (req, res) => {
  try {
    const rows = await query(`
      SELECT o.Id, o.CustomerName, o.TotalAmount, o.Status, o.CreatedAt, o.UpdatedAt,
             oi.Id AS ItemId, oi.ProductId, oi.ProductName, oi.Quantity, oi.UnitPrice
      FROM Orders o
      LEFT JOIN OrderItems oi ON o.Id = oi.OrderId
      WHERE o.Id = @id
    `, { id: req.params.id });

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = {
      id: rows[0].Id,
      customerName: rows[0].CustomerName,
      totalAmount: rows[0].TotalAmount,
      status: rows[0].Status,
      createdAt: rows[0].CreatedAt,
      updatedAt: rows[0].UpdatedAt,
      items: [],
    };

    for (const row of rows) {
      if (row.ItemId) {
        order.items.push({
          id: row.ItemId,
          productId: row.ProductId,
          productName: row.ProductName,
          quantity: row.Quantity,
          unitPrice: row.UnitPrice,
        });
      }
    }

    res.json(order);
  } catch (err) {
    console.error('Error fetching order:', err.message);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /api/orders — create order
router.post('/', async (req, res) => {
  try {
    const { customerName, items } = req.body;

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'customerName and items array are required' });
    }

    const orderId = uuidv4();
    let totalAmount = 0;

    // Calculate total from items
    for (const item of items) {
      totalAmount += item.unitPrice * item.quantity;
    }

    // Insert order
    await execute(
      `INSERT INTO Orders (Id, CustomerName, TotalAmount, Status, CreatedAt, UpdatedAt)
       VALUES (@id, @customerName, @totalAmount, 'pending', GETUTCDATE(), GETUTCDATE())`,
      { id: orderId, customerName, totalAmount }
    );

    // Insert order items
    for (const item of items) {
      await execute(
        `INSERT INTO OrderItems (OrderId, ProductId, ProductName, Quantity, UnitPrice)
         VALUES (@orderId, @productId, @productName, @quantity, @unitPrice)`,
        {
          orderId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }
      );
    }

    // Log event to EventLog
    const eventPayload = JSON.stringify({
      orderId,
      customerName,
      totalAmount,
      itemCount: items.length,
    });

    await execute(
      `INSERT INTO EventLog (EventType, Source, Payload, OrderId, Severity, CreatedAt)
       VALUES ('order.created', 'app-service', @payload, @orderId, 'info', GETUTCDATE())`,
      { payload: eventPayload, orderId }
    );

    // Broadcast SSE event
    broadcast({
      type: 'order.created',
      source: 'app-service',
      payload: { orderId, customerName, totalAmount, itemCount: items.length },
      severity: 'info',
    });

    // Route order through APIM Gateway (if configured) or direct to Service Bus
    const apimBaseUrl = process.env.APIM_BASE_URL;
    const apimSubscriptionKey = process.env.APIM_SUBSCRIPTION_KEY;

    if (apimBaseUrl && apimSubscriptionKey) {
      // APIM Gateway path: App Service -> APIM -> createOrderApi Function -> Service Bus
      try {
        // Get OAuth 2.0 token from Entra ID (if configured)
        const accessToken = await getAccessToken();

        const apimHeaders = {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': apimSubscriptionKey,
        };

        // Add Bearer token if Entra ID authentication is configured
        if (accessToken) {
          apimHeaders['Authorization'] = `Bearer ${accessToken}`;
        }

        const apimResponse = await fetch(`${apimBaseUrl}/orders`, {
          method: 'POST',
          headers: apimHeaders,
          body: JSON.stringify({
            orderId,
            customerName,
            totalAmount,
            items,
            createdAt: new Date().toISOString(),
          }),
        });

        if (apimResponse.ok) {
          console.log(`Order ${orderId} sent via APIM Gateway`);
        } else {
          console.warn(`APIM Gateway returned ${apimResponse.status} - falling back to direct Service Bus`);
          // Fallback to direct Service Bus if APIM fails
          await sendDirectToServiceBus(orderId, customerName, totalAmount, items);
        }
      } catch (apimErr) {
        console.error('Failed to send via APIM Gateway:', apimErr.message);
        // Fallback to direct Service Bus
        await sendDirectToServiceBus(orderId, customerName, totalAmount, items);
      }
    } else {
      // Direct Service Bus path (no APIM configured)
      await sendDirectToServiceBus(orderId, customerName, totalAmount, items);
    }

    // Return created order
    const createdOrder = {
      id: orderId,
      customerName,
      totalAmount,
      status: 'pending',
      items,
    };

    res.status(201).json(createdOrder);
  } catch (err) {
    console.error('Error creating order:', err.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PATCH /api/orders/:id/status — update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const validStatuses = ['pending', 'processing', 'approved', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await execute(
      `UPDATE Orders SET Status = @status, UpdatedAt = GETUTCDATE() WHERE Id = @id`,
      { status, id: orderId }
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Log event
    const eventType = `order.${status}`;
    const eventPayload = JSON.stringify({ orderId, status });

    await execute(
      `INSERT INTO EventLog (EventType, Source, Payload, OrderId, Severity, CreatedAt)
       VALUES (@eventType, @source, @payload, @orderId, @severity, GETUTCDATE())`,
      {
        eventType,
        source: req.body.source || 'app-service',
        payload: eventPayload,
        orderId,
        severity: status === 'cancelled' ? 'warning' : 'success',
      }
    );

    // Broadcast SSE event
    broadcast({
      type: eventType,
      source: req.body.source || 'app-service',
      payload: { orderId, status },
      severity: status === 'cancelled' ? 'warning' : 'success',
    });

    const updated = await query('SELECT * FROM Orders WHERE Id = @id', { id: orderId });
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating order status:', err.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
