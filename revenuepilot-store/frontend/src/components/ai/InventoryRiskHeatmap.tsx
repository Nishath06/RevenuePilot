/**
 * InventoryRiskHeatmap — Visual risk cards for stock levels
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Package, AlertTriangle, XCircle, TrendingDown, CheckCircle } from 'lucide-react';
import { InventoryInsights, ProductStock } from '../../services/merchantAI.service';

interface Props {
  inventory: InventoryInsights | null;
  loading?: boolean;
}

interface RiskCard {
  label: string;
  count: number;
  products: ProductStock[];
  icon: React.ElementType;
  severity: 'critical' | 'high' | 'medium' | 'safe';
  description: string;
  action: string;
}

const severityStyles = {
  critical: { card: 'border-rose-300 bg-rose-50/60',    icon: 'bg-rose-100 text-rose-600',    badge: 'bg-rose-500 text-white',    count: 'text-rose-600',    pulse: true  },
  high:     { card: 'border-orange-300 bg-orange-50/60', icon: 'bg-orange-100 text-orange-600', badge: 'bg-orange-500 text-white',  count: 'text-orange-600',  pulse: true  },
  medium:   { card: 'border-amber-300 bg-amber-50/60',   icon: 'bg-amber-100 text-amber-600',   badge: 'bg-amber-400 text-white',   count: 'text-amber-600',   pulse: false },
  safe:     { card: 'border-emerald-200 bg-emerald-50/40',icon: 'bg-emerald-100 text-emerald-600',badge:'bg-emerald-500 text-white', count: 'text-emerald-600', pulse: false },
};

const MOCK_INVENTORY: InventoryInsights = {
  low_stock_count: 4,
  out_of_stock_count: 2,
  low_stock_products: [
    { product_id: '1', title: 'Sony WH-1000XM5', stock: 2, price: 24999, category: 'Electronics' },
    { product_id: '2', title: 'boAt Airdopes 141', stock: 5, price: 1299, category: 'Audio' },
    { product_id: '3', title: 'Logitech G Pro X', stock: 3, price: 8499, category: 'Gaming' },
    { product_id: '4', title: 'Samsung Galaxy Buds', stock: 7, price: 9999, category: 'Audio' },
  ],
  out_of_stock_products: [
    { product_id: '5', title: 'Apple AirPods Pro', stock: 0, price: 24900, category: 'Audio' },
    { product_id: '6', title: 'Mi Band 8', stock: 0, price: 2499, category: 'Wearables' },
  ],
  best_selling: [],
  category_revenue: {},
};

export const InventoryRiskHeatmap: React.FC<Props> = ({ inventory, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1,2,3,4].map(i => <div key={i} className="h-64 bg-slate-100 rounded-2xl" />)}
      </div>
    );
  }

  const data = inventory ?? MOCK_INVENTORY;

  // Estimate "risk in 2 days" as items with stock <= 3
  const criticalSoon = data.low_stock_products.filter(p => p.stock <= 3);
  // Estimate "overstocked" as category with 0 sales but stock exists (mocked)
  const overStocked: ProductStock[] = [];

  const riskCards: RiskCard[] = [
    {
      label: 'Out of Stock',
      count: data.out_of_stock_count,
      products: data.out_of_stock_products.slice(0, 4),
      icon: XCircle,
      severity: data.out_of_stock_count > 0 ? 'critical' : 'safe',
      description: 'No inventory — customers cannot purchase',
      action: 'Restock immediately',
    },
    {
      label: 'Risk in 2 Days',
      count: criticalSoon.length,
      products: criticalSoon.slice(0, 4),
      icon: AlertTriangle,
      severity: criticalSoon.length > 2 ? 'high' : criticalSoon.length > 0 ? 'medium' : 'safe',
      description: 'Stock ≤ 3 units — will sell out soon',
      action: 'Place reorder now',
    },
    {
      label: 'Low Stock',
      count: data.low_stock_count,
      products: data.low_stock_products.slice(0, 4),
      icon: TrendingDown,
      severity: data.low_stock_count > 5 ? 'high' : data.low_stock_count > 0 ? 'medium' : 'safe',
      description: 'Below safety threshold — monitor closely',
      action: 'Plan reorder',
    },
    {
      label: 'Well Stocked',
      count: data.best_selling.length + overStocked.length,
      products: [],
      icon: CheckCircle,
      severity: 'safe',
      description: 'Products with healthy stock levels',
      action: 'Monitor trends',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {riskCards.map((card, i) => {
        const s = severityStyles[card.severity];
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-2xl border-2 ${s.card} p-4 space-y-3 backdrop-blur-sm`}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.icon}`}>
                {s.pulse ? (
                  <div className="relative">
                    <card.icon className="w-4 h-4" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-current animate-ping opacity-75" />
                  </div>
                ) : <card.icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
                {card.severity.toUpperCase()}
              </span>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.label}</p>
              <p className={`text-3xl font-black ${s.count}`}>{card.count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{card.description}</p>
            </div>

            {/* Product list */}
            {card.products.length > 0 ? (
              <div className="space-y-1.5">
                {card.products.map(p => (
                  <div key={p.product_id} className="flex items-center justify-between text-xs bg-white/70 rounded-lg px-2.5 py-1.5">
                    <span className="text-slate-700 font-medium truncate flex-1 min-w-0" title={p.title}>{p.title}</span>
                    <span className={`font-bold ml-2 flex-shrink-0 ${
                      p.stock === 0 ? 'text-rose-600' : p.stock <= 3 ? 'text-orange-600' : 'text-amber-600'
                    }`}>{p.stock === 0 ? 'OUT' : `${p.stock} left`}</span>
                  </div>
                ))}
              </div>
            ) : (
              card.severity === 'safe' && card.label === 'Well Stocked' ? (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-white/70 rounded-lg px-2.5 py-2">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>All other products are healthy</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center py-2">No products</div>
              )
            )}

            {/* Action */}
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-t border-current/10 pt-2">
              → {card.action}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
};
