/**
 * notifyStock - Service Bus Topic Subscription Trigger (order-events / stock-sub)
 *
 * ============================================================================
 * CONCEITO: Service Bus Topic Subscription Trigger
 * ============================================================================
 *
 * Esta function eh disparada quando uma mensagem chega na subscription
 * "stock-sub" do topic "order-events". A subscription possui um filtro SQL
 * que so aceita mensagens com eventType = 'order.approved'.
 *
 * O fluxo eh:
 * 1. processOrder publica mensagem no topic "order-events"
 * 2. Service Bus avalia os filtros SQL de cada subscription
 * 3. "stock-sub" recebe a mensagem (filtro: eventType = 'order.approved')
 * 4. Esta function eh disparada para atualizar o estoque
 *
 * CONCEITO: Atualizacao de Estoque Desacoplada
 * =============================================
 * A atualizacao de estoque acontece de forma desacoplada do processamento
 * do pedido. O processOrder nao precisa saber como o estoque eh atualizado;
 * ele apenas publica o evento. O notifyStock consome o evento e cuida
 * da logica de estoque. Isso permite escalar e modificar cada parte
 * de forma independente.
 *
 * @module notifyStock
 */

const { app } = require('@azure/functions');

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || 'http://localhost:3000';

/**
 * Envia uma notificacao de evento para o App Service via HTTP POST.
 *
 * @param {object} event - Dados do evento
 * @param {object} context - Contexto do Azure Functions
 */
async function notifyAppService(event, context) {
  try {
    const url = `${APP_CALLBACK_URL}/api/events/notify`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      context.warn(
        '[notifyStock] Falha ao notificar App Service: ' +
        response.status + ' ' + response.statusText
      );
    }
  } catch (error) {
    context.warn('[notifyStock] Erro ao notificar App Service: ' + error.message);
  }
}

/**
 * Atualiza o estoque de um produto no App Service via HTTP PATCH.
 *
 * @param {string} productId - ID do produto
 * @param {number} quantity - Quantidade a decrementar
 * @param {object} context - Contexto do Azure Functions
 * @returns {object|null} Resposta do App Service com o novo estoque
 */
async function decrementProductStock(productId, quantity, context) {
  try {
    const url = `${APP_CALLBACK_URL}/api/products/${productId}/stock`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'decrement',
        quantity: quantity,
      }),
    });

    if (!response.ok) {
      context.warn(
        '[notifyStock] Falha ao atualizar estoque do produto ' + productId +
        ': ' + response.status
      );
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    context.warn('[notifyStock] Erro ao atualizar estoque: ' + error.message);
    return null;
  }
}

/**
 * Registra o Service Bus Topic Subscription Trigger no Azure Functions v4.
 *
 * O topicName eh o topic do Service Bus e subscriptionName eh a subscription
 * com filtro SQL. O connection referencia a app setting com a connection string.
 */
app.serviceBusTopic('notifyStock', {
  connection: 'SERVICEBUS_CONNECTION_STRING',
  topicName: 'order-events',
  subscriptionName: 'stock-sub',
  handler: async (message, context) => {
    context.log('=== notifyStock: Evento de pedido recebido ===');
    context.log('OrderId: ' + message.orderId);

    try {
      const items = message.items || [];

      // --- 1. Notificar App Service: atualizacao de estoque iniciada ---
      await notifyAppService({
        eventType: 'stock.updated',
        source: 'function-notifyStock',
        payload: {
          orderId: message.orderId,
          itemCount: items.length,
        },
        severity: 'info',
      }, context);

      // --- 2. Decrementar estoque de cada item do pedido ---
      for (const item of items) {
        context.log(
          '[notifyStock] Decrementando estoque: ' +
          item.productId + ' (qtd: ' + item.quantity + ')'
        );

        const result = await decrementProductStock(
          item.productId,
          item.quantity,
          context
        );

        // --- 3. Verificar se estoque ficou baixo ---
        if (result && result.newStock !== undefined && result.newStock < 10) {
          context.log(
            '[notifyStock] ESTOQUE BAIXO detectado: ' +
            item.productId + ' (novo estoque: ' + result.newStock + ')'
          );

          await notifyAppService({
            eventType: 'stock.low',
            source: 'function-notifyStock',
            payload: {
              productId: item.productId,
              productName: item.productName || item.productId,
              currentStock: result.newStock,
              orderId: message.orderId,
            },
            severity: 'warning',
          }, context);
        }
      }

      context.log('=== notifyStock: Processamento concluido ===');

    } catch (error) {
      context.error('[notifyStock] Erro ao processar evento: ' + error.message);
      throw error;
    }
  },
});
