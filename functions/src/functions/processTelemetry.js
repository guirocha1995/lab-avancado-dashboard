/**
 * processTelemetry - Event Hub Trigger (telemetry-hub)
 *
 * ============================================================================
 * CONCEITO: Event Hub Trigger - Processamento em Lote (Batch)
 * ============================================================================
 *
 * O Event Hub Trigger recebe LOTES de eventos (batch), diferente de triggers
 * que processam uma mensagem por vez. Isso acontece porque o Event Hub eh
 * otimizado para alto throughput - seria ineficiente processar 1 evento
 * por vez quando podem chegar centenas por segundo.
 *
 * O parametro "cardinality: many" indica que a funcao recebe um ARRAY
 * de eventos. O tamanho do lote eh controlado por maxBatchSize no host.json.
 *
 * CONCEITO: Telemetria em Tempo Real
 * ====================================
 * Em um cenario real de varejo, telemetria inclui:
 * - Dados de sensores IoT (temperatura de geladeiras, contadores de pessoas)
 * - Eventos de PDV (vendas, cancelamentos, trocas)
 * - Metricas de performance de sistemas
 * - Dados de rastreamento de entregas
 *
 * O Event Hub ingere todos esses dados em alta escala e esta function
 * processa em lotes, extraindo metricas agregadas e enviando resumos
 * para o dashboard em tempo real.
 *
 * @module processTelemetry
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
        '[processTelemetry] Falha ao notificar App Service: ' +
        response.status + ' ' + response.statusText
      );
    }
  } catch (error) {
    context.warn('[processTelemetry] Erro ao notificar App Service: ' + error.message);
  }
}

/**
 * Registra o Event Hub Trigger no Azure Functions v4.
 *
 * O parametro 'connection' referencia a app setting que contem a connection
 * string do Event Hubs Namespace. O 'eventHubName' eh o nome do hub
 * dentro do namespace.
 *
 * cardinality: 'many' indica que a function recebe um array de eventos.
 */
app.eventHub('processTelemetry', {
  connection: 'EVENTHUBS_CONNECTION_STRING',
  eventHubName: 'telemetry-hub',
  consumerGroup: '$Default',
  cardinality: 'many',
  handler: async (events, context) => {
    const startTime = Date.now();

    context.log('=== processTelemetry: Lote recebido ===');
    context.log('Eventos no lote: ' + events.length);

    try {
      // --- 1. Agregar dados do lote ---
      let validEvents = 0;
      const eventTypes = {};
      let totalValue = 0;
      let valueCount = 0;

      for (const event of events) {
        if (!event) {
          continue;
        }

        validEvents++;

        // Contar tipos de evento
        const eventType = event.type || event.eventType || 'unknown';
        eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;

        // Agregar valores numericos (se existirem)
        if (typeof event.value === 'number') {
          totalValue += event.value;
          valueCount++;
        } else if (typeof event.quantity === 'number') {
          totalValue += event.quantity;
          valueCount++;
        }
      }

      const avgValue = valueCount > 0
        ? +(totalValue / valueCount).toFixed(2)
        : 0;

      const processingTimeMs = Date.now() - startTime;

      // --- 2. Montar resumo do lote ---
      const summary = {
        batchSize: events.length,
        validEvents: validEvents,
        eventTypes: eventTypes,
        avgValue: avgValue,
        processingTimeMs: processingTimeMs,
      };

      context.log('[processTelemetry] Resumo do lote: ' + JSON.stringify(summary));

      // --- 3. Notificar App Service com o resumo ---
      await notifyAppService({
        eventType: 'telemetry.received',
        source: 'function-processTelemetry',
        payload: {
          batchSize: events.length,
          validEvents: validEvents,
          eventTypes: Object.keys(eventTypes),
          avgValue: avgValue,
          processingTimeMs: processingTimeMs,
        },
        severity: 'info',
      }, context);

      context.log('=== processTelemetry: Processamento concluido em ' + processingTimeMs + 'ms ===');

    } catch (error) {
      context.error('[processTelemetry] Erro ao processar telemetria: ' + error.message);
      throw error;
    }
  },
});
