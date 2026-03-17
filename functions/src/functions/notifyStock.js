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

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || 'http://localhost:3001';

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

      // --- 1. Notificar App Service: verificacao de estoque iniciada ---
      await notifyAppService({
        eventType: 'stock.checked',
        source: 'function-notifyStock',
        payload: {
          orderId: message.orderId,
          itemCount: items.length,
        },
        severity: 'info',
      }, context);

      // --- 2. Verificar estoque atual de cada item (GET, sem decrementar) ---
      for (const item of items) {
        context.log(
          '[notifyStock] Verificando estoque: ' + item.productId
        );

        try {
          const url = `${APP_CALLBACK_URL}/api/products/${item.productId}`;
          const response = await fetch(url);

          if (!response.ok) {
            context.warn('[notifyStock] Falha ao buscar produto ' + item.productId + ': ' + response.status);
            continue;
          }

          const product = await response.json();
          const currentStock = product.stock !== undefined ? product.stock : product.Stock;

          // --- 3. Verificar se estoque esta baixo ---
          if (currentStock !== undefined && currentStock < 10) {
            context.log(
              '[notifyStock] ESTOQUE BAIXO detectado: ' +
              item.productId + ' (estoque: ' + currentStock + ')'
            );

            await notifyAppService({
              eventType: 'stock.low',
              source: 'function-notifyStock',
              payload: {
                productId: item.productId,
                productName: item.productName || product.name || item.productId,
                currentStock: currentStock,
                orderId: message.orderId,
              },
              severity: 'warning',
            }, context);
          }
        } catch (error) {
          context.warn('[notifyStock] Erro ao verificar estoque de ' + item.productId + ': ' + error.message);
        }
      }

      context.log('=== notifyStock: Processamento concluido ===');

    } catch (error) {
      context.error('[notifyStock] Erro ao processar evento: ' + error.message);
      throw error;
    }
  },
});
