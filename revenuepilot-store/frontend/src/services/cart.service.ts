import { api } from './api';
import { Cart } from '../types';

export const cartService = {
  getCart: async (): Promise<Cart> => {
    const res = await api.get('/cart');
    return res.data;
  },

  addItem: async (productId: string, quantity: number = 1): Promise<Cart> => {
    const res = await api.post('/cart/items', { product_id: productId, quantity });
    return res.data;
  },

  updateItem: async (productId: string, quantity: number): Promise<Cart> => {
    const res = await api.patch(`/cart/items/${productId}`, { quantity });
    return res.data;
  },

  removeItem: async (productId: string): Promise<Cart> => {
    const res = await api.delete(`/cart/items/${productId}`);
    return res.data;
  },

  clearCart: async (): Promise<Cart> => {
    const res = await api.delete('/cart');
    return res.data;
  },
};
