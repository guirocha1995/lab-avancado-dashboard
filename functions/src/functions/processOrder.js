/**
 * processOrder - Service Bus Queue Trigger (order-queue)
 *
 * ============================================================================
 * CONCEITO: Pipeline de Processamento de Pedidos
 * ============================================================================
 *
 * Esta function eh o coracao do pipeline de pedidos. Quando um novo pedido
 * eh criado no App Service e enviado para a fila "order-queue" do Service Bus,
 * esta function eh disparada automaticamente para processar o pedido.
 *
 * O fluxo completo eh:
 *
 * 1. App Service cria pedido -> envia para order-queue
 * 2. Esta function recebe a mensagem (Queue Trigger)
 * 3. Notifica o App Service que o processamento iniciou (POST /api/events/notify)
 * 4. Valida o pedido e verifica estoque
 * 5. Atualiza o status do pedido para "approved" (PATCH /api/orders/{id}/status)
 * 6. Notifica o App Service que o pedido foi aprovado (POST /api/events/notify)
 * 7. Publica evento no Service Bus Topic "order-events" para notificar subscribers
 * 8. Se estoque baixo detectado, publica evento no Event Grid
 *
 * CONCEITO: Callback Pattern (Function -> App Service)
 * =====================================================
 * As Azure Functions notificam o App Service sobre cada etapa do processamento
 * atraves de chamadas HTTP (callback). O App Service usa Server-Sent Events (SSE)
 * para retransmitir essas notificacoes ao browser do usuario em tempo real.
 *
 * @module processOrder
 */

const { app } = require('@azure/functions');
const { ServiceBusClient } = require('@azure/service-bus');
const { EventGridPublisherClient, AzureKeyCredential } = require('@azure/eventgrid');

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || 'http://localhost:3000';

/**
 * Envia uma notificacao de evento para o App Service via HTTP POST.
 * O App Service redistribui essas notificacoes para os browsers conectados via SSE.
 *
 * @param {object} event - Dados do evento
 * @param {object} context - Contexto do Azure Functions (para logging)
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
        '[processOrder] Falha ao notificar App Service: ' +
        response.status + ' ' + response.statusText
      );
    }
  } catch (error) {
    context.warn('[processOrder] Erro ao notificar App Service: ' + error.message);
  }
}

/**
 * Atualiza o status de um pedido no App Service via HTTP PATCH.
 *
 * @param {string} orderId - ID do pedido
 * @param {string} status - Novo status do pedido
 * @param {object} context - Contexto do Azure Functions
 */
async function updateOrderStatus(orderId, status, context) {
  try {
    const url = `${APP_CALLBACK_URL}/api/orders/${orderId}/status`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      context.warn(
        '[processOrder] Falha ao atualizar status do pedido ' + orderId +
        ': ' + response.status
      );
    }
  } catch (error) {
    context.warn('[processOrder] Erro ao atualizar status: ' + error.message);
  }
}

/**
 * Envia uma mensagem para o Service Bus Topic "order-events".
 * Os subscribers (como notifyStock) receberao a mensagem filtrada.
 *
 * @param {object} orderData - Dados do pedido processado
 * @param {object} context - Contexto do Azure Functions
 */
