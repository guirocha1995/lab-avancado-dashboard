/**
 * orderOrchestrator - Durable Functions Orchestrator
 *
 * ============================================================================
 * CONCEITO: Orquestracao de Pedidos com Durable Functions
 * ============================================================================
 *
 * Este orchestrator substitui o processOrder simples por um pipeline de
 * etapas visiveis. Cada etapa eh uma Activity Function que notifica o
 * App Service, permitindo que o frontend mostre o pedido fluindo pelo pipeline.
 *
 * Etapas da orquestracao:
 * 1. validateOrder     — Valida dados do pedido
 * 2. reserveStock      — Verifica e reserva estoque
 * 3. checkCredit       — Se totalAmount > 5000, chama Logic App para aprovacao
 * 4. processPayment    — Simula processamento de pagamento
 * 5. updateStatus      — Atualiza status do pedido para approved
 * 6. notifyCompletion  — Envia notificacoes finais
 *
 * @module orderOrchestrator
 */

const { app } = require('@azure/functions');
const df = require('durable-functions');

// --- Orchestrator Function ---
df.app.orchestration('orderOrchestratorFunction', function* (context) {
  const input = context.df.getInput();
  const orderId = input.orderId;

  context.df.setCustomStatus({ stage: 'started', orderId });

  // Step 1: Validate Order
  context.df.setCustomStatus({ stage: 'validating', orderId });
  const validationResult = yield context.df.callActivity('validateOrder', input);

  if (!validationResult.valid) {
    context.df.setCustomStatus({ stage: 'validation-failed', orderId });
    return { success: false, reason: 'Validation failed', orderId };
  }

  // Step 2: Reserve Stock
  context.df.setCustomStatus({ stage: 'reserving-stock', orderId });
  const stockResult = yield context.df.callActivity('reserveStock', input);

  // Step 3: Check Credit (only if totalAmount > 5000)
  context.df.setCustomStatus({ stage: 'credit-check', orderId });
  const creditResult = yield context.df.callActivity('checkCredit', input);

  if (!creditResult.approved) {
    context.df.setCustomStatus({ stage: 'credit-rejected', orderId });
    return { success: false, reason: 'Credit check rejected', orderId };
  }

  // Step 4: Process Payment
  context.df.setCustomStatus({ stage: 'processing-payment', orderId });
  const paymentResult = yield context.df.callActivity('processPayment', input);

  // Step 5: Update Status
  context.df.setCustomStatus({ stage: 'updating-status', orderId });
  const statusResult = yield context.df.callActivity('updateStatus', input);

  // Step 6: Notify Completion
  context.df.setCustomStatus({ stage: 'notifying', orderId });
  const notifyResult = yield context.df.callActivity('notifyCompletion', {
    ...input,
    paymentTransactionId: paymentResult.transactionId,
    creditMethod: creditResult.method,
    lowStockProducts: stockResult.lowStockProducts || [],
  });

  context.df.setCustomStatus({ stage: 'completed', orderId });

  return {
    success: true,
    orderId,
    validation: validationResult,
    stock: stockResult,
    credit: creditResult,
    payment: paymentResult,
    status: statusResult,
    notification: notifyResult,
  };
});

// --- Service Bus Queue Trigger (starts the orchestrator) ---
app.serviceBusQueue('orderOrchestratorStarter', {
  connection: 'SERVICEBUS_CONNECTION_STRING',
  queueName: 'order-queue',
  handler: async (message, context) => {
    context.log('=== orderOrchestratorStarter: Mensagem recebida da fila order-queue ===');
    context.log('OrderId: ' + message.orderId);

    try {
      const client = df.getClient(context);
      const instanceId = await client.startNew('orderOrchestratorFunction', {
        input: message,
      });

      context.log(
        '[orderOrchestratorStarter] Orquestracao iniciada. InstanceId: ' + instanceId
      );
    } catch (error) {
      context.error('[orderOrchestratorStarter] Erro ao iniciar orquestracao: ' + error.message);
      throw error;
    }
  },
  extraInputs: [df.input.durableClient()],
});
