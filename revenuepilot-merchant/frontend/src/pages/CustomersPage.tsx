import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { PaymentPieChart } from '../components/charts/Charts';
import { Users, UserPlus, Repeat, Zap, DollarSign, Crown, RefreshCw, Star } from 'lucide-react';
import { aiAPI } from '../services/api';

export const CustomersPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await aiAPI.customerMetrics();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load customer metrics', err);
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

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  const segmentPieData = (data?.segments ?? []).map((s: any) => ({
    name: s.name,
    value: s.count,
  }));

  const getSegmentBadge = (spent: number) => {
    if (spent >= 5000) return <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit"><Crown className="w-3 h-3 text-purple-400" /> VIP</span>;
    if (spent >= 2500) return <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit"><Repeat className="w-3 h-3 text-emerald-400" /> REPEAT</span>;
    return <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit"><Users className="w-3 h-3 text-cyan-400" /> ONE-TIME</span>;
  };

  return (
    <div className="space-y-8 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Customer Intelligence & Segmentation</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time buyer LTV, purchasing frequency & audience segments</p>
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

      {/* Task 3 — 6 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Customers" value={data?.total_customers ?? 0} icon={Users} color="indigo" loading={loading} index={0} />
        <KPICard label="New Customers" value={data?.new_customers ?? 0} icon={UserPlus} color="cyan" loading={loading} index={1} />
        <KPICard label="Repeat Customers" value={data?.repeat_customers ?? 0} icon={Repeat} color="emerald" loading={loading} index={2} />
        <KPICard label="Active Customers" value={data?.active_customers ?? 0} icon={Zap} color="purple" loading={loading} index={3} />
        <KPICard label="Avg Spend / Buyer" value={fmt(data?.average_customer_spend)} icon={DollarSign} color="amber" loading={loading} index={4} />
        <KPICard label="Highest Spend LTV" value={fmt(data?.highest_spending_customer)} icon={Crown} color="rose" loading={loading} index={5} />
      </div>

      {/* Top Customers Table */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-[#1E293B] flex justify-between items-center bg-[#161F30]">
          <div>
            <h3 className="text-sm font-bold text-white">Top Customer Accounts & Spend History</h3>
            <p className="text-[10px] text-slate-400">Aggregated buyer spending rank from MongoDB</p>
          </div>
          <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full font-bold">
            Segmented LTV
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
                  <th className="px-5 py-3.5 font-bold">User ID</th>
                  <th className="px-5 py-3.5 font-bold">Customer Name</th>
                  <th className="px-5 py-3.5 font-bold">Total Orders</th>
                  <th className="px-5 py-3.5 font-bold">Total Lifetime Spent</th>
                  <th className="px-5 py-3.5 font-bold">Average Order Spend</th>
                  <th className="px-5 py-3.5 font-bold">Segment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {(data?.top_customers_table ?? []).map((c: any, i: number) => (
                  <tr key={c.user_id || i} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3.5 font-mono text-indigo-400 font-bold">{c.user_id?.slice(-8) || `usr-${i}`}</td>
                    <td className="px-5 py-3.5 text-white font-bold flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold">
                        {(c.name || 'C')[0].toUpperCase()}
                      </div>
                      {c.name || `Customer ${i+1}`}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-medium">{c.total_orders} orders</td>
                    <td className="px-5 py-3.5 font-extrabold text-emerald-400">{fmt(c.total_spent)}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-semibold">{fmt(c.avg_order_spend || (c.total_spent / (c.total_orders || 1)))}</td>
                    <td className="px-5 py-3.5">{getSegmentBadge(c.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Segments Breakdown Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Customer Segmentation Breakdown</h3>
          <PaymentPieChart data={segmentPieData} loading={loading} />
        </div>
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Audience Insights & Marketing Triggers</h3>
          <div className="space-y-3">
            {(data?.segments ?? []).map((s: any) => (
              <div key={s.name} className="flex justify-between items-center p-3 bg-[#161F30] rounded-xl border border-[#1E293B]">
                <div>
                  <p className="text-xs font-bold text-white">{s.name}</p>
                  <p className="text-[10px] text-slate-500">Target for retention email sequences</p>
                </div>
                <span className="text-xs font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                  {s.count} Users
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
