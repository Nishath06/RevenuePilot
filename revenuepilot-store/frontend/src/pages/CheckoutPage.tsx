import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ShieldCheck, CheckCircle2, AlertCircle, Loader2, XCircle, Ban, RotateCcw, ArrowLeft } from 'lucide-react';
import { checkoutService } from '../services/checkout.service';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const loadRazorpaySdk = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window.Razorpay !== 'undefined') { resolve(true); return; }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

type PaymentState = 'idle' | 'loading' | 'success' | 'failed' | 'cancelled';

export const CheckoutPage: React.FC = () => {
  const { items, subtotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const activeRzpOrderRef = useRef<any>(null);
  const paymentCompletedRef = useRef<boolean>(false);
  const paymentFailedRef = useRef<boolean>(false);

  // ✅ Auto-cancel on unmount ONLY if neither completed nor failed
  useEffect(() => {
    return () => {
      if (activeRzpOrderRef.current && !paymentCompletedRef.current && !paymentFailedRef.current) {
        const orderId = activeRzpOrderRef.current.razorpay_order_id;
        checkoutService.updatePaymentStatus({
          razorpay_order_id: orderId,
          payment_status: 'cancelled',
          reason: 'Customer navigated away from checkout page',
        }).catch(() => {});
      }
    };
  }, []);

  const handleInitiatePayment = async () => {
    if (paymentState === 'loading') return;
    setPaymentState('loading');
    setStatusMessage('Preparing Razorpay checkout…');
    setFailureReason(null);

    // Reset payment flags for new attempt
    paymentCompletedRef.current = false;
    paymentFailedRef.current = false;

    try {
      const sdkLoaded = await loadRazorpaySdk();
      if (!sdkLoaded) {
        setPaymentState('failed');
        setStatusMessage('Unable to load Razorpay Checkout SDK. Check your network connection.');
        return;
      }

      const rzpOrderResponse = await checkoutService.createOrder();
      activeRzpOrderRef.current = rzpOrderResponse;

      const options = {
        key: rzpOrderResponse.key,
        amount: rzpOrderResponse.amount,
        currency: rzpOrderResponse.currency || 'INR',
        name: 'RevenuePilot Store',
        description: 'Electronics Purchase',
        image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200&auto=format&fit=crop&q=80',
        order_id: rzpOrderResponse.razorpay_order_id,

        // ✅ SUCCESS HANDLER
        handler: async (response: any) => {
          paymentCompletedRef.current = true;
          setPaymentState('loading');
          setStatusMessage('Verifying payment signature…');
          try {
            await checkoutService.verifyPayment(
              rzpOrderResponse.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            await clearCart();
            setPaymentState('success');
            setStatusMessage('Payment verified successfully! Redirecting to your orders…');
            setTimeout(() => navigate('/orders'), 1500);
          } catch (err: any) {
            setPaymentState('failed');
            setStatusMessage(err.response?.data?.detail || 'Payment signature verification failed.');
          }
        },

        prefill: {
          name: user?.name || 'RevenuePilot Customer',
          email: user?.email || 'customer@revenuepilot.dev',
          contact: user?.phone || '9999999999',
        },
        notes: {
          order_id: rzpOrderResponse.order_id,
          user_id: user?.id || '',
        },
        theme: { color: '#059669' },

        modal: {
          // ✅ ONDISMISS HANDLER: Fire cancellation ONLY IF not completed AND not failed!
          ondismiss: async () => {
            if (!paymentCompletedRef.current && !paymentFailedRef.current) {
              setPaymentState('cancelled');
              setStatusMessage('Razorpay payment popup closed. Order marked as Cancelled.');
              if (activeRzpOrderRef.current) {
                await checkoutService.updatePaymentStatus({
                  razorpay_order_id: activeRzpOrderRef.current.razorpay_order_id,
                  payment_status: 'cancelled',
                  reason: 'Customer closed Razorpay Checkout',
                });
              }
            }
          },
        },
      };

      const rzp = new window.Razorpay(options);

      // ✅ FAILED HANDLER: Mark payment as failed permanently
      rzp.on('payment.failed', async (response: any) => {
        paymentFailedRef.current = true; // 🔒 Guard flag: blocks modal.ondismiss from overwriting with Cancelled!

        const desc = response.error?.description || 'Payment declined by bank or gateway.';
        const code = response.error?.code || 'PAYMENT_ERROR';
        const paymentId = response.error?.metadata?.payment_id;

        setPaymentState('failed');
        setStatusMessage('Payment was declined by gateway/bank.');
        setFailureReason(desc);

        if (activeRzpOrderRef.current) {
          await checkoutService.updatePaymentStatus({
            razorpay_order_id: activeRzpOrderRef.current.razorpay_order_id,
            razorpay_payment_id: paymentId,
            payment_status: 'failed',
            reason: desc,
            error_code: code,
          });
        }
      });

      rzp.open();
    } catch (err: any) {
      setPaymentState('failed');
      setStatusMessage(err.response?.data?.detail || 'Failed to initialize Razorpay checkout.');
    }
  };

  const handleCancelOrder = async () => {
    if (activeRzpOrderRef.current && !paymentCompletedRef.current && !paymentFailedRef.current) {
      try {
        setPaymentState('loading');
        setStatusMessage('Cancelling order and returning to cart…');
        await checkoutService.updatePaymentStatus({
          razorpay_order_id: activeRzpOrderRef.current.razorpay_order_id,
          payment_status: 'cancelled',
          reason: 'Customer clicked Cancel Order & Abort Checkout',
        });
        paymentCompletedRef.current = true; // prevent unmount double call
      } catch (err: any) {
        console.error(err);
      }
    }
    setPaymentState('cancelled');
    navigate('/cart');
  };

  const isLoading = paymentState === 'loading';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/cart')}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Cart
        </button>
        <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-200">
          <CreditCard className="w-3.5 h-3.5" /> Razorpay Standard Checkout
        </div>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900">Secure Checkout</h1>
        <p className="text-sm text-slate-500">Review your order details and proceed to payment.</p>
      </div>

      {/* Status Banners */}
      {paymentState === 'failed' && statusMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl space-y-1">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <XCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>{statusMessage}</span>
          </div>
          {failureReason && (
            <p className="text-xs text-rose-500 pl-8">{failureReason}</p>
          )}
          <p className="text-xs text-rose-400 pl-8">Your cart is saved. You can try again or cancel the order.</p>
        </div>
      )}

      {paymentState === 'cancelled' && statusMessage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <Ban className="w-5 h-5 flex-shrink-0 text-amber-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {paymentState === 'success' && statusMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {isLoading && statusMessage && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
          <span>{statusMessage}</span>
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

        {/* Order Items */}
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

        {/* Payment & Cancel Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleInitiatePayment}
            disabled={isLoading || items.length === 0 || paymentState === 'success'}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-base active:scale-98"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {statusMessage || 'Processing…'}</>
            ) : paymentState === 'failed' || paymentState === 'cancelled' ? (
              <><RotateCcw className="w-5 h-5" /> Retry Payment — Pay ₹{subtotal.toLocaleString('en-IN')}</>
            ) : (
              <><CreditCard className="w-5 h-5" /> Pay ₹{subtotal.toLocaleString('en-IN')} with Razorpay</>
            )}
          </button>

          {/* Explicit Cancel Order Button -> Redirects to /cart */}
          {paymentState !== 'success' && (
            <button
              onClick={handleCancelOrder}
              disabled={isLoading}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl border border-slate-300 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Ban className="w-4 h-4 text-slate-500" /> Cancel Order & Abort Checkout
            </button>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Razorpay HMAC SHA256 Signature Verification Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
