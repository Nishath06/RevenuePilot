/**
 * AIHealthScore — Business health score out of 100 with animated gauge
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CreditCard, Package, Users, AlertTriangle, Sparkles } from 'lucide-react';
import { TodayInsights, InventoryInsights } from '../../services/merchantAI.service';

interface Props {
  insights: TodayInsights | null;
  inventory: InventoryInsights | null;
  loading?: boolean;
}

interface Factor {
  label: string;
  score: number;
  maxScore: number;
  icon: React.ReactNode;
  detail: string;
  color: string;
}

function clamp(v: number, min = 0, max = 100) { return Math.min(max, Math.max(min, v)); }

function computeFactors(insights: TodayInsights | null, inventory: InventoryInsights | null): Factor[] {
  const rev = insights?.revenue ?? {};
  const pay = insights?.payments ?? {};
  const cust = insights?.customers ?? {};

  // Revenue Growth (0–25)
  const growth = rev.growth_percentage ?? 0;
  const revenueScore = clamp(growth > 0 ? 20 + Math.min(growth / 2, 5) : Math.max(0, 15 + growth / 2), 0, 25);

  // Payment Success Rate (0–25)
  const successRate = pay.success_rate ?? 90;
  const paymentScore = clamp((successRate / 100) * 25, 0, 25);

  // Inventory Health (0–20)
  const outOfStock = inventory?.out_of_stock_count ?? 0;
  const lowStock = inventory?.low_stock_count ?? 0;
  const totalProducts = (inventory?.best_selling?.length ?? 10) + outOfStock + lowStock;
  const inventoryScore = clamp(20 - (outOfStock * 3) - (lowStock * 1), 0, 20);

  // Customer Retention (0–20) — based on repeat customers vs abandoned carts
  const abandoned = cust.abandoned_carts ?? 0;
  const repeat = cust.repeat_customers ?? 5;
  const custScore = clamp(15 + (repeat > 0 ? 5 : 0) - Math.min(abandoned * 2, 10), 0, 20);

  // Failed Payments penalty (0–10)
  const failed = pay.failed ?? 0;
  const failedScore = clamp(10 - failed * 2, 0, 10);

  return [
    { label: 'Revenue Growth', score: Math.round(revenueScore), maxScore: 25, icon: <TrendingUp className="w-4 h-4" />, detail: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs yesterday`, color: revenueScore >= 18 ? 'emerald' : revenueScore >= 10 ? 'amber' : 'rose' },
    { label: 'Payment Success', score: Math.round(paymentScore), maxScore: 25, icon: <CreditCard className="w-4 h-4" />, detail: `${successRate.toFixed(1)}% success rate`, color: paymentScore >= 22 ? 'emerald' : paymentScore >= 15 ? 'amber' : 'rose' },
    { label: 'Inventory Health', score: Math.round(inventoryScore), maxScore: 20, icon: <Package className="w-4 h-4" />, detail: `${outOfStock} out-of-stock, ${lowStock} low`, color: inventoryScore >= 17 ? 'emerald' : inventoryScore >= 10 ? 'amber' : 'rose' },
    { label: 'Customer Retention', score: Math.round(custScore), maxScore: 20, icon: <Users className="w-4 h-4" />, detail: `${abandoned} abandoned carts`, color: custScore >= 16 ? 'emerald' : custScore >= 10 ? 'amber' : 'rose' },
    { label: 'Failed Payments', score: Math.round(failedScore), maxScore: 10, icon: <AlertTriangle className="w-4 h-4" />, detail: `${failed} failed today`, color: failedScore >= 8 ? 'emerald' : failedScore >= 5 ? 'amber' : 'rose' },
  ];
}

const colorMap = {
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-100', bar: 'bg-emerald-500', ring: 'text-emerald-500' },
  amber:   { text: 'text-amber-600',   bg: 'bg-amber-100',   bar: 'bg-amber-400',   ring: 'text-amber-500'   },
  rose:    { text: 'text-rose-600',     bg: 'bg-rose-100',    bar: 'bg-rose-500',    ring: 'text-rose-500'    },
};

const RADIUS = 72;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const AIHealthScore: React.FC<Props> = ({ insights, inventory, loading }) => {
  const [animScore, setAnimScore] = useState(0);

  const factors = computeFactors(insights, inventory);
  const total = factors.reduce((s, f) => s + f.score, 0);

  const scoreColor = total >= 80 ? 'emerald' : total >= 55 ? 'amber' : 'rose';
  const scoreLabel = total >= 80 ? 'Excellent' : total >= 65 ? 'Good' : total >= 45 ? 'Fair' : 'Needs Attention';

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setAnimScore(total), 200);
      return () => clearTimeout(t);
    }
  }, [total, loading]);

  const strokeDash = CIRCUMFERENCE - (animScore / 100) * CIRCUMFERENCE;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          <div className="w-52 h-52 rounded-full bg-slate-200 flex-shrink-0" />
          <div className="flex-1 space-y-3 w-full">
            {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-center">
      {/* Radial gauge */}
      <div className="relative flex-shrink-0">
        <svg width="200" height="200" className="rotate-[-90deg]">
          {/* Background track */}
          <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="#f1f5f9" strokeWidth="14" />
          {/* Progress */}
          <motion.circle
            cx="100" cy="100" r={RADIUS} fill="none"
            stroke={scoreColor === 'emerald' ? '#10b981' : scoreColor === 'amber' ? '#f59e0b' : '#ef4444'}
            strokeWidth="14" strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: strokeDash }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <Sparkles className={`w-5 h-5 mb-1 ${colorMap[scoreColor].text}`} />
          <motion.span
            className={`text-4xl font-black ${colorMap[scoreColor].text}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {animScore}
          </motion.span>
          <span className="text-xs text-slate-400 font-semibold">/ 100</span>
          <span className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${colorMap[scoreColor].bg} ${colorMap[scoreColor].text}`}>
            {scoreLabel}
          </span>
        </div>
      </div>

      {/* Factors */}
      <div className="flex-1 w-full space-y-3">
        {factors.map((f, i) => {
          const c = colorMap[f.color as keyof typeof colorMap];
          const pct = (f.score / f.maxScore) * 100;
          return (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 + 0.3 }}
              className="flex items-center gap-3"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg} ${c.text}`}>
                {f.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-700">{f.label}</span>
                  <span className={`text-xs font-extrabold ${c.text}`}>{f.score}/{f.maxScore}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${c.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, delay: i * 0.1 + 0.4, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{f.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
