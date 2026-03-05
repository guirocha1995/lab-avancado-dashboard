/**
 * sendTestTelemetry - HTTP Trigger (POST /api/sendTelemetry)
 *
 * ============================================================================
 * CONCEITO: Simulador de Telemetria para Testes
 * ============================================================================
 *
 * Em producao, os dados de telemetria seriam gerados automaticamente por
 * sensores IoT, sistemas de PDV e outros dispositivos. Para fins didaticos,
 * esta function permite que o aluno envie dados de telemetria de teste
 * para o Event Hub com um unico request HTTP.
 *
 * Ao chamar POST /api/sendTelemetry, a function:
 * 1. Gera 10 eventos de telemetria simulados (temperatura, umidade, contagem)
 * 2. Envia todos os eventos em um batch para o Event Hub "telemetry-hub"
 * 3. Retorna o numero de eventos enviados
 *
 * O Event Hub Trigger (processTelemetry) recebe esses eventos automaticamente
 * e os processa em lote, enviando resumos para o dashboard.
 *
 * CONCEITO: Event Hub Producer
 * ============================
 * O EventHubProducerClient do SDK @azure/event-hubs eh usado para enviar
 * eventos para o Event Hub. O envio em batch (createBatch + tryAdd) eh
 * mais eficiente do que enviar eventos individualmente, pois reduz o
 * numero de chamadas de rede.
 *
 * @module sendTestTelemetry
 */

const { app } = require('@azure/functions');
const { EventHubProducerClient } = require('@azure/event-hubs');

/**
 * Gera um numero aleatorio entre min e max (inclusive).
 *
 * @param {number} min - Valor minimo
 * @param {number} max - Valor maximo
 * @returns {number} Numero aleatorio com 1 casa decimal
 */
function randomBetween(min, max) {
  return +(min + Math.random() * (max - min)).toFixed(1);
}

/**
 * Gera 10 eventos de telemetria simulados representando dados de sensores
 * de uma loja de varejo.
 *
 * @returns {object[]} Array de 10 eventos de telemetria
 */
function generateSampleEvents() {
  const storeIds = ['loja-centro', 'loja-norte', 'loja-sul'];
  const sensorTypes = ['temperature', 'humidity', 'people-count', 'sales-counter', 'energy'];
  const events = [];

  for (let i = 0; i < 10; i++) {
    const sensorType = sensorTypes[i % sensorTypes.length];
    const storeId = storeIds[i % storeIds.length];

    let value;
    let unit;
    switch (sensorType) {
      case 'temperature':
        value = randomBetween(18.0, 28.0);
        unit = 'celsius';
        break;
      case 'humidity':
        value = randomBetween(35.0, 65.0);
        unit = 'percent';
        break;
      case 'people-count':
        value = Math.floor(randomBetween(10, 150));
        unit = 'people';
        break;
      case 'sales-counter':
        value = Math.floor(randomBetween(1, 50));
        unit = 'transactions';
        break;
      case 'energy':
        value = randomBetween(100.0, 500.0);
        unit = 'kwh';
        break;
      default:
        value = randomBetween(0, 100);
        unit = 'unknown';
    }

    events.push({
      sensorId: 'SENSOR-' + storeId.toUpperCase() + '-' + String(i + 1).padStart(2, '0'),
      storeId: storeId,
      type: sensorType,
      value: value,
      unit: unit,
      timestamp: new Date().toISOString(),
    });
  }

  return events;
}

app.http('sendTestTelemetry', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sendTelemetry',
  handler: async (request, context) => {
    context.log('=== sendTestTelemetry: Gerando eventos de teste ===');

    const connectionString = process.env.EVENTHUBS_CONNECTION_STRING;
    if (!connectionString) {
      return {
        status: 500,
        jsonBody: {
          error: 'EVENTHUBS_CONNECTION_STRING nao configurada',
          message: 'Configure a connection string do Event Hubs nas Application Settings do Function App',
        },
      };
    }

    let producer;
    try {
      // --- 1. Gerar eventos de teste ---
      const events = generateSampleEvents();
      context.log('[sendTestTelemetry] ' + events.length + ' eventos gerados');

      // --- 2. Criar producer e batch ---
      producer = new EventHubProducerClient(connectionString, 'telemetry-hub');
      const batch = await producer.createBatch();

      let addedCount = 0;
      for (const event of events) {
        const added = batch.tryAdd({ body: event });
        if (added) {
          addedCount++;
        } else {
          context.warn('[sendTestTelemetry] Evento nao coube no batch (limite de tamanho)');
        }
      }

      // --- 3. Enviar batch para o Event Hub ---
      await producer.sendBatch(batch);
      context.log('[sendTestTelemetry] ' + addedCount + ' eventos enviados ao Event Hub');

      return {
        status: 200,
        jsonBody: {
          message: 'Eventos de telemetria enviados com sucesso',
          totalGenerated: events.length,
          totalSent: addedCount,
          eventHub: 'telemetry-hub',
          sampleEvent: events[0],
          timestamp: new Date().toISOString(),
        },
      };

    } catch (error) {
      context.error('[sendTestTelemetry] Erro: ' + error.message);
      return {
        status: 500,
        jsonBody: {
          error: 'Erro ao enviar telemetria para o Event Hub',
          details: error.message,
        },
      };
    } finally {
      if (producer) {
        await producer.close();
      }
    }
  },
});
