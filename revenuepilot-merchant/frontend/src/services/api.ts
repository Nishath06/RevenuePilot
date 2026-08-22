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

// ─── AI Insights ─────────────────────────────────────────────────────────────
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
};

// ─── Store Merchant APIs ──────────────────────────────────────────────────────
export const merchantAPI = {
  summary: () => storeClient.get('/merchant/summary'),
  orders: (params?: Record<string, string | number>) => storeClient.get('/merchant/orders', { params }),
  payments: () => storeClient.get('/merchant/payments'),
  events: () => storeClient.get('/merchant/events'),
};
