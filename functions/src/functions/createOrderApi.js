/**
 * createOrderApi - HTTP Trigger via APIM Gateway
 *
 * ============================================================================
 * CONCEITO: API Gateway Pattern (APIM -> Function -> Service Bus)
 * ============================================================================
 *
 * Esta function eh o ponto de entrada HTTP para criacao de pedidos quando
 * o fluxo passa pelo Azure API Management (APIM). O APIM roteia a requisicao
 * POST /orders para esta function, que entao envia a mensagem para a fila
 * "order-queue" do Service Bus.
 *
 * Fluxo:
 * 1. App Service envia POST para APIM com Ocp-Apim-Subscription-Key
 * 2. APIM valida a subscription key e roteia para esta function
 * 3. Esta function recebe o pedido via HTTP POST
 * 4. Envia a mensagem para a fila order-queue do Service Bus
 * 5. Notifica o App Service via callback (POST /api/events/notify)
 * 6. Retorna 202 Accepted
 *
 * @module createOrderApi
 */

const { app } = require('@azure/functions');
const { ServiceBusClient } = require('@azure/service-bus');

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || 'http://localhost:3001';

/**
 * Envia notificacao de evento para o App Service via HTTP POST.
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
        '[createOrderApi] Falha ao notificar App Service: ' +
        response.status + ' ' + response.statusText
      );
    }
  } catch (error) {
    context.warn('[createOrderApi] Erro ao notificar App Service: ' + error.message);
  }
}

app.http('createOrderApi', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'createOrder',
  handler: async (request, context) => {
    context.log('=== createOrderApi: Requisicao recebida via APIM ===');

    try {
      const orderData = await request.json();

      if (!orderData || !orderData.orderId) {
        return {
          status: 400,
          jsonBody: { error: 'Dados do pedido invalidos. orderId eh obrigatorio.' },
        };
      }

      context.log('[createOrderApi] OrderId: ' + orderData.orderId);

      // Enviar para Service Bus Queue
      const connectionString = process.env.SERVICEBUS_CONNECTION_STRING;
      if (!connectionString) {
        context.error('[createOrderApi] SERVICEBUS_CONNECTION_STRING nao configurada');
        return {
          status: 500,
          jsonBody: { error: 'Service Bus nao configurado' },
        };
      }

      const client = new ServiceBusClient(connectionString);
      const sender = client.createSender('order-queue');

      try {
        await sender.sendMessages({
          body: {
            orderId: orderData.orderId,
            customerName: orderData.customerName,
            totalAmount: orderData.totalAmount,
            items: orderData.items,
            createdAt: orderData.createdAt || new Date().toISOString(),
          },
          contentType: 'application/json',
          subject: 'order.created',
        });

        context.log('[createOrderApi] Mensagem enviada para order-queue');
      } finally {
        await sender.close();
        await client.close();
      }

      // Notificar App Service que o pedido foi enfileirado via APIM
      await notifyAppService({
        eventType: 'order.queued',
        source: 'apim-gateway',
        payload: {
          orderId: orderData.orderId,
          customerName: orderData.customerName,
          totalAmount: orderData.totalAmount,
          itemCount: orderData.items ? orderData.items.length : 0,
        },
        orderId: orderData.orderId,
        severity: 'info',
      }, context);

      context.log('=== createOrderApi: Pedido enfileirado com sucesso ===');

      return {
        status: 202,
        jsonBody: {
          message: 'Pedido recebido e enfileirado para processamento',
          orderId: orderData.orderId,
        },
      };
    } catch (error) {
      context.error('[createOrderApi] Erro: ' + error.message);
      return {
        status: 500,
        jsonBody: { error: 'Falha ao processar pedido: ' + error.message },
      };
    }
  },
});
