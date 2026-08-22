import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { InventoryBarChart } from '../components/charts/Charts';
import { Package, AlertTriangle, XCircle, TrendingUp } from 'lucide-react';
import { aiAPI } from '../services/api';

export const InventoryPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { aiAPI.inventory().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const inv = data ?? {};
  const stockData = [
    ...(inv.low_stock_products ?? []).map((p: any) => ({ name: p.title?.slice(0, 16), stock: p.stock })),
    ...(inv.out_of_stock_products ?? []).map((p: any) => ({ name: p.title?.slice(0, 16), stock: 0 })),
  ].slice(0, 8);

  return (
    <div className="space-y-8 max-w-screen-xl">
      <h1 className="text-xl font-extrabold text-white">Inventory Intelligence</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Out of Stock" value={inv.out_of_stock_count ?? 0} icon={XCircle} color={(inv.out_of_stock_count ?? 0) > 0 ? 'rose' : 'emerald'} loading={loading} index={0} />
        <KPICard label="Low Stock" value={inv.low_stock_count ?? 0} icon={AlertTriangle} color={(inv.low_stock_count ?? 0) > 0 ? 'amber' : 'emerald'} loading={loading} index={1} />
        <KPICard label="Best Sellers" value={inv.best_selling?.length ?? 0} icon={TrendingUp} color="emerald" loading={loading} index={2} />
        <KPICard label="Total SKUs" value={(inv.low_stock_products?.length ?? 0) + (inv.out_of_stock_products?.length ?? 0) + (inv.best_selling?.length ?? 0)} icon={Package} color="indigo" loading={loading} index={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock levels chart */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Stock Levels — At-Risk Products</h3>
          {loading ? <div className="skeleton h-48 rounded-xl" /> : stockData.length > 0 ? <InventoryBarChart data={stockData} /> : <p className="text-slate-500 text-sm py-8 text-center">All products well stocked ✅</p>}
        </div>

        {/* Best sellers */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Top Selling Products</h3>
          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded-xl" />)}</div> : (
            <div className="space-y-2">
              {(inv.best_selling ?? []).slice(0, 6).map((p: any, i: number) => (
                <motion.div key={p.product_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600 w-5 text-right">#{i + 1}</span>
                    <span className="text-sm text-slate-300 font-medium truncate max-w-[160px]">{p.title}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-400">{p.units_sold} sold</p>
                    <p className="text-[10px] text-slate-600">₹{(p.revenue ?? 0).toLocaleString('en-IN')}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
