/**
 * BusinessHealthCard — Single KPI metric card with animation
 */
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: 'emerald' | 'indigo' | 'rose' | 'amber' | 'sky' | 'violet' | 'slate';
  loading?: boolean;
  index?: number;
}

const colorMap = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  value: 'text-indigo-600',  badge: 'bg-indigo-100  text-indigo-700'  },
  rose:    { bg: 'bg-rose-50',    icon: 'text-rose-600',    value: 'text-rose-600',    badge: 'bg-rose-100    text-rose-700'    },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   value: 'text-amber-600',   badge: 'bg-amber-100   text-amber-700'   },
  sky:     { bg: 'bg-sky-50',     icon: 'text-sky-600',     value: 'text-sky-600',     badge: 'bg-sky-100     text-sky-700'     },
  violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600',  value: 'text-violet-600',  badge: 'bg-violet-100  text-violet-700'  },
  slate:   { bg: 'bg-slate-100',  icon: 'text-slate-600',   value: 'text-slate-800',   badge: 'bg-slate-200   text-slate-700'   },
};

export const BusinessHealthCard: React.FC<Props> = ({
  label, value, subtext, icon: Icon, trend, trendValue, color, loading, index = 0,
}) => {
  const c = colorMap[color];

  if (loading) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 animate-pulse">
        <div className="flex justify-between items-start">
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="h-9 w-9 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-8 w-32 bg-slate-200 rounded" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: 'easeOut' }}
      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-xl ${c.bg}`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>

      <p className={`text-2xl font-extrabold ${c.value}`}>{value}</p>

      {(subtext || trendValue) && (
        <div className="flex items-center gap-2">
          {trendValue && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              trend === 'up' ? 'bg-emerald-100 text-emerald-700' :
              trend === 'down' ? 'bg-rose-100 text-rose-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </span>
          )}
          {subtext && <span className="text-xs text-slate-400">{subtext}</span>}
        </div>
      )}
    </motion.div>
  );
};
