export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerName: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'approved' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

/**
 * Event sources include:
 * - 'service-bus'           — Service Bus Queue/Topic events
 * - 'event-grid'            — Event Grid events
 * - 'event-hubs'            — Event Hubs telemetry events
 * - 'app-service'           — App Service direct events
 * - 'functions'             — Azure Functions events (legacy)
 * - 'apim-gateway'          — APIM Gateway routed events
 * - 'durable-validateOrder' — Durable Functions: validate order step
 * - 'durable-reserveStock'  — Durable Functions: reserve stock step
 * - 'durable-checkCredit'   — Durable Functions: credit check step
 * - 'durable-processPayment'— Durable Functions: payment processing step
 * - 'durable-updateStatus'  — Durable Functions: status update step
 * - 'durable-notifyCompletion' — Durable Functions: completion notification step
 * - 'logic-app-credit'      — Logic App: credit approval
 * - 'logic-app-stock-alert' — Logic App: stock alert notification
 *
 * Event types include:
 * - 'order.created', 'order.queued', 'order.validating', 'order.credit-check',
 *   'order.payment', 'order.approved', 'order.completed'
 * - 'stock.reserving', 'stock.low', 'stock.alert.published'
 */
export interface EventLogEntry {
  id: string;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  orderId?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
}

export interface DashboardMetrics {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockCount: number;
  eventsLastHour: number;
  avgProcessingTime: number;
}

export interface PipelineStage {
  name: string;
  label: string;
  count: number;
  color: string;
  icon: string;
}

export type SSEEvent = EventLogEntry;

export interface CreateOrderPayload {
  customerName: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}
