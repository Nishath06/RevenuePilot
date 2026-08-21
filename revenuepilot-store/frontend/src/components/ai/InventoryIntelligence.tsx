/**
 * InventoryIntelligence — Charts + tables for inventory analytics
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { InventoryInsights } from '../../services/merchantAI.service';

interface Props {
  inventory: InventoryInsights | null;
  loading?: boolean;
}

const CHART_COLORS = ['#059669', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];

export const InventoryIntelligence: React.FC<Props> = ({ inventory, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-56 bg-slate-100 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!inventory) return null;

  const bestSellingData = inventory.best_selling.slice(0, 6).map(p => ({
    name: p.title.length > 16 ? p.title.slice(0, 16) + '…' : p.title,
    units: p.units_sold,
    revenue: p.revenue,
  }));

  const categoryData = Object.entries(inventory.category_revenue).slice(0, 6).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));

  const lowStock = inventory.low_stock_products.slice(0, 5);
  const outOfStock = inventory.out_of_stock_products.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Low Stock', value: inventory.low_stock_count, icon: AlertTriangle, color: 'amber' },
          { label: 'Out of Stock', value: inventory.out_of_stock_count, icon: Package, color: 'rose' },
          { label: 'Best Sellers', value: inventory.best_selling.length, icon: TrendingUp, color: 'emerald' },
          { label: 'Categories', value: Object.keys(inventory.category_revenue).length, icon: TrendingDown, color: 'indigo' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.07 }}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-extrabold ${
              stat.color === 'rose' ? 'text-rose-600' :
              stat.color === 'amber' ? 'text-amber-600' :
              stat.color === 'emerald' ? 'text-emerald-600' : 'text-indigo-600'
            }`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Sellers Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-sm">Best Selling Products (Units)</h3>
          </div>
          {bestSellingData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bestSellingData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v: unknown) => [v as number, 'Units Sold']}
                />
                <Bar dataKey="units" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
              No sales data yet
            </div>
          )}
        </motion.div>

        {/* Category Revenue Pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">Revenue by Category (₹)</h3>
          </div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: unknown) => [`₹${(v as number).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
              No category revenue data yet
            </div>
          )}
        </motion.div>

        {/* Low Stock Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">Low Stock Alert</h3>
          </div>
          {lowStock.length > 0 ? (
            <div className="space-y-2">
              {lowStock.map((p, i) => (
                <div key={p.product_id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                    <span className="text-xs font-semibold text-slate-700 truncate">{p.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      p.stock <= 3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>{p.stock} left</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-emerald-600 font-semibold py-8">✅ All products well-stocked</p>
          )}
        </motion.div>

        {/* Out of Stock */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-rose-500" />
            <h3 className="font-bold text-slate-800 text-sm">Out of Stock</h3>
          </div>
          {outOfStock.length > 0 ? (
            <div className="space-y-2">
              {outOfStock.map((p, i) => (
                <div key={p.product_id} className="flex items-center justify-between p-2 rounded-xl bg-rose-50/50 border border-rose-100">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{p.title}</p>
                    <p className="text-[10px] text-slate-400">{p.category} · ₹{p.price.toLocaleString('en-IN')}</p>
                  </div>
                  <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full flex-shrink-0">OUT</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-emerald-600 font-semibold py-8">✅ No out-of-stock products</p>
          )}
        </motion.div>
      </div>
    </div>
  );
};
