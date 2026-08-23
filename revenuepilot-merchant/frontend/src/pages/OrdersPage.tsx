import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { OrdersBarChart } from '../components/charts/Charts';
import { aiAPI } from '../services/api';
import { ShoppingBag, Clock, CheckCircle, XCircle, Ban, RefreshCw, X, ArrowRight, Eye, Tag, FileText } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await aiAPI.orderMetrics();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load order metrics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getBadge = (st: string) => {
    switch ((st || 'Pending').toLowerCase()) {
      case 'paid':
      case 'captured':
        return <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> PAID</span>;
      case 'failed':
        return <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> FAILED</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit"><Ban className="w-3 h-3" /> CANCELLED</span>;
      default:
        return <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit"><Clock className="w-3 h-3 animate-pulse" /> PENDING</span>;
    }
  };

  const statusChartData = [
    { name: 'Paid', paid: data?.paid_orders ?? 0, pending: 0, failed: 0 },
    { name: 'Pending', paid: 0, pending: data?.pending_orders ?? 0, failed: 0 },
    { name: 'Failed', paid: 0, pending: 0, failed: data?.failed_orders ?? 0 },
  ];

  return (
    <div className="space-y-8 max-w-screen-xl relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Order Lifecycle & Node Timeline</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time order state machine events from MongoDB</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); loadData(); }}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-[#1E293B] hover:bg-white/5 rounded-xl text-slate-300 text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Task 2 — 6 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Orders Today" value={data?.orders_today ?? 0} icon={ShoppingBag} color="cyan" loading={loading} index={0} />
        <KPICard label="Paid Orders" value={data?.paid_orders ?? 0} icon={CheckCircle} color="emerald" loading={loading} index={1} />
        <KPICard label="Pending Orders" value={data?.pending_orders ?? 0} icon={Clock} color="indigo" loading={loading} index={2} />
        <KPICard label="Failed Orders" value={data?.failed_orders ?? 0} icon={XCircle} color="rose" loading={loading} index={3} />
        <KPICard label="Cancelled Orders" value={data?.cancelled_orders ?? 0} icon={Ban} color="amber" loading={loading} index={4} />
        <KPICard label="Total Orders" value={data?.total_orders ?? 0} icon={Tag} color="purple" loading={loading} index={5} />
      </div>

      {/* Orders Table */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-[#1E293B] flex justify-between items-center bg-[#161F30]">
          <div>
            <h3 className="text-sm font-bold text-white">Order Lifecycle Feed</h3>
            <p className="text-[10px] text-slate-400">Click any row to inspect Node Timeline & Razorpay payload</p>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
            Live Stream
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-[#1E293B]/40 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5 font-bold">Order ID</th>
                  <th className="px-5 py-3.5 font-bold">Customer Name</th>
                  <th className="px-5 py-3.5 font-bold">Items Count</th>
                  <th className="px-5 py-3.5 font-bold">Total Amount</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold">Created Timestamp</th>
                  <th className="px-5 py-3.5 font-bold">Timeline Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {(data?.orders_timeline ?? []).map((o: any, i: number) => (
                  <tr
                    key={o.order_id || i}
                    onClick={() => setSelectedOrder(o)}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">{o.order_id}</td>
                    <td className="px-5 py-3.5 text-white font-medium">{o.customer_name}</td>
                    <td className="px-5 py-3.5 text-slate-300">{o.items_count} item(s)</td>
                    <td className="px-5 py-3.5 font-extrabold text-white">₹{(o.amount ?? 0).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3.5">{getBadge(o.status)}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">{new Date(o.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3.5">
                      <button className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1">
                        <Eye className="w-3 h-3 text-indigo-400" /> View Node
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orders Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Orders Status Breakdown</h3>
          <OrdersBarChart data={statusChartData} loading={loading} />
        </div>
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Top Categories by Order Volume</h3>
          <div className="space-y-3">
            {(data?.top_categories ?? []).map((cat: any) => (
              <div key={cat.category} className="flex justify-between items-center p-3 bg-[#161F30] rounded-xl border border-[#1E293B]">
                <span className="text-xs font-bold text-white">{cat.category}</span>
                <span className="text-xs font-extrabold text-emerald-400">₹{(cat.revenue ?? 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order Node Timeline Drawer Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-md bg-[#0F172A] border-l border-[#1E293B] h-full p-6 overflow-y-auto space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">Order Timeline Node</h3>
                  <p className="text-xs font-mono text-emerald-400 mt-0.5">{selectedOrder.order_id}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Details */}
              <div className="bg-[#111827] rounded-xl p-4 border border-[#1E293B] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Customer:</span>
                  <span className="text-white font-bold">{selectedOrder.customer_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Email:</span>
                  <span className="text-slate-300 font-mono text-[11px]">{selectedOrder.customer_email}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Total Amount:</span>
                  <span className="text-emerald-400 font-extrabold">₹{(selectedOrder.amount ?? 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Node Timeline Visualizer */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Node Progression Lifecycle</h4>

                {/* Node 1: Created */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1 bg-[#111827] p-3 rounded-xl border border-[#1E293B]">
                    <p className="text-xs font-bold text-white">Order Created</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">{new Date(selectedOrder.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Node 2: Payment Initiated */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1 bg-[#111827] p-3 rounded-xl border border-[#1E293B]">
                    <p className="text-xs font-bold text-white">Razorpay Checkout Initiated</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">{new Date(selectedOrder.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Node 3: Payment Terminal State */}
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    selectedOrder.status === 'Paid' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  }`}>
                    3
                  </div>
                  <div className="flex-1 bg-[#111827] p-3 rounded-xl border border-[#1E293B]">
                    <p className="text-xs font-bold text-white">Payment Status: {selectedOrder.status}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      {selectedOrder.payment_completed_at ? new Date(selectedOrder.payment_completed_at).toLocaleString('en-IN') : 'State Machine Terminal Node'}
                    </p>
                  </div>
                </div>

                {/* Node 4: Fulfillment */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    4
                  </div>
                  <div className="flex-1 bg-[#111827] p-3 rounded-xl border border-[#1E293B] opacity-60">
                    <p className="text-xs font-bold text-slate-300">Order Delivery / Dispatch</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">Pending Merchant Fulfillment</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
