import type {
  Product,
  Order,
  EventLogEntry,
  DashboardMetrics,
  PipelineStage,
  CreateOrderPayload,
} from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

export async function getProducts(): Promise<Product[]> {
  return request<Product[]>('/products');
}

export async function getProduct(id: string): Promise<Product> {
  return request<Product>(`/products/${id}`);
}

export async function getOrders(): Promise<Order[]> {
  return request<Order[]>('/orders');
}

export async function getOrder(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}`);
}

export async function createOrder(data: CreateOrderPayload): Promise<Order> {
  return request<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getEvents(limit: number = 100): Promise<EventLogEntry[]> {
  return request<EventLogEntry[]>(`/events?limit=${limit}`);
}

export async function getEventStats(): Promise<Record<string, number>> {
  return request<Record<string, number>>('/events/stats');
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return request<DashboardMetrics>('/dashboard/metrics');
}

export async function getPipelineMetrics(): Promise<PipelineStage[]> {
  return request<PipelineStage[]>('/pipeline/metrics');
}
