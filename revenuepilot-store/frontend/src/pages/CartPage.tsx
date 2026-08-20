import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

export const CartPage: React.FC = () => {
  const { items, subtotal, fetchCart, updateItemQuantity, removeItem, clearCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    }
  }, [isAuthenticated]);

  const handleCheckoutClick = () => {
    if (!isAuthenticated) {
      navigate('/login?redirect=checkout');
    } else {
      navigate('/checkout');
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900">Your Cart is Empty</h2>
          <p className="text-slate-500 text-sm">Looks like you haven't added any electronics to your cart yet.</p>
        </div>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all"
        >
          Explore Catalog <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Shopping Cart</h1>
          <p className="text-sm text-slate-500 mt-1">{items.length} item(s) ready for checkout</p>
        </div>
        <button
          onClick={() => clearCart()}
          className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <img
                  src={item.image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80'}
                  alt={item.title}
                  className="w-20 h-20 object-cover rounded-xl border border-slate-100 bg-slate-50 flex-shrink-0"
                />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 line-clamp-1">{item.title}</h3>
                  <p className="text-xs font-medium text-slate-500">₹{item.price.toLocaleString('en-IN')} each</p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50">
                  <button
                    onClick={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                    className="px-3 py-1 text-slate-600 font-bold hover:bg-slate-200 rounded-l-xl text-sm"
                  >
                    -
                  </button>
                  <span className="px-3 text-xs font-bold text-slate-900">{item.quantity}</span>
                  <button
                    onClick={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                    className="px-3 py-1 text-slate-600 font-bold hover:bg-slate-200 rounded-r-xl text-sm"
                  >
                    +
                  </button>
                </div>

                <div className="text-right">
                  <span className="text-base font-extrabold text-slate-900 block">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  onClick={() => removeItem(item.product_id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  title="Remove item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

            </div>
          ))}

          <Link to="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 pt-2">
            <ArrowLeft className="w-4 h-4" /> Continue Shopping
          </Link>
        </div>

        {/* Summary Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-lg space-y-6 h-fit">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Order Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              <span className="font-semibold text-emerald-600">FREE</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Payment Mode</span>
              <span className="font-medium text-indigo-600">Razorpay Test Mode</span>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-base font-bold text-slate-900">Total Amount</span>
              <span className="text-2xl font-extrabold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button
            onClick={handleCheckoutClick}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-base active:scale-98"
          >
            Proceed to Checkout
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>

    </div>
  );
};
