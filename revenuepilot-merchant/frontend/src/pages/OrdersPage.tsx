import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { merchantAPI } from '../services/api';
import { ShoppingBag, CreditCard, Clock, CheckCircle, TrendingUp, AlertTriangle, XCircle, Ban, RefreshCw } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [o, s] = await Promise.all([
        merchantAPI.orders(),
        merchantAPI.summary(),
      ]);
      setOrders(Array.isArray(o.data) ? o.data : o.data?.orders ?? []);
      setSummary(s.data);
    } catch (err) {
      console.error('Failed to load merchant orders', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const getStatusBadge = (paymentStatus: string, orderStatus?: string) => {
    const status = paymentStatus || orderStatus || 'Pending';
    switch (status.toLowerCase()) {
      case 'paid':
        return (
          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 w-fit">
            <CheckCircle className="w-3 h-3 text-emerald-400" /> PAID
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 w-fit">
            <XCircle className="w-3 h-3 text-rose-400" /> FAILED
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 w-fit">
            <Ban className="w-3 h-3 text-amber-400" /> CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 w-fit">
            <Clock className="w-3 h-3 text-indigo-400 animate-pulse" /> PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Orders Lifecycle</h1>
          <p className="text-xs text-slate-400 mt-1">Live order breakdown from MongoDB</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-[#1E293B] hover:bg-white/5 rounded-xl text-slate-300 text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Paid Orders" value={summary?.paid_orders ?? 0} icon={CheckCircle} color="emerald" loading={loading} index={0} />
        <KPICard label="Failed Orders" value={summary?.failed_payments ?? 0} icon={XCircle} color="rose" loading={loading} index={1} />
        <KPICard label="Cancelled Orders" value={summary?.cancelled_orders ?? 0} icon={Ban} color="amber" loading={loading} index={2} />
        <KPICard label="Pending Orders" value={summary?.pending_orders ?? 0} icon={Clock} color="indigo" loading={loading} index={3} />
        <KPICard label="Total Revenue" value={`₹${(summary?.total_revenue ?? 0).toLocaleString('en-IN')}`} icon={TrendingUp} color="emerald" loading={loading} index={4} />
        <KPICard label="Total Orders" value={summary?.total_orders ?? orders.length} icon={ShoppingBag} color="cyan" loading={loading} index={5} />
      </div>

      {/* Recent Orders Table */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-[#1E293B] flex justify-between items-center">
          <h3 className="text-sm font-bold text-white">All Orders ({orders.length})</h3>
          <span className="text-[10px] text-slate-500 font-mono">Sorted by Created At (Desc)</span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-[#1E293B]/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No orders found in MongoDB.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px] bg-[#161F30]">
                  <th className="px-5 py-3.5 font-bold">Order ID</th>
                  <th className="px-5 py-3.5 font-bold">Customer</th>
                  <th className="px-5 py-3.5 font-bold">Items</th>
                  <th className="px-5 py-3.5 font-bold">Amount</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {orders.map((o: any, i: number) => {
                  const displayOrderId = o.order_id || o.razorpay_order_id || (o._id ? String(o._id).slice(-8) : 'N/A');
                  const customerName = o.customer_name || o.user_name || (o.user_id ? `Customer ${o.user_id.slice(-6)}` : 'Customer');
                  const customerEmail = o.customer_email || o.user_email || '';

                  return (
                    <motion.tr
                      key={o.order_id || o._id || i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Order ID */}
                      <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">
                        {displayOrderId}
                        {o.razorpay_order_id && o.razorpay_order_id !== displayOrderId && (
                          <span className="block text-[10px] text-slate-500 font-mono font-normal">
                            {o.razorpay_order_id}
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-white block">{customerName}</span>
                        {customerEmail && (
                          <span className="text-[10px] text-slate-500 block">{customerEmail}</span>
                        )}
                      </td>

                      {/* Items */}
                      <td className="px-5 py-3.5 text-slate-300 font-medium">
                        {o.items_count ?? o.items?.length ?? 1} item(s)
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 font-extrabold text-white text-sm">
                        ₹{(o.total_amount ?? 0).toLocaleString('en-IN')}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        {getStatusBadge(o.payment_status, o.order_status)}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                        {o.created_at ? new Date(o.created_at).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        }) : '—'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
