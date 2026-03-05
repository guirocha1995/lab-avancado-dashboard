/**
 * processPayment - Durable Functions Activity
 *
 * Simula o processamento de pagamento do pedido.
 * Inclui um delay de 1-2 segundos para simular processamento real.
 *
 * @module activities/processPayment
 */

const df = require('durable-functions');
const { randomUUID } = require('crypto');

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
    console.warn('[processPayment] Erro ao notificar App Service: ' + error.message);
  }
}

df.app.activity('processPayment', {
  handler: async (input, context) => {
    context.log('[processPayment] Processando pagamento para pedido: ' + input.orderId);

    const transactionId = randomUUID();

    // Notificar que o processamento de pagamento iniciou
    await notifyAppService({
      eventType: 'order.payment',
      source: 'durable-processPayment',
      payload: {
        orderId: input.orderId,
        stage: 'processing-payment',
        totalAmount: input.totalAmount,
        transactionId,
        message: 'Processando pagamento...',
      },
      orderId: input.orderId,
      severity: 'info',
    });

    // Simular processamento de pagamento (1-2 segundos)
    const delay = 1000 + Math.floor(Math.random() * 1000);
    await new Promise(resolve => setTimeout(resolve, delay));

    context.log('[processPayment] Pagamento processado. TransactionId: ' + transactionId);

    return {
      paid: true,
      transactionId,
      orderId: input.orderId,
      totalAmount: input.totalAmount,
      processedAt: new Date().toISOString(),
    };
  },
});
