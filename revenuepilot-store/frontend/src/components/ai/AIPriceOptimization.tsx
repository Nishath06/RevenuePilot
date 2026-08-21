/**
 * AIPriceOptimization — AI-suggested price changes per product
 */
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Tag, Sparkles, AlertCircle } from 'lucide-react';
import { InventoryInsights, ProductStock, SalesRank } from '../../services/merchantAI.service';

interface Props {
  inventory: InventoryInsights | null;
  loading?: boolean;
}

type Suggestion = 'increase' | 'decrease' | 'keep';

interface PriceRec {
  product_id: string;
  title: string;
  currentPrice: number;
  suggestion: Suggestion;
  suggestedPrice: number;
  reason: string;
  impact: string;
  category: string;
}

const MOCK_RECS: PriceRec[] = [
  { product_id: '1', title: 'Sony WH-1000XM5', currentPrice: 24999, suggestion: 'increase', suggestedPrice: 27499, reason: 'High demand, low stock — 89% sold through', impact: '+10% margin gain', category: 'Electronics' },
  { product_id: '2', title: 'Apple MacBook Air M2', currentPrice: 114999, suggestion: 'keep', suggestedPrice: 114999, reason: 'Optimal pricing — strong conversion rate', impact: 'Stable', category: 'Laptops' },
  { product_id: '3', title: 'Samsung Galaxy S24', currentPrice: 74999, suggestion: 'decrease', suggestedPrice: 69999, reason: 'Slow turnover — 3 competitors at lower price', impact: 'Est. +35% volume', category: 'Mobiles' },
  { product_id: '4', title: 'boAt Airdopes 141', currentPrice: 1299, suggestion: 'increase', suggestedPrice: 1499, reason: 'Best-seller, high repeat purchase rate', impact: '+15% revenue/unit', category: 'Audio' },
  { product_id: '5', title: 'HP Laptop 15s', currentPrice: 54999, suggestion: 'decrease', suggestedPrice: 49999, reason: 'Low stock movement, 45 days since last sale', impact: 'Clear aging inventory', category: 'Laptops' },
  { product_id: '6', title: 'Logitech MX Master 3', currentPrice: 8999, suggestion: 'keep', suggestedPrice: 8999, reason: 'Good margin + consistent weekly sales', impact: 'Stable', category: 'Accessories' },
];

function buildRecs(inventory: InventoryInsights): PriceRec[] {
  const recs: PriceRec[] = [];
  inventory.low_stock_products.slice(0, 2).forEach((p: ProductStock) => {
    recs.push({ product_id: p.product_id, title: p.title, currentPrice: p.price, suggestion: 'increase', suggestedPrice: Math.round(p.price * 1.08), reason: `Only ${p.stock} units left — demand exceeds supply`, impact: '+8% margin per unit', category: p.category });
  });
  inventory.out_of_stock_products.slice(0, 2).forEach((p: ProductStock) => {
    recs.push({ product_id: p.product_id, title: p.title, currentPrice: p.price, suggestion: 'keep', suggestedPrice: p.price, reason: 'Out of stock — restock before adjusting price', impact: 'Pending restock', category: p.category });
  });
  inventory.best_selling.slice(0, 2).forEach((p: SalesRank, i: number) => {
    if (i === 0) {
      const avg = Math.round(p.revenue / Math.max(p.units_sold, 1));
      recs.push({ product_id: p.product_id, title: p.title, currentPrice: avg, suggestion: 'increase', suggestedPrice: Math.round(avg * 1.05), reason: `Top seller with ${p.units_sold} units sold`, impact: '+5% revenue with minimal volume impact', category: p.category });
    }
  });
  return recs.length > 0 ? recs : MOCK_RECS;
}

const suggConfig = {
  increase: { icon: TrendingUp,   label: 'Raise Price', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', bar: 'from-emerald-500 to-teal-500' },
  decrease: { icon: TrendingDown, label: 'Lower Price', bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',    bar: 'from-rose-500 to-orange-500' },
  keep:     { icon: Minus,        label: 'Keep Same',  bg: 'bg-slate-50',    border: 'border-slate-200',   text: 'text-slate-600',   badge: 'bg-slate-100 text-slate-600',   bar: 'from-slate-400 to-slate-500' },
};

export const AIPriceOptimization: React.FC<Props> = ({ inventory, loading }) => {
  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[1,2,3,4,5,6].map(i => <div key={i} className="h-52 bg-slate-100 rounded-2xl" />)}
    </div>
  );

  const recs = inventory ? buildRecs(inventory) : MOCK_RECS;

  return (
    <div className="space-y-4">
      {!inventory && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Showing demo recommendations — connect AI service for live data
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {(['increase','decrease','keep'] as Suggestion[]).map(s => {
          const cfg = suggConfig[s];
          return (
            <span key={s} className={`flex items-center gap-1 px-2 py-1 rounded-full font-bold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
              <cfg.icon className="w-3 h-3" />{cfg.label}
            </span>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recs.map((rec, i) => {
          const cfg = suggConfig[rec.suggestion];
          const delta = rec.suggestedPrice - rec.currentPrice;
          const pct = ((delta / rec.currentPrice) * 100).toFixed(1);
          return (
            <motion.div key={rec.product_id + i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }} whileHover={{ y: -3 }}
              className={`bg-white rounded-2xl border-2 ${cfg.border} shadow-sm overflow-hidden`}>
              <div className={`h-1 bg-gradient-to-r ${cfg.bar}`} />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">{rec.category}</p>
                    <p className="text-sm font-bold text-slate-800 leading-tight truncate" title={rec.title}>{rec.title}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${cfg.badge}`}>
                    <cfg.icon className="w-2.5 h-2.5" />{cfg.label}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <div><p className="text-[10px] text-slate-400">Current</p><p className="text-base font-extrabold text-slate-700">₹{rec.currentPrice.toLocaleString('en-IN')}</p></div>
                  <div className="text-slate-300">→</div>
                  <div className="text-right"><p className="text-[10px] text-slate-400">Suggested</p><p className={`text-base font-extrabold ${cfg.text}`}>₹{rec.suggestedPrice.toLocaleString('en-IN')}</p></div>
                  {delta !== 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{delta > 0 ? '+' : ''}{pct}%</span>}
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${cfg.text}`} />
                  <p className="text-xs text-slate-600 leading-relaxed">{rec.reason}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500 font-semibold">{rec.impact}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
