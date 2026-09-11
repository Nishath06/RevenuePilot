import { api } from './api';
import { Order, RazorpayOrderResponse } from '../types';

export interface PaymentStatusPayload {
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  payment_status: 'failed' | 'cancelled';
  reason?: string;
  error_code?: string;
}

export const checkoutService = {
  createOrder: async (): Promise<RazorpayOrderResponse> => {
    const res = await api.post('/checkout/create-order', {});
    return res.data;
  },

  verifyPayment: async (
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) => {
    const res = await api.post('/checkout/verify-payment', {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    });
    return res.data;
  },

  /** Report a failed or cancelled payment so the order transitions out of Pending */
  updatePaymentStatus: async (payload: PaymentStatusPayload) => {
    try {
      const res = await api.post('/checkout/payment-status', payload);
      return res.data;
    } catch (err) {
      // Non-fatal: log but do not block the UI
      console.error('[checkout] Failed to update payment status:', err);
    }
  },

  getOrders: async (): Promise<Order[]> => {
    const res = await api.get('/orders');
    return res.data;
  },

  getOrderById: async (orderId: string): Promise<Order> => {
    const res = await api.get(`/orders/${orderId}`);
    return res.data;
  },
};
