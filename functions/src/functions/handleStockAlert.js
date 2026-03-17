/**
 * handleStockAlert - Event Grid Trigger
 *
 * ============================================================================
 * CONCEITO: Event Grid Trigger para Alertas Criticos
 * ============================================================================
 *
 * Esta function eh disparada quando um evento do tipo "inventory.low-stock"
 * chega via Event Grid. O Event Grid fornece entrega push de baixa latencia,
 * ideal para alertas que precisam de resposta imediata.
 *
 * O fluxo eh:
 * 1. processOrder detecta estoque baixo em um produto
 * 2. Publica evento "inventory.low-stock" no Event Grid Custom Topic
 * 3. Event Grid entrega o evento a esta function (push)
 * 4. Esta function notifica o App Service com severidade "error"
 * 5. O Dashboard exibe o alerta em destaque (vermelho) no painel de eventos
 *
 * CONCEITO: Event Grid vs Service Bus para Alertas
 * ==================================================
 * - Event Grid: entrega push, baixa latencia (~200ms), ideal para notificacoes
 * - Service Bus: entrega pull, garantia de processamento, ideal para tarefas
 *
 * Neste cenario, usamos Event Grid para alertas de estoque baixo porque
 * queremos notificacao IMEDIATA no dashboard. O Service Bus eh usado para
 * o processamento do pedido em si (que pode levar mais tempo).
 *
 * @module handleStockAlert
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
        '[handleStockAlert] Falha ao notificar App Service: ' +
        response.status + ' ' + response.statusText
      );
    }
  } catch (error) {
    context.warn('[handleStockAlert] Erro ao notificar App Service: ' + error.message);
  }
}

/**
 * Registra o Event Grid Trigger no Azure Functions v4.
 *
 * O evento recebido segue o schema CloudEvent (conforme publicado pelo
 * processOrder usando EventGridPublisherClient com modo 'CloudEvent').
 */
app.eventGrid('handleStockAlert', {
  handler: async (event, context) => {
    context.log('=== handleStockAlert: Evento de estoque baixo recebido ===');
    context.log('Tipo: ' + event.type + ' | Subject: ' + event.subject);

    try {
      const eventData = event.data;

      // --- 1. Log estruturado do alerta ---
      context.log('========================================');
      context.log('ALERTA CRITICO - ESTOQUE BAIXO');
      context.log('========================================');
      context.log('Produto: ' + eventData.productId + ' (' + (eventData.productName || 'N/A') + ')');
      context.log('Estoque atual: ' + eventData.currentStock);
      context.log('Pedido que causou: ' + eventData.orderId);
      context.log('Detectado em: ' + eventData.detectedAt);
      context.log('========================================');

      // --- 2. Notificar App Service com severidade error (alerta critico) ---
      await notifyAppService({
        eventType: 'stock.alert',
        source: 'function-handleStockAlert',
        payload: {
          productId: eventData.productId,
          productName: eventData.productName || eventData.productId,
          currentStock: eventData.currentStock,
          orderId: eventData.orderId,
          alertType: 'low-stock',
          detectedAt: eventData.detectedAt,
        },
        severity: 'error',
      }, context);

      context.log('[handleStockAlert] Notificacao de alerta enviada ao App Service');
      context.log('=== handleStockAlert: Processamento concluido ===');

    } catch (error) {
      context.error('[handleStockAlert] Erro ao processar alerta: ' + error.message);
      throw error;
    }
  },
});
