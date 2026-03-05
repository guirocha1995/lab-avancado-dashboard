/**
 * checkCredit - Durable Functions Activity
 *
 * Verifica credito do pedido. Se totalAmount > 5000, chama Logic App
 * para aprovacao (que pode exigir revisao humana para valores > 10000).
 * Se totalAmount <= 5000, aprova automaticamente.
 *
 * @module activities/checkCredit
 */

const df = require('durable-functions');

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || 'http://localhost:3001';
const LOGIC_APP_TRIGGER_URL = process.env.LOGIC_APP_TRIGGER_URL;

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
    console.warn('[checkCredit] Erro ao notificar App Service: ' + error.message);
  }
}

df.app.activity('checkCredit', {
  handler: async (input, context) => {
    const totalAmount = input.totalAmount || 0;
    context.log('[checkCredit] Verificando credito para pedido: ' + input.orderId + ' (R$ ' + totalAmount + ')');

    // Notificar que a verificacao de credito iniciou
    await notifyAppService({
      eventType: 'order.credit-check',
      source: 'durable-checkCredit',
      payload: {
        orderId: input.orderId,
        stage: 'credit-check',
        totalAmount,
        message: totalAmount > 5000
          ? 'Verificacao de credito via Logic App (valor > R$ 5.000)...'
          : 'Aprovacao automatica de credito (valor <= R$ 5.000)...',
        requiresLogicApp: totalAmount > 5000,
      },
      orderId: input.orderId,
      severity: 'warning',
    });

    // Se valor <= 5000, aprovacao automatica
    if (totalAmount <= 5000) {
      context.log('[checkCredit] Aprovacao automatica (valor <= 5000)');
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        approved: true,
        method: 'auto',
        orderId: input.orderId,
        totalAmount,
        checkedAt: new Date().toISOString(),
      };
    }

    // Se valor > 5000, chamar Logic App
    if (!LOGIC_APP_TRIGGER_URL) {
      context.warn('[checkCredit] LOGIC_APP_TRIGGER_URL nao configurada - aprovando automaticamente');
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        approved: true,
        method: 'auto',
        reason: 'Logic App nao configurada - fallback para aprovacao automatica',
        orderId: input.orderId,
        totalAmount,
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      context.log('[checkCredit] Chamando Logic App para aprovacao de credito...');

      const response = await fetch(LOGIC_APP_TRIGGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: input.orderId,
          customerName: input.customerName,
          totalAmount: totalAmount,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        context.log('[checkCredit] Resultado Logic App: ' + JSON.stringify(result));

        return {
          approved: result.approved !== false,
          method: 'logic-app',
          reviewer: result.reviewer || 'logic-app',
          orderId: input.orderId,
          totalAmount,
          checkedAt: new Date().toISOString(),
        };
      } else {
        context.warn('[checkCredit] Logic App retornou erro: ' + response.status);
        // Fallback: aprovar em caso de erro da Logic App
        return {
          approved: true,
          method: 'auto',
          reason: 'Logic App error fallback',
          orderId: input.orderId,
          totalAmount,
          checkedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      context.error('[checkCredit] Erro ao chamar Logic App: ' + error.message);
      // Fallback: aprovar em caso de erro
      return {
        approved: true,
        method: 'auto',
        reason: 'Logic App connection error fallback',
        orderId: input.orderId,
        totalAmount,
        checkedAt: new Date().toISOString(),
      };
    }
  },
});
