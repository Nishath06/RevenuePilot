import { api } from './api';
import { Order, RazorpayOrderResponse } from '../types';

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

  getOrders: async (): Promise<Order[]> => {
    const res = await api.get('/orders');
    return res.data;
  },

  getOrderById: async (orderId: string): Promise<Order> => {
    const res = await api.get(`/orders/${orderId}`);
    return res.data;
  },
};
