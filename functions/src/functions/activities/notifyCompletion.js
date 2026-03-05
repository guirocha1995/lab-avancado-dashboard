/**
 * notifyCompletion - Durable Functions Activity
 *
 * Envia notificacao final de conclusao do processamento do pedido.
 * Esta eh a ultima etapa da orquestracao.
 *
 * @module activities/notifyCompletion
 */

const df = require('durable-functions');

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
    console.warn('[notifyCompletion] Erro ao notificar App Service: ' + error.message);
  }
}

df.app.activity('notifyCompletion', {
  handler: async (input, context) => {
    context.log('[notifyCompletion] Enviando notificacao de conclusao para pedido: ' + input.orderId);

    await notifyAppService({
      eventType: 'order.completed',
      source: 'durable-notifyCompletion',
      payload: {
        orderId: input.orderId,
        stage: 'completed',
        message: 'Processamento do pedido concluido com sucesso',
        paymentTransactionId: input.paymentTransactionId,
        creditMethod: input.creditMethod,
        lowStockProducts: input.lowStockProducts || [],
        completedAt: new Date().toISOString(),
      },
      orderId: input.orderId,
      severity: 'success',
    });

    context.log('[notifyCompletion] Notificacao de conclusao enviada');

    return {
      notified: true,
      orderId: input.orderId,
      completedAt: new Date().toISOString(),
    };
  },
});
