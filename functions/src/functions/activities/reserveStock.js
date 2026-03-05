/**
 * reserveStock - Durable Functions Activity
 *
 * Verifica e reserva estoque para cada item do pedido.
 * Chama PATCH /api/products/{id}/stock no App Service para cada item.
 * Se algum produto ficar com estoque < 10 apos reserva, publica evento no Event Grid.
 *
 * @module activities/reserveStock
 */

const df = require('durable-functions');
const { EventGridPublisherClient, AzureKeyCredential } = require('@azure/eventgrid');

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
    console.warn('[reserveStock] Erro ao notificar App Service: ' + error.message);
  }
}

async function publishLowStockEvent(product, orderId) {
  const topicEndpoint = process.env.EVENTGRID_TOPIC_ENDPOINT;
  const topicKey = process.env.EVENTGRID_TOPIC_KEY;

  if (!topicEndpoint || !topicKey) {
    console.warn('[reserveStock] Event Grid nao configurado - skip low stock event');
    return;
  }

  try {
    const client = new EventGridPublisherClient(
      topicEndpoint,
      'CloudEvent',
      new AzureKeyCredential(topicKey)
    );

    const event = {
      type: 'inventory.low-stock',
      source: '/retail/orders/' + orderId,
      subject: 'products/' + product.productId,
      data: {
        productId: product.productId,
        productName: product.productName,
        currentStock: product.currentStock,
        orderId: orderId,
        detectedAt: new Date().toISOString(),
      },
    };

    await client.send([event]);
    console.log('[reserveStock] Evento inventory.low-stock publicado para ' + product.productId);
  } catch (error) {
    console.error('[reserveStock] Erro ao publicar evento de estoque baixo: ' + error.message);
  }
}

df.app.activity('reserveStock', {
  handler: async (input, context) => {
    context.log('[reserveStock] Reservando estoque para pedido: ' + input.orderId);

    // Notificar que a reserva de estoque iniciou
    await notifyAppService({
      eventType: 'stock.reserving',
      source: 'durable-reserveStock',
      payload: {
        orderId: input.orderId,
        stage: 'reserving-stock',
        message: 'Verificando e reservando estoque...',
        itemCount: (input.items || []).length,
      },
      orderId: input.orderId,
      severity: 'info',
    });

    const items = input.items || [];
    const lowStockProducts = [];

    // Reservar estoque para cada item
    for (const item of items) {
      try {
        const url = `${APP_CALLBACK_URL}/api/products/${item.productId}/stock`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: -(item.quantity || 0),
            reason: 'order-reservation',
            orderId: input.orderId,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const currentStock = result.stock !== undefined ? result.stock : result.Stock;

          if (currentStock !== undefined && currentStock < 10) {
            lowStockProducts.push({
              productId: item.productId,
              productName: item.productName || item.productId,
              currentStock: currentStock,
            });
          }
        } else {
          context.warn('[reserveStock] Falha ao reservar estoque para ' + item.productId + ': ' + response.status);
        }
      } catch (error) {
        context.warn('[reserveStock] Erro ao reservar estoque para ' + item.productId + ': ' + error.message);
      }
    }

    // Publicar eventos de estoque baixo no Event Grid
    for (const product of lowStockProducts) {
      await publishLowStockEvent(product, input.orderId);
    }

    // Simular tempo de processamento
    await new Promise(resolve => setTimeout(resolve, 600));

    context.log('[reserveStock] Reserva concluida. Produtos com estoque baixo: ' + lowStockProducts.length);

    return {
      reserved: true,
      orderId: input.orderId,
      lowStockProducts,
      reservedAt: new Date().toISOString(),
    };
  },
});
