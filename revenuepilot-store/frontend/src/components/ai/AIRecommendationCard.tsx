/**
 * AIRecommendationCard — Individual recommendation with priority badge
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, ShoppingBag, CreditCard, Users, Package } from 'lucide-react';

interface Props {
  recommendation: string;
  index?: number;
  onApply?: (rec: string) => void;
}

function parsePriority(rec: string): 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
  if (rec.includes('[HIGH]'))   return 'HIGH';
  if (rec.includes('[MEDIUM]')) return 'MEDIUM';
  if (rec.includes('[LOW]'))    return 'LOW';
  return 'INFO';
}

function detectCategory(rec: string): string {
  const lower = rec.toLowerCase();
  if (lower.includes('revenue') || lower.includes('sale') || lower.includes('flash')) return 'Revenue';
  if (lower.includes('payment') || lower.includes('upi') || lower.includes('fail')) return 'Payments';
  if (lower.includes('stock') || lower.includes('inventory') || lower.includes('reorder')) return 'Inventory';
  if (lower.includes('customer') || lower.includes('loyalt') || lower.includes('cart')) return 'Customers';
  return 'Strategy';
}

function detectIcon(category: string): React.ReactNode {
  switch (category) {
    case 'Revenue':   return <TrendingUp className="w-4 h-4" />;
    case 'Payments':  return <CreditCard className="w-4 h-4" />;
    case 'Inventory': return <Package className="w-4 h-4" />;
    case 'Customers': return <Users className="w-4 h-4" />;
    default:          return <ShoppingBag className="w-4 h-4" />;
  }
}

const priorityStyle = {
  HIGH:   { badge: 'bg-rose-100 text-rose-700 border-rose-200',     bar: 'bg-rose-500',   border: 'border-rose-200'   },
  MEDIUM: { badge: 'bg-amber-100 text-amber-700 border-amber-200',   bar: 'bg-amber-500',  border: 'border-amber-200'  },
  LOW:    { badge: 'bg-sky-100 text-sky-700 border-sky-200',         bar: 'bg-sky-400',    border: 'border-sky-200'    },
  INFO:   { badge: 'bg-slate-100 text-slate-600 border-slate-200',   bar: 'bg-emerald-500', border: 'border-emerald-200' },
};

// Strip "[HIGH]", "[MEDIUM]", "[LOW]" prefix for display
function cleanText(rec: string): string {
  return rec.replace(/^\[(HIGH|MEDIUM|LOW)\]\s*/, '');
}

export const AIRecommendationCard: React.FC<Props> = ({ recommendation, index = 0, onApply }) => {
  const priority = parsePriority(recommendation);
  const category = detectCategory(recommendation);
  const style = priorityStyle[priority];
  const text = cleanText(recommendation);

  // Split on the first '. ' to get title / body
  const dotIdx = text.indexOf('. ');
  const title = dotIdx > -1 ? text.slice(0, dotIdx) : text.slice(0, 60);
  const body = dotIdx > -1 ? text.slice(dotIdx + 2) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className={`bg-white rounded-2xl border ${style.border} shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
    >
      {/* Priority bar */}
      <div className={`h-1 ${style.bar}`} />

      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg ${style.badge} border`}>{detectIcon(category)}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>{priority}</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{category}</span>
          </div>
        </div>

        <p className="text-sm font-bold text-slate-800 leading-snug">{title}</p>
        {body && <p className="text-xs text-slate-500 leading-relaxed">{body}</p>}

        {onApply && (
          <motion.button
            whileHover={{ x: 4 }}
            onClick={() => onApply(recommendation)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 mt-1 transition-colors"
          >
            Ask AI about this <ArrowRight className="w-3 h-3" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
