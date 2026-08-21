export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Product {
  product_id: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  images: string[];
  price: number;
  stock: number;
  tags: string[];
  created_at: string;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
}

export interface CartItem {
  product_id: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
}

export interface Cart {
  user_id: string;
  items: CartItem[];
  subtotal: number;
  updated_at: string;
}

export interface OrderItem {
  product_id: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
}

export interface RazorpayOrderResponse {
  order_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key: string;
}

export interface Order {
  order_id: string;
  user_id: string;
  items: OrderItem[];
  total_amount: number;
  currency: string;
  razorpay_order_id: string;
  payment_status: 'Pending' | 'Paid' | 'Failed' | 'Cancelled';
  order_status: 'Pending' | 'Paid' | 'Failed' | 'Cancelled';
  created_at: string;
}

export interface RevenueSummary {
  total_orders: number;
  total_revenue: number;
  paid_orders: number;
  failed_payments: number;
  pending_orders: number;
}

export interface WebhookEvent {
  event_id: string;
  event_type: string;
  processed: boolean;
  payload_summary: {
    event?: string;
    contains_payment: boolean;
  };
  created_at: string;
}
