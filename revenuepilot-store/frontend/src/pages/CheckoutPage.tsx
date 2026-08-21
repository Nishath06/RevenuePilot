import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { checkoutService } from '../services/checkout.service';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

declare global {
  interface Window {
    Razorpay: any;
  }
}

/**
 * Reusable helper to safely load the Razorpay Checkout SDK script once.
 */
const loadRazorpaySdk = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window.Razorpay !== 'undefined') {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const CheckoutPage: React.FC = () => {
  const { items, subtotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleInitiatePayment = async () => {
    if (loading) return; // Prevent double-clicking
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Load Razorpay SDK
      const sdkLoaded = await loadRazorpaySdk();
      if (!sdkLoaded) {
        setErrorMsg('Unable to load Razorpay Checkout SDK.');
        setLoading(false);
        return;
      }

      // 2. Call Backend to create Razorpay Order
      const rzpOrderResponse = await checkoutService.createOrder();

      // 3. Configure Razorpay Standard Checkout Options
      const options = {
        key: rzpOrderResponse.key,
        amount: rzpOrderResponse.amount,
        currency: rzpOrderResponse.currency || 'INR',
        name: 'RevenuePilot Store',
        description: 'Electronics Purchase',
        image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200&auto=format&fit=crop&q=80',
        order_id: rzpOrderResponse.razorpay_order_id,
        handler: async (response: any) => {
          await handlePaymentVerification(
            rzpOrderResponse.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
          );
        },
        prefill: {
          name: 'RevenuePilot Test User',
          email: 'test@revenuepilot.dev',
          contact: '9999999999',
        },
        notes: {
          order_id: rzpOrderResponse.order_id,
          user_id: user?.id || '',
        },
        theme: {
          color: '#059669',
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setErrorMsg('Payment cancelled by user.');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        const desc = response.error?.description || 'Payment execution failed.';
        setErrorMsg(`Payment failed: ${desc}`);
        setLoading(false);
      });

      // 4. Immediately open Razorpay Checkout Modal
      rzp.open();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to initialize Razorpay checkout.');
      setLoading(false);
    }
  };

  const handlePaymentVerification = async (
    rzpOrderId: string,
    rzpPaymentId: string,
    rzpSignature: string
  ) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await checkoutService.verifyPayment(rzpOrderId, rzpPaymentId, rzpSignature);
      await clearCart();
      setSuccessMsg('Payment verified! Your order was placed successfully.');
      setTimeout(() => {
        navigate('/orders');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Payment signature verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-200">
          <CreditCard className="w-3.5 h-3.5" /> Razorpay Standard Checkout
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900">Secure Checkout</h1>
        <p className="text-sm text-slate-500">Review your order details and proceed to payment.</p>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 space-y-8">
        
        {/* Customer Info */}
        <div className="space-y-4 border-b border-slate-100 pb-6">
          <h2 className="text-lg font-bold text-slate-900">Customer Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 block font-medium">Name</span>
              <span className="font-semibold text-slate-800">{user?.name}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 block font-medium">Email</span>
              <span className="font-semibold text-slate-800">{user?.email}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 block font-medium">Phone</span>
              <span className="font-semibold text-slate-800">{user?.phone}</span>
            </div>
          </div>
        </div>

        {/* Order Items Review */}
        <div className="space-y-4 border-b border-slate-100 pb-6">
          <h2 className="text-lg font-bold text-slate-900">Order Items</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.product_id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-xs">
                    {item.quantity}x
                  </span>
                  <span className="text-slate-800 font-medium">{item.title}</span>
                </div>
                <span className="font-bold text-slate-900">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-between items-baseline">
            <span className="text-base font-bold text-slate-900">Total Payment</span>
            <span className="text-2xl font-extrabold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Single Payment Action Button */}
        <div className="space-y-4">
          <button
            onClick={handleInitiatePayment}
            disabled={loading || items.length === 0}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-base active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Initializing Razorpay Checkout...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Pay ₹{subtotal.toLocaleString('en-IN')} with Razorpay
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Razorpay HMAC SHA256 Signature Verification Protected</span>
          </div>
        </div>

      </div>

    </div>
  );
};
