import { create } from 'zustand';
import { CartItem, Product } from '../types';
import { cartService } from '../services/cart.service';

interface CartState {
  items: CartItem[];
  subtotal: number;
  isLoading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  updateItemQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  isLoading: false,

  fetchCart: async () => {
    try {
      set({ isLoading: true });
      const cart = await cartService.getCart();
      set({ items: cart.items, subtotal: cart.subtotal, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  addItem: async (product, quantity = 1) => {
    const token = localStorage.getItem('revenuepilot_token');
    if (token) {
      try {
        const cart = await cartService.addItem(product.product_id, quantity);
        set({ items: cart.items, subtotal: cart.subtotal });
        return;
      } catch (err) {
        console.error('Failed to sync item addition to backend:', err);
      }
    }

    // Client local fallback if not logged in
    const currentItems = get().items;
    const existing = currentItems.find((i) => i.product_id === product.product_id);
    let updated: CartItem[];

    if (existing) {
      updated = currentItems.map((i) =>
        i.product_id === product.product_id
          ? { ...i, quantity: i.quantity + quantity }
          : i
      );
    } else {
      updated = [
        ...currentItems,
        {
          product_id: product.product_id,
          title: product.title,
          price: product.price,
          image: product.images[0] || '',
          quantity,
        },
      ];
    }

    const newSubtotal = updated.reduce((acc, item) => acc + item.price * item.quantity, 0);
    set({ items: updated, subtotal: Math.round(newSubtotal * 100) / 100 });
  },

  updateItemQuantity: async (productId, quantity) => {
    const token = localStorage.getItem('revenuepilot_token');
    if (token) {
      try {
        const cart = await cartService.updateItem(productId, quantity);
        set({ items: cart.items, subtotal: cart.subtotal });
        return;
      } catch (err) {
        console.error('Failed to update cart quantity on backend:', err);
      }
    }

    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    const updated = get().items.map((i) =>
      i.product_id === productId ? { ...i, quantity } : i
    );
    const newSubtotal = updated.reduce((acc, item) => acc + item.price * item.quantity, 0);
    set({ items: updated, subtotal: Math.round(newSubtotal * 100) / 100 });
  },

  removeItem: async (productId) => {
    const token = localStorage.getItem('revenuepilot_token');
    if (token) {
      try {
        const cart = await cartService.removeItem(productId);
        set({ items: cart.items, subtotal: cart.subtotal });
        return;
      } catch (err) {
        console.error('Failed to remove item on backend:', err);
      }
    }

    const updated = get().items.filter((i) => i.product_id !== productId);
    const newSubtotal = updated.reduce((acc, item) => acc + item.price * item.quantity, 0);
    set({ items: updated, subtotal: Math.round(newSubtotal * 100) / 100 });
  },

  clearCart: async () => {
    const token = localStorage.getItem('revenuepilot_token');
    if (token) {
      try {
        await cartService.clearCart();
      } catch (err) {
        console.error('Failed to clear cart on backend:', err);
      }
    }
    set({ items: [], subtotal: 0 });
  },
}));
