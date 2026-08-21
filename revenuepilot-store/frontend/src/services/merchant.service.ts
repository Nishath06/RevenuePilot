import { api } from './api';
import { RevenueSummary, WebhookEvent } from '../types';

export const merchantService = {
  getOrders: async () => {
    const res = await api.get('/merchant/orders');
    return res.data;
  },

  getPayments: async () => {
    const res = await api.get('/merchant/payments');
    return res.data;
  },

  getCustomers: async () => {
    const res = await api.get('/merchant/customers');
    return res.data;
  },

  getRevenueSummary: async (): Promise<RevenueSummary> => {
    const res = await api.get('/merchant/revenue-summary');
    return res.data;
  },

  getEvents: async (): Promise<WebhookEvent[]> => {
    const res = await api.get('/merchant/events');
    return res.data;
  },
};