async function publishToOrderEventsTopic(orderData, context) {
  const connectionString = process.env.SERVICEBUS_CONNECTION_STRING;
  if (!connectionString) {
    context.warn('[processOrder] SERVICEBUS_CONNECTION_STRING nao configurada - skip topic publish');
    return;
  }

  let client;
  try {
    client = new ServiceBusClient(connectionString);
    const sender = client.createSender('order-events');

    const message = {
      body: {
        orderId: orderData.orderId,
        items: orderData.items,
        totalAmount: orderData.totalAmount,
        status: 'approved',
        processedAt: new Date().toISOString(),
      },
      contentType: 'application/json',
      subject: 'order-approved-' + orderData.orderId,
      applicationProperties: {
        eventType: 'order.approved',
        orderId: orderData.orderId,
        totalAmount: orderData.totalAmount,
      },
    };

    await sender.sendMessages(message);
    await sender.close();
    context.log('[processOrder] Evento publicado no topic order-events');
  } catch (error) {
    context.error('[processOrder] Erro ao publicar no topic: ' + error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Publica um evento de estoque baixo no Event Grid Custom Topic.
 * Isso dispara a function handleStockAlert para notificacao urgente.
 *
 * @param {object} product - Dados do produto com estoque baixo
 * @param {string} orderId - ID do pedido que causou o estoque baixo
 * @param {object} context - Contexto do Azure Functions
 */
async function publishLowStockEvent(product, orderId, context) {
  const topicEndpoint = process.env.EVENTGRID_TOPIC_ENDPOINT;
  const topicKey = process.env.EVENTGRID_TOPIC_KEY;

  if (!topicEndpoint || !topicKey) {
    context.warn('[processOrder] Event Grid nao configurado - skip low stock event');
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
    context.log(
      '[processOrder] Evento inventory.low-stock publicado para ' +
      product.productId + ' (estoque: ' + product.currentStock + ')'
    );
  } catch (error) {
    context.error('[processOrder] Erro ao publicar evento de estoque baixo: ' + error.message);
  }
}

/**
 * Registra o Service Bus Queue Trigger no Azure Functions v4.
 *
 * A opcao 'connection' referencia o NOME da app setting que contem
 * a connection string, nao a connection string em si.
 */
app.serviceBusQueue('processOrder', {
  connection: 'SERVICEBUS_CONNECTION_STRING',
  queueName: 'order-queue',
  handler: async (message, context) => {
    context.log('=== processOrder: Mensagem recebida da fila order-queue ===');
    context.log('OrderId: ' + message.orderId);

    try {
      // --- 1. Notificar App Service: processamento iniciado ---
      await notifyAppService({
        eventType: 'order.processing',
        source: 'function-processOrder',
        payload: {
          orderId: message.orderId,
          status: 'processing',
        },
        severity: 'info',
      }, context);

      context.log('[processOrder] Notificacao de processamento enviada');

      // --- 2. Simular validacao do pedido ---
      context.log('[processOrder] Validando pedido...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // --- 3. Simular verificacao de estoque ---
      context.log('[processOrder] Verificando estoque dos itens...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // --- 4. Atualizar status do pedido para approved ---
      await updateOrderStatus(message.orderId, 'approved', context);
      context.log('[processOrder] Status do pedido atualizado para approved');

      // --- 5. Notificar App Service: pedido aprovado ---
      await notifyAppService({
        eventType: 'order.approved',
        source: 'function-processOrder',
        payload: {
          orderId: message.orderId,
          status: 'approved',
          totalAmount: message.totalAmount,
        },
        severity: 'success',
      }, context);

      context.log('[processOrder] Notificacao de aprovacao enviada');

      // --- 6. Publicar evento no Service Bus Topic "order-events" ---
      await publishToOrderEventsTopic({
        orderId: message.orderId,
        items: message.items || [],
        totalAmount: message.totalAmount || 0,
      }, context);

      // --- 7. Verificar estoque baixo e publicar no Event Grid ---
      const items = message.items || [];
      for (const item of items) {
        if (item.currentStock !== undefined && item.currentStock < 10) {
          context.log(
            '[processOrder] Estoque baixo detectado: ' +
            item.productId + ' (estoque: ' + item.currentStock + ')'
          );

          await publishLowStockEvent({
            productId: item.productId,
            productName: item.productName || item.productId,
            currentStock: item.currentStock,
          }, message.orderId, context);
        }
      }

      context.log('=== processOrder: Processamento concluido com sucesso ===');

    } catch (error) {
      context.error('[processOrder] Erro ao processar pedido: ' + error.message);
      throw error;
    }
  },
});
