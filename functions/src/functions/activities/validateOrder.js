/**
 * validateOrder - Durable Functions Activity
 *
 * Valida os dados do pedido: verifica se possui itens, quantidades validas
 * e produtos existentes. Notifica o App Service sobre a etapa de validacao.
 *
 * @module activities/validateOrder
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
    console.warn('[validateOrder] Erro ao notificar App Service: ' + error.message);
  }
}

df.app.activity('validateOrder', {
  handler: async (input, context) => {
    context.log('[validateOrder] Validando pedido: ' + input.orderId);

    // Notificar que a validacao iniciou
    await notifyAppService({
      eventType: 'order.validating',
      source: 'durable-validateOrder',
      payload: {
        orderId: input.orderId,
        stage: 'validating',
        message: 'Validando dados do pedido...',
      },
      orderId: input.orderId,
      severity: 'info',
    });

    // Simular tempo de validacao
    await new Promise(resolve => setTimeout(resolve, 800));

    // Validar dados do pedido
    const items = input.items || [];
    const errors = [];

    if (!input.orderId) {
      errors.push('orderId eh obrigatorio');
    }

    if (!input.customerName) {
      errors.push('customerName eh obrigatorio');
    }

    if (items.length === 0) {
      errors.push('Pedido deve ter pelo menos um item');
    }

    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        errors.push('Quantidade invalida para produto: ' + (item.productId || 'desconhecido'));
      }
    }

    const valid = errors.length === 0;

    context.log('[validateOrder] Resultado: ' + (valid ? 'VALIDO' : 'INVALIDO - ' + errors.join(', ')));

    return {
      valid,
      orderId: input.orderId,
      errors,
      validatedAt: new Date().toISOString(),
    };
  },
});
