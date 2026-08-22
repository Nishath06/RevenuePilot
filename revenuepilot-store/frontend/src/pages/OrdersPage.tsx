import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Ban } from 'lucide-react';
import { checkoutService } from '../services/checkout.service';
import { Order } from '../types';
import { Link } from 'react-router-dom';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = () => {
    setLoading(true);
    checkoutService
      .getOrders()
      .then((data) => setOrders(data))
      .catch((err) => {
        console.error(err);
        setErrorMsg(err.response?.data?.detail || 'Failed to fetch order history.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancelOrder = async (razorpayOrderId: string) => {
    setCancellingId(razorpayOrderId);
    try {
      await checkoutService.updatePaymentStatus({
        razorpay_order_id: razorpayOrderId,
        payment_status: 'cancelled',
        reason: 'Customer manually cancelled order from Order History',
      });
      fetchOrders();
    } catch (err: any) {
      console.error(err);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusPill = (status: string, labelPrefix?: string) => {
    const text = labelPrefix ? `${labelPrefix}: ${status}` : status;
    switch (status) {
      case 'Paid':
        return (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {text}
          </span>
        );
      case 'Failed':
        return (
          <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> {text}
          </span>
        );
      case 'Cancelled':
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-500" /> {text}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600" /> {text}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div className="border-b border-slate-200/80 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Your Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Track payments and order fulfillment status.</p>
        </div>
        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
          {orders.length} {orders.length === 1 ? 'Order' : 'Orders'} Total
        </span>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Orders Placed Yet</h3>
          <p className="text-sm text-slate-500">Your completed purchases will appear here.</p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl"
          >
            Start Shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const isPending = order.payment_status === 'Pending';
            const isCancelling = cancellingId === order.razorpay_order_id;

            return (
              <div
                key={order.order_id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 space-y-6"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-extrabold text-slate-900">Order ID: {order.order_id}</span>
                      {getStatusPill(order.payment_status, 'Payment')}
                      {getStatusPill(order.order_status, 'Order')}
                    </div>
                    <p className="text-xs text-slate-400">
                      Placed on {new Date(order.created_at).toLocaleString()} • Razorpay ID: <span className="font-mono font-semibold text-indigo-600">{order.razorpay_order_id}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-400 block font-medium">Total Amount</span>
                      <span className="text-xl font-extrabold text-slate-900">₹{order.total_amount.toLocaleString('en-IN')}</span>
                    </div>
                    {isPending && (
                      <button
                        onClick={() => handleCancelOrder(order.razorpay_order_id)}
                        disabled={isCancelling}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        {isCancelling ? 'Cancelling…' : 'Cancel Order'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordered Items</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200&auto=format&fit=crop&q=80'}
                          alt={item.title}
                          className="w-12 h-12 object-cover rounded-lg bg-white border border-slate-200"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-900 line-clamp-1">{item.title}</span>
                          <span className="text-slate-500 font-medium">{item.quantity} x ₹{item.price.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
