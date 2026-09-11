import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { InventoryBarChart } from '../components/charts/Charts';
import { Package, AlertTriangle, XCircle, TrendingUp, Sliders, DollarSign, Archive, RefreshCw, CheckCircle } from 'lucide-react';
import { aiAPI } from '../services/api';

type TabType = 'low_stock' | 'out_of_stock' | 'best_selling' | 'unsold';

export const InventoryPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('low_stock');
  const [threshold, setThreshold] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await aiAPI.inventoryMetrics();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load inventory metrics', err);
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

  const lowStockFiltered = (data?.low_stock_products ?? []).filter((p: any) => p.stock > 0 && p.stock <= threshold);
  const outOfStockList = data?.out_of_stock_products ?? [];
  const bestSellingList = data?.best_selling_products ?? [];
  const unsoldList = data?.unsold_products ?? [];

  const chartStockData = [
    ...lowStockFiltered.map((p: any) => ({ name: p.title?.slice(0, 14), stock: p.stock })),
    ...outOfStockList.map((p: any) => ({ name: p.title?.slice(0, 14), stock: 0 })),
  ].slice(0, 10);

  return (
    <div className="space-y-8 max-w-screen-xl">
      {/* Header & Threshold Slider */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Inventory Health & Stock Watchdog</h1>
          <p className="text-xs text-slate-400 mt-1">Live SKU warehouse monitoring and stockout prevention from MongoDB</p>
        </div>

        {/* Threshold Controls */}
        <div className="flex items-center gap-4 bg-[#111827] p-3 rounded-2xl border border-[#1E293B]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Sliders className="w-4 h-4 text-amber-400" />
            Alert Threshold: <span className="text-amber-400 font-extrabold text-sm">{threshold} units</span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-32 accent-amber-400 cursor-pointer"
          />
          <button
            onClick={() => { setRefreshing(true); loadData(); }}
            disabled={refreshing}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Task 4 — 6 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Products" value={data?.total_products ?? 0} icon={Package} color="indigo" loading={loading} index={0} />
        <KPICard label="In Stock" value={data?.in_stock ?? 0} icon={CheckCircle} color="emerald" loading={loading} index={1} />
        <KPICard label="Low Stock (< threshold)" value={lowStockFiltered.length} icon={AlertTriangle} color={lowStockFiltered.length > 0 ? 'amber' : 'emerald'} loading={loading} index={2} />
        <KPICard label="Out of Stock (= 0)" value={outOfStockList.length} icon={XCircle} color={outOfStockList.length > 0 ? 'rose' : 'emerald'} loading={loading} index={3} />
        <KPICard label="Unsold (This Month)" value={data?.unsold_products_count ?? unsoldList.length} icon={Archive} color="purple" loading={loading} index={4} />
        <KPICard label="Inventory Value" value={fmt(data?.total_inventory_value)} icon={DollarSign} color="cyan" loading={loading} index={5} />
      </div>

      {/* Tabbed Product Tables */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-[#1E293B] flex items-center justify-between bg-[#161F30] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('low_stock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'low_stock' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Low Stock ({lowStockFiltered.length})
            </button>
            <button
              onClick={() => setActiveTab('out_of_stock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'out_of_stock' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" /> Out of Stock ({outOfStockList.length})
            </button>
            <button
              onClick={() => setActiveTab('best_selling')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'best_selling' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Best Selling ({bestSellingList.length})
            </button>
            <button
              onClick={() => setActiveTab('unsold')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'unsold' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-purple-400" /> Unsold ({unsoldList.length})
            </button>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Live Mongo Aggregations</span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-[#1E293B]/40 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'low_stock' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5 font-bold">Product Title</th>
                    <th className="px-5 py-3.5 font-bold">Category</th>
                    <th className="px-5 py-3.5 font-bold">Price</th>
                    <th className="px-5 py-3.5 font-bold">Current Stock</th>
                    <th className="px-5 py-3.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {lowStockFiltered.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500">No products below {threshold} threshold</td></tr>
                  ) : (
                    lowStockFiltered.map((p: any, i: number) => (
                      <tr key={p.product_id || i} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5 font-bold text-white">{p.title}</td>
                        <td className="px-5 py-3.5 text-slate-400 font-medium">{p.category || 'General'}</td>
                        <td className="px-5 py-3.5 font-semibold text-white">{fmt(p.price)}</td>
                        <td className="px-5 py-3.5 font-extrabold text-amber-400">{p.stock} remaining</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" /> LOW STOCK
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'out_of_stock' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5 font-bold">Product Title</th>
                    <th className="px-5 py-3.5 font-bold">Category</th>
                    <th className="px-5 py-3.5 font-bold">Price</th>
                    <th className="px-5 py-3.5 font-bold">Current Stock</th>
                    <th className="px-5 py-3.5 font-bold">Alert Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {outOfStockList.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500">Zero out of stock products ✅</td></tr>
                  ) : (
                    outOfStockList.map((p: any, i: number) => (
                      <tr key={p.product_id || i} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5 font-bold text-white">{p.title}</td>
                        <td className="px-5 py-3.5 text-slate-400">{p.category || 'General'}</td>
                        <td className="px-5 py-3.5 font-semibold text-white">{fmt(p.price)}</td>
                        <td className="px-5 py-3.5 font-extrabold text-rose-400">0 units</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit">
                            <XCircle className="w-3 h-3" /> OUT OF STOCK
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'best_selling' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5 font-bold">Product Title</th>
                    <th className="px-5 py-3.5 font-bold">Units Sold</th>
                    <th className="px-5 py-3.5 font-bold">Revenue Generated</th>
                    <th className="px-5 py-3.5 font-bold">Stock Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {bestSellingList.length === 0 ? (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-500">No best selling products data logged</td></tr>
                  ) : (
                    bestSellingList.map((p: any, i: number) => (
                      <tr key={p.product_id || i} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                          <span className="text-emerald-400 font-mono font-bold">#{i + 1}</span> {p.title}
                        </td>
                        <td className="px-5 py-3.5 font-extrabold text-white">{p.units_sold} units</td>
                        <td className="px-5 py-3.5 font-extrabold text-emerald-400">{fmt(p.revenue)}</td>
                        <td className="px-5 py-3.5 text-slate-300 font-semibold">{p.stock ?? 15} left</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'unsold' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5 font-bold">Product Title</th>
                    <th className="px-5 py-3.5 font-bold">Category</th>
                    <th className="px-5 py-3.5 font-bold">Price</th>
                    <th className="px-5 py-3.5 font-bold">Sales This Month</th>
                    <th className="px-5 py-3.5 font-bold">AI Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {unsoldList.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500">All products have recorded sales this month</td></tr>
                  ) : (
                    unsoldList.map((p: any, i: number) => (
                      <tr key={p.product_id || i} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5 font-bold text-white">{p.title}</td>
                        <td className="px-5 py-3.5 text-slate-400">{p.category || 'General'}</td>
                        <td className="px-5 py-3.5 font-semibold text-white">{fmt(p.price)}</td>
                        <td className="px-5 py-3.5 text-rose-400 font-bold">0 sales</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-[10px] font-extrabold">
                            Apply 15% Discount
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Stock Levels Chart */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
        <h3 className="text-sm font-bold text-white mb-4">Stock Levels — At-Risk SKUs</h3>
        <InventoryBarChart data={chartStockData} loading={loading} />
      </div>
    </div>
  );
};
