import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { Users, TrendingUp, Star, ShoppingBag } from 'lucide-react';
import { aiAPI } from '../services/api';

export const CustomersPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { aiAPI.customers().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const cust = data ?? {};
  const topCustomers = data?.top_customers ?? [];

  return (
    <div className="space-y-8 max-w-screen-xl">
      <h1 className="text-xl font-extrabold text-white">Customer Intelligence</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Total Customers" value={cust.total_customers ?? 0} icon={Users} color="indigo" loading={loading} index={0} />
        <KPICard label="Repeat Customers" value={cust.repeat_customers ?? 0} icon={Star} color="emerald" loading={loading} index={1} />
        <KPICard label="Abandoned Carts" value={cust.abandoned_carts ?? 0} icon={ShoppingBag} color="amber" loading={loading} index={2} />
        <KPICard label="Avg Spend" value={`₹${(cust.avg_spend ?? 0).toLocaleString('en-IN')}`} icon={TrendingUp} color="cyan" loading={loading} index={3} />
      </div>
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
        <h3 className="text-sm font-bold text-white mb-4">Top Customers</h3>
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : topCustomers.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">No customer data available yet</p>
        ) : (
          <div className="space-y-2">
            {topCustomers.map((c: any, i: number) => (
              <motion.div key={c.user_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {(c.name || c.user_id || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{c.name || `User ${c.user_id?.slice(-6)}`}</p>
                    <p className="text-[10px] text-slate-500">{c.orders_count} orders</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-400">₹{(c.total_spent ?? 0).toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-500">lifetime value</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
