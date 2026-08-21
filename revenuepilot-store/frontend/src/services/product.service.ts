import { api } from './api';
import { Product, ProductListResponse } from '../types';

export const productService = {
  getProducts: async (category?: string): Promise<ProductListResponse> => {
    const params = category && category !== 'All' ? { category } : {};
    const res = await api.get('/products', { params });
    return res.data;
  },

  getProductById: async (id: string): Promise<Product> => {
    const res = await api.get(`/products/${id}`);
    return res.data;
  },

  getCategories: async (): Promise<string[]> => {
    const res = await api.get('/products/categories');
    return res.data;
  },

  searchProducts: async (query: string): Promise<ProductListResponse> => {
    const res = await api.get('/products/search', { params: { q: query } });
    return res.data;
  },
};
