/**
 * RevenuePilot AI — Merchant AI Service
 * All calls go to the AI microservice on port 8001.
 */
import axios, { AxiosInstance, AxiosError } from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatResponse {
  agent: string;
  answer: string;
  metrics: Record<string, number | string>;
  recommendations: string[];
  execution_time_ms?: number;
}

export interface InsightRevenue {
  today?: number;
  yesterday?: number;
  this_week?: number;
  this_month?: number;
  growth_percentage?: number;
  average_order_value?: number;
  currency?: string;
}

export interface InsightOrders {
  today?: number;
  paid?: number;
  pending?: number;
  this_week?: number;
  cancelled?: number;
  total?: number;
}

export interface InsightPayments {
  success_rate?: number;
  failed?: number;
  successful?: number;
  method_breakdown?: Array<{ method: string; count: number; amount: number }>;
}

export interface InsightCustomers {
  abandoned_carts?: number;
  repeat_customers?: number;
  first_time_customers?: number;
  inactive_customers?: number;
  abandoned_cart_value?: number;
  top_customers?: CustomerProfile[];
}

export interface CustomerProfile {
  user_id: string;
  name: string;
  email: string;
  total_orders: number;
  total_spent: number;
  last_order_at?: string;
}

export interface TodayInsights {
  period: string;
  revenue: InsightRevenue;
  orders: InsightOrders;
  payments: InsightPayments;
  customers: InsightCustomers;
  recommendations: string[];
}

export interface InventoryInsights {
  low_stock_count: number;
  out_of_stock_count: number;
  low_stock_products: ProductStock[];
  out_of_stock_products: ProductStock[];
  best_selling: SalesRank[];
  category_revenue: Record<string, number>;
}

export interface ProductStock {
  product_id: string;
  title: string;
  stock: number;
  price: number;
  category: string;
}

export interface SalesRank {
  product_id: string;
  title: string;
  units_sold: number;
  revenue: number;
  category: string;
}

export interface CartSnapshot {
  user_id: string;
  items_count: number;
  subtotal: number;
  updated_at?: string;
}

export interface RecoveryData {
  failed_payments: Array<{ count: number; note?: string }>;
  abandoned_carts: CartSnapshot[];
  whatsapp_messages: string[];
  email_messages: string[];
  priority_customers: CustomerProfile[];
  total_recoverable_amount: number;
}

export interface PromptChip {
  label: string;
  query: string;
  category: string;
  icon: string;
}

export interface AIHealthStatus {
  status: string;
  mongodb: string;
  ai_ready: boolean;
  version: string;
  environment: string;
  uptime_seconds?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Axios client
// ─────────────────────────────────────────────────────────────────────────────

const AI_BASE_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:8001';

const aiClient: AxiosInstance = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Retry interceptor — retry once on network failure
aiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as typeof error.config & { _retried?: boolean };
    if (!config?._retried && (error.code === 'ECONNABORTED' || !error.response)) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 1000));
      return aiClient(config);
    }
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Service methods
// ─────────────────────────────────────────────────────────────────────────────

export const merchantAIService = {
  /** Check if the AI service is reachable */
  async getHealth(): Promise<AIHealthStatus> {
    const { data } = await aiClient.get<AIHealthStatus>('/health');
    return data;
  },

  /** Post a natural-language question to the multi-agent system */
  async askAI(message: string): Promise<ChatResponse> {
    const { data } = await aiClient.post<ChatResponse>('/chat', { message });
    return data;
  },

  /** Today's full business insight snapshot */
  async getTodayInsights(): Promise<TodayInsights> {
    const { data } = await aiClient.get<TodayInsights>('/insights/today');
    return data;
  },

  /** This week's business insight summary */
  async getWeeklyInsights(): Promise<TodayInsights> {
    const { data } = await aiClient.get<TodayInsights>('/insights/week');
    return data;
  },

  /** Inventory intelligence */
  async getInventoryInsights(): Promise<InventoryInsights> {
    const { data } = await aiClient.get<InventoryInsights>('/insights/inventory');
    return data;
  },

  /** Customer metrics */
  async getCustomerInsights(): Promise<InsightCustomers & { repeat_customers: number }> {
    const { data } = await aiClient.get('/insights/customers');
    return data;
  },

  /** Recovery data — abandoned carts + failed payments + messages */
  async getRecoverySuggestions(): Promise<RecoveryData> {
    const { data } = await aiClient.get<RecoveryData>('/merchant/recovery');
    return data;
  },

  /** Full KPI snapshot for dashboard initialization */
  async getDashboardSnapshot(): Promise<Record<string, unknown>> {
    const { data } = await aiClient.get('/merchant/snapshot');
    return data;
  },

  /** Curated prompt chips for the AI copilot */
  async getSuggestedPrompts(): Promise<PromptChip[]> {
    const { data } = await aiClient.get<{ prompts: PromptChip[]; total: number }>('/merchant/prompts');
    return data.prompts;
  },
};
