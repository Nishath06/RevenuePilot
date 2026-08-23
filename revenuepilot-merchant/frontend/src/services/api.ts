import axios, { AxiosInstance, AxiosError } from 'axios';

const STORE_API = import.meta.env.VITE_STORE_API_URL || 'http://localhost:8000/api/v1';
const AI_API = import.meta.env.VITE_AI_API_URL || 'http://localhost:8001';

function createClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 15000 });

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('merchant_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (r) => r,
    async (err: AxiosError) => {
      const config = err.config as any;
      if (err.response?.status === 401) {
        localStorage.removeItem('merchant_token');
        window.location.href = '/login';
        return Promise.reject(err);
      }
      if (!config._retry && err.response?.status && err.response.status >= 500) {
        config._retry = true;
        await new Promise(r => setTimeout(r, 800));
        return client(config);
      }
      return Promise.reject(err);
    }
  );
  return client;
}

export const storeClient = createClient(STORE_API);
export const aiClient = createClient(AI_API);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginPayload { email: string; password: string; }
export interface AuthUser { id: string; name: string; email: string; role: string; }
export interface LoginResponse { access_token: string; token_type: string; user: AuthUser; }

export const authAPI = {
  login: (data: LoginPayload) => storeClient.post<LoginResponse>('/auth/login', data),
  me: () => storeClient.get<AuthUser>('/auth/me'),
};

export const aiAPI = {
  health: () => aiClient.get('/health'),
  today: (fresh = false) => aiClient.get('/insights/today', { params: fresh ? { fresh: 'true' } : {} }),
  week: () => aiClient.get('/insights/week'),
  month: () => aiClient.get('/insights/month'),
  payments: () => aiClient.get('/insights/payments'),
  inventory: () => aiClient.get('/insights/inventory'),
  customers: () => aiClient.get('/insights/customers'),
  recovery: () => aiClient.get('/merchant/recovery'),
  events: () => aiClient.get('/merchant/events'),
  prompts: () => aiClient.get('/merchant/prompts'),
  chat: (message: string) => aiClient.post('/chat', { message }),
  
  // Task 13 Endpoints
  revenueMetrics: () => aiClient.get('/merchant/revenue-metrics'),
  paymentMetrics: () => aiClient.get('/merchant/payment-metrics'),
  orderMetrics: () => aiClient.get('/merchant/order-metrics'),
  customerMetrics: () => aiClient.get('/merchant/customer-metrics'),
  inventoryMetrics: () => aiClient.get('/merchant/inventory-metrics'),
  forecastMetrics: () => aiClient.get('/merchant/forecast'),
  incidentMetrics: () => aiClient.get('/merchant/incidents'),
  webhookMetrics: () => aiClient.get('/merchant/webhooks'),
};

// ─── AutoOps Automation APIs ──────────────────────────────────────────────────
export const automationAPI = {
  rules: () => aiClient.get('/automation/rules'),
  createRule: (data: any) => aiClient.post('/automation/rules', data),
  updateRule: (id: string, updates: any) => aiClient.put(`/automation/rules/${id}`, updates),
  deleteRule: (id: string) => aiClient.delete(`/automation/rules/${id}`),
  events: () => aiClient.get('/automation/events'),
  history: () => aiClient.get('/automation/history'),
  incidents: () => aiClient.get('/automation/incidents'),
  metrics: () => aiClient.get('/automation/metrics'),
  testEvent: (data: any) => aiClient.post('/automation/test-event', data),
  awsHealth: () => aiClient.get('/automation/aws-health'),
  triggerInventoryWatchdog: () => aiClient.post('/automation/watchdog/inventory'),
  triggerRevenueWatchdog: () => aiClient.post('/automation/watchdog/revenue'),

  // Day 5 DevOps & Observability APIs
  observability: () => aiClient.get('/automation/observability'),
  auditLogs: () => aiClient.get('/automation/audit-logs'),
  healthScore: () => aiClient.get('/automation/health-score'),
  topology: () => aiClient.get('/automation/topology'),
  cicd: () => aiClient.get('/automation/cicd'),
  securityPerformance: () => aiClient.get('/automation/security-performance'),
  generateReport: (data: any) => aiClient.post('/automation/reports/generate', data),
  dlqEvents: () => aiClient.get('/automation/dlq'),

  // Day 6 Production Sprint APIs
  conversations: () => aiClient.get('/automation/ai/conversations'),
  createConversation: (data?: any) => aiClient.post('/automation/ai/conversations', data || {}),
  getConversation: (id: string) => aiClient.get(`/automation/ai/conversations/${id}`),
  deleteConversation: (id: string) => aiClient.delete(`/automation/ai/conversations/${id}`),
  aiPreferences: () => aiClient.get('/automation/ai/preferences'),
  updateAiPreferences: (data: any) => aiClient.post('/automation/ai/preferences', data),
  aiAnalytics: () => aiClient.get('/automation/ai/analytics'),
  watchdogs: () => aiClient.get('/automation/watchdogs'),
  schedules: () => aiClient.get('/automation/schedules'),
  toggleSchedule: (id: string, enabled: boolean) => aiClient.post(`/automation/schedules/${id}/toggle`, { enabled }),
  runScheduleNow: (id: string) => aiClient.post(`/automation/schedules/${id}/run`),
  timeline: (category?: string) => aiClient.get('/automation/timeline', { params: { category } }),
  simulateScenario: (data: any) => aiClient.post('/automation/simulate', data),
};

// ─── Store Merchant APIs ──────────────────────────────────────────────────────
export const merchantAPI = {
  summary: () => storeClient.get('/merchant/summary'),
  orders: (params?: Record<string, string | number>) => storeClient.get('/merchant/orders', { params }),
  payments: () => storeClient.get('/merchant/payments'),
  events: () => storeClient.get('/merchant/events'),
};
