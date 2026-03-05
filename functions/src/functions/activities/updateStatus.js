/**
 * updateStatus - Durable Functions Activity
 *
 * Atualiza o status do pedido para "approved" no App Service
 * e publica evento no Service Bus Topic "order-events".
 *
 * @module activities/updateStatus
 */

const df = require('durable-functions');
const { ServiceBusClient } = require('@azure/service-bus');

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || 'http://localhost:3001';

async function notifyAppService(event) {
  try {
    const url = `${APP_CALLBACK_URL}/api/events/notify`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn('[updateStatus] Erro ao notificar App Service: ' + error.message);
  }
}

async function publishToOrderEventsTopic(orderData, context) {
  const connectionString = process.env.SERVICEBUS_CONNECTION_STRING;
  if (!connectionString) {
    context.warn('[updateStatus] SERVICEBUS_CONNECTION_STRING nao configurada - skip topic publish');
    return;
  }

  let client;
  try {
    client = new ServiceBusClient(connectionString);
    const sender = client.createSender('order-events');

    const message = {
      body: {
        orderId: orderData.orderId,
        items: orderData.items || [],
        totalAmount: orderData.totalAmount || 0,
        status: 'approved',
        processedAt: new Date().toISOString(),
      },
      contentType: 'application/json',
      subject: 'order-approved-' + orderData.orderId,
      applicationProperties: {
        eventType: 'order.approved',
        orderId: orderData.orderId,
        totalAmount: orderData.totalAmount || 0,
      },
    };

    await sender.sendMessages(message);
    await sender.close();
    context.log('[updateStatus] Evento publicado no topic order-events');
  } catch (error) {
    context.error('[updateStatus] Erro ao publicar no topic: ' + error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

df.app.activity('updateStatus', {
  handler: async (input, context) => {
    context.log('[updateStatus] Atualizando status do pedido: ' + input.orderId);

    // Atualizar status no App Service
    try {
      const url = `${APP_CALLBACK_URL}/api/orders/${input.orderId}/status`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (!response.ok) {
        context.warn('[updateStatus] Falha ao atualizar status: ' + response.status);
      }
    } catch (error) {
      context.warn('[updateStatus] Erro ao atualizar status: ' + error.message);
    }

    // Notificar App Service
    await notifyAppService({
      eventType: 'order.approved',
      source: 'durable-updateStatus',
      payload: {
        orderId: input.orderId,
        stage: 'approved',
        status: 'approved',
        message: 'Pedido aprovado e status atualizado',
      },
      orderId: input.orderId,
      severity: 'success',
    });

    // Publicar no Service Bus Topic
    await publishToOrderEventsTopic(input, context);

    return {
      updated: true,
      orderId: input.orderId,
      status: 'approved',
      updatedAt: new Date().toISOString(),
    };
  },
});
