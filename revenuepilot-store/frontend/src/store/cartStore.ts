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

const getInitialItems = (): CartItem[] => {
  try {
    const saved = localStorage.getItem('revenuepilot_cart_items');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

const getInitialSubtotal = (items: CartItem[]): number => {
  const sum = items.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);
  return Math.round(sum * 100) / 100;
};

const saveCartToStorage = (items: CartItem[], subtotal: number) => {
  try {
    localStorage.setItem('revenuepilot_cart_items', JSON.stringify(items));
    localStorage.setItem('revenuepilot_cart_subtotal', String(subtotal));
  } catch (e) {
    console.error('Failed to save cart to localStorage', e);
  }
};

const initialItems = getInitialItems();
const initialSubtotal = getInitialSubtotal(initialItems);

export const useCartStore = create<CartState>((set, get) => ({
  items: initialItems,
  subtotal: initialSubtotal,
  isLoading: false,

  fetchCart: async () => {
    const token = localStorage.getItem('revenuepilot_token');
    if (!token) return;
    try {
      set({ isLoading: true });
      const cart = await cartService.getCart();
      if (cart && Array.isArray(cart.items)) {
        const subtotal = Math.round((cart.subtotal || getInitialSubtotal(cart.items)) * 100) / 100;
        set({ items: cart.items, subtotal, isLoading: false });
        saveCartToStorage(cart.items, subtotal);
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Fetch cart error:', error);
      set({ isLoading: false });
    }
  },

  addItem: async (product: Product, quantity = 1) => {
    const productId = product.product_id || (product as any).id || (product as any)._id || 'prod_unknown';
    const title = product.title || (product as any).name || 'Electronic Item';
    const price = typeof product.price === 'number' ? product.price : parseFloat(product.price as any) || 0;
    const image = (product.images && product.images.length > 0)
      ? product.images[0]
      : ((product as any).image_url || (product as any).image || '');

    const currentItems = get().items;
    const existing = currentItems.find((i) => i.product_id === productId);
    let updatedItems: CartItem[];

    if (existing) {
      updatedItems = currentItems.map((i) =>
        i.product_id === productId ? { ...i, quantity: i.quantity + quantity } : i
      );
    } else {
      updatedItems = [
        ...currentItems,
        {
          product_id: productId,
          title,
          price,
          image,
          quantity,
        },
      ];
    }

    const newSubtotal = getInitialSubtotal(updatedItems);
    set({ items: updatedItems, subtotal: newSubtotal });
    saveCartToStorage(updatedItems, newSubtotal);

    const token = localStorage.getItem('revenuepilot_token');
    if (token) {
      try {
        const cart = await cartService.addItem(productId, quantity);
        if (cart && Array.isArray(cart.items)) {
          const subtotal = Math.round((cart.subtotal || getInitialSubtotal(cart.items)) * 100) / 100;
          set({ items: cart.items, subtotal });
          saveCartToStorage(cart.items, subtotal);
        }
      } catch (err) {
        console.warn('Backend cart sync failed, retaining local cart:', err);
      }
    }
  },

  updateItemQuantity: async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await get().removeItem(productId);
      return;
    }

    const currentItems = get().items;
    const updatedItems = currentItems.map((i) =>
      i.product_id === productId ? { ...i, quantity } : i
    );
    const newSubtotal = getInitialSubtotal(updatedItems);

    set({ items: updatedItems, subtotal: newSubtotal });
    saveCartToStorage(updatedItems, newSubtotal);

    const token = localStorage.getItem('revenuepilot_token');
    if (token) {
      try {
        const cart = await cartService.updateItem(productId, quantity);
        if (cart && Array.isArray(cart.items)) {
          const subtotal = Math.round((cart.subtotal || getInitialSubtotal(cart.items)) * 100) / 100;
          set({ items: cart.items, subtotal });
          saveCartToStorage(cart.items, subtotal);
        }
      } catch (err) {
        console.warn('Backend cart update failed, retaining local cart:', err);
      }
    }
  },

  removeItem: async (productId: string) => {
    const currentItems = get().items;
    const updatedItems = currentItems.filter((i) => i.product_id !== productId);
    const newSubtotal = getInitialSubtotal(updatedItems);

    set({ items: updatedItems, subtotal: newSubtotal });
    saveCartToStorage(updatedItems, newSubtotal);

    const token = localStorage.getItem('revenuepilot_token');
    if (token) {
      try {
        const cart = await cartService.removeItem(productId);
        if (cart && Array.isArray(cart.items)) {
          const subtotal = Math.round((cart.subtotal || getInitialSubtotal(cart.items)) * 100) / 100;
          set({ items: cart.items, subtotal });
          saveCartToStorage(cart.items, subtotal);
        }
      } catch (err) {
        console.warn('Backend cart remove failed, retaining local cart:', err);
      }
    }
  },

  clearCart: async () => {
    set({ items: [], subtotal: 0 });
    saveCartToStorage([], 0);

    const token = localStorage.getItem('revenuepilot_token');
    if (token) {
      try {
        await cartService.clearCart();
      } catch (err) {
        console.warn('Backend cart clear failed:', err);
      }
    }
  },
}));

