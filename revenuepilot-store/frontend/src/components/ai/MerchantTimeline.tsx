/**
 * MerchantTimeline — Chronological business events feed
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, CreditCard, XCircle, TrendingUp, Package, Users, Zap, AlertTriangle } from 'lucide-react';
import { TodayInsights, InventoryInsights, RecoveryData } from '../../services/merchantAI.service';

interface Props {
  insights: TodayInsights | null;
  inventory: InventoryInsights | null;
  recovery: RecoveryData | null;
  loading?: boolean;
}

interface TimelineEvent {
  id: string;
  type: 'order' | 'payment_fail' | 'low_stock' | 'revenue_spike' | 'customer' | 'recovery' | 'system';
  title: string;
  detail: string;
  time: string;
  icon: React.ElementType;
  color: string;
  dot: string;
}

const typeConfig = {
  order:         { icon: ShoppingBag, color: 'bg-indigo-100 text-indigo-600',  dot: 'bg-indigo-500'  },
  payment_fail:  { icon: XCircle,     color: 'bg-rose-100 text-rose-600',      dot: 'bg-rose-500'    },
  low_stock:     { icon: Package,     color: 'bg-amber-100 text-amber-600',    dot: 'bg-amber-400'   },
  revenue_spike: { icon: TrendingUp,  color: 'bg-emerald-100 text-emerald-600',dot: 'bg-emerald-500' },
  customer:      { icon: Users,       color: 'bg-violet-100 text-violet-600',  dot: 'bg-violet-500'  },
  recovery:      { icon: Zap,         color: 'bg-teal-100 text-teal-600',      dot: 'bg-teal-500'    },
  system:        { icon: AlertTriangle,color:'bg-slate-100 text-slate-600',    dot: 'bg-slate-400'   },
};

function relativeTime(minutesAgo: number): string {
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h ago`;
  return `${Math.floor(minutesAgo / 1440)}d ago`;
}

const MOCK_EVENTS: TimelineEvent[] = [
  { id: '1', type: 'order',         title: 'Order #RP2847 Paid',          detail: '₹24,999 — MacBook Air M2',                      time: relativeTime(3),   icon: ShoppingBag, color: typeConfig.order.color,         dot: typeConfig.order.dot         },
  { id: '2', type: 'payment_fail',  title: 'Payment Failed',               detail: '₹8,499 — UPI timeout (Razorpay)',                time: relativeTime(18),  icon: XCircle,     color: typeConfig.payment_fail.color,  dot: typeConfig.payment_fail.dot  },
  { id: '3', type: 'revenue_spike', title: 'Revenue Spike Detected',       detail: '+32% vs same time yesterday',                   time: relativeTime(45),  icon: TrendingUp,  color: typeConfig.revenue_spike.color, dot: typeConfig.revenue_spike.dot },
  { id: '4', type: 'low_stock',     title: 'Low Stock Alert',              detail: 'Sony WH-1000XM5 — only 2 units left',           time: relativeTime(72),  icon: Package,     color: typeConfig.low_stock.color,     dot: typeConfig.low_stock.dot     },
  { id: '5', type: 'order',         title: 'Order #RP2846 Paid',          detail: '₹1,299 — boAt Airdopes',                        time: relativeTime(95),  icon: ShoppingBag, color: typeConfig.order.color,         dot: typeConfig.order.dot         },
  { id: '6', type: 'customer',      title: 'New Repeat Customer',          detail: 'User made their 3rd purchase this month',        time: relativeTime(140), icon: Users,       color: typeConfig.customer.color,      dot: typeConfig.customer.dot      },
  { id: '7', type: 'recovery',      title: 'Cart Recovery Opportunity',    detail: '₹4,299 abandoned cart detected',                time: relativeTime(210), icon: Zap,         color: typeConfig.recovery.color,      dot: typeConfig.recovery.dot      },
  { id: '8', type: 'payment_fail',  title: 'Webhook Retry Succeeded',      detail: 'payment.captured event processed after 1 retry', time: relativeTime(285), icon: CreditCard,  color: typeConfig.system.color,        dot: typeConfig.system.dot        },
];

function buildEvents(insights: TodayInsights | null, inventory: InventoryInsights | null, recovery: RecoveryData | null): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = Date.now();

  // Revenue growth event
  if (insights?.revenue?.growth_percentage && insights.revenue.growth_percentage > 10) {
    events.push({ id: 'rev-spike', type: 'revenue_spike', title: 'Revenue Spike Detected', detail: `+${insights.revenue.growth_percentage.toFixed(1)}% vs yesterday`, time: relativeTime(30), icon: TrendingUp, color: typeConfig.revenue_spike.color, dot: typeConfig.revenue_spike.dot });
  }

  // Failed payments
  if ((insights?.payments?.failed ?? 0) > 0) {
    events.push({ id: 'pay-fail', type: 'payment_fail', title: `${insights!.payments.failed} Payment${insights!.payments.failed! > 1 ? 's' : ''} Failed`, detail: `Success rate: ${(insights!.payments.success_rate ?? 0).toFixed(1)}%`, time: relativeTime(25), icon: XCircle, color: typeConfig.payment_fail.color, dot: typeConfig.payment_fail.dot });
  }

  // Low stock
  if ((inventory?.low_stock_count ?? 0) > 0 && inventory?.low_stock_products?.[0]) {
    const p = inventory.low_stock_products[0];
    events.push({ id: 'low-stock', type: 'low_stock', title: 'Low Stock Alert', detail: `${p.title} — ${p.stock} unit${p.stock !== 1 ? 's' : ''} left`, time: relativeTime(60), icon: Package, color: typeConfig.low_stock.color, dot: typeConfig.low_stock.dot });
  }

  // Recovery
  if ((recovery?.abandoned_carts?.length ?? 0) > 0) {
    events.push({ id: 'recovery', type: 'recovery', title: 'Abandoned Cart Detected', detail: `₹${recovery!.abandoned_carts[0].subtotal.toLocaleString('en-IN')} pending recovery`, time: relativeTime(90), icon: Zap, color: typeConfig.recovery.color, dot: typeConfig.recovery.dot });
  }

  // Paid orders from insights
  if ((insights?.orders?.paid ?? 0) > 0) {
    events.push({ id: 'paid-orders', type: 'order', title: `${insights!.orders.paid} Orders Completed`, detail: `Revenue: ₹${(insights?.revenue?.today ?? 0).toLocaleString('en-IN')}`, time: relativeTime(15), icon: ShoppingBag, color: typeConfig.order.color, dot: typeConfig.order.dot });
  }

  // Sort by most recent and fill with mock if sparse
  const sorted = events.sort((a, b) => {
    const minsA = parseInt(a.time.replace(/[^0-9]/g, '')) * (a.time.includes('h') ? 60 : a.time.includes('d') ? 1440 : 1);
    const minsB = parseInt(b.time.replace(/[^0-9]/g, '')) * (b.time.includes('h') ? 60 : b.time.includes('d') ? 1440 : 1);
    return minsA - minsB;
  });

  return sorted.length >= 3 ? sorted : MOCK_EVENTS;
}

export const MerchantTimeline: React.FC<Props> = ({ insights, inventory, recovery, loading }) => {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex gap-4">
            <div className="w-8 h-8 rounded-xl bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-48" />
              <div className="h-3 bg-slate-100 rounded w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const events = buildEvents(insights, inventory, recovery);

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[18px] top-4 bottom-4 w-px bg-slate-200" />

      <div className="space-y-1">
        {events.map((evt, i) => {
          const cfg = typeConfig[evt.type];
          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-4 relative group"
            >
              {/* Dot on timeline */}
              <div className="relative flex-shrink-0 z-10">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.color} group-hover:scale-110 transition-transform`}>
                  <evt.icon className="w-4 h-4" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 pb-5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{evt.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{evt.detail}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0 whitespace-nowrap mt-0.5">{evt.time}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">No business events yet today</div>
      )}
    </div>
  );
};
