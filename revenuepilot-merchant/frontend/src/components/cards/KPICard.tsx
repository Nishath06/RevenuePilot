import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface SparkPoint { value: number; }

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  subtext?: string;
  color?: 'emerald' | 'indigo' | 'cyan' | 'amber' | 'rose' | 'purple';
  loading?: boolean;
  index?: number;
  sparkline?: SparkPoint[];
  prefix?: string;
  suffix?: string;
}

const colorMap = {
  emerald: {
    icon: 'bg-emerald-500/10 text-emerald-400',
    glow: 'hover:shadow-emerald-500/10',
    border: 'hover:border-emerald-500/30',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400',
  },
  indigo: {
    icon: 'bg-indigo-500/10 text-indigo-400',
    glow: 'hover:shadow-indigo-500/10',
    border: 'hover:border-indigo-500/30',
    bar: 'bg-indigo-500',
    badge: 'bg-indigo-500/10 text-indigo-400',
  },
  cyan: {
    icon: 'bg-cyan-500/10 text-cyan-400',
    glow: 'hover:shadow-cyan-500/10',
    border: 'hover:border-cyan-500/30',
    bar: 'bg-cyan-500',
    badge: 'bg-cyan-500/10 text-cyan-400',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-400',
    glow: 'hover:shadow-amber-500/10',
    border: 'hover:border-amber-500/30',
    bar: 'bg-amber-400',
    badge: 'bg-amber-500/10 text-amber-400',
  },
  rose: {
    icon: 'bg-rose-500/10 text-rose-400',
    glow: 'hover:shadow-rose-500/10',
    border: 'hover:border-rose-500/30',
    bar: 'bg-rose-500',
    badge: 'bg-rose-500/10 text-rose-400',
  },
  purple: {
    icon: 'bg-purple-500/10 text-purple-400',
    glow: 'hover:shadow-purple-500/10',
    border: 'hover:border-purple-500/30',
    bar: 'bg-purple-500',
    badge: 'bg-purple-500/10 text-purple-400',
  },
};

const MiniSparkline: React.FC<{ points: SparkPoint[]; color: string }> = ({ points, color }) => {
  if (points.length < 2) return null;
  const max = Math.max(...points.map(p => p.value));
  const min = Math.min(...points.map(p => p.value));
  const range = max - min || 1;
  const w = 80, h = 28;
  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * w,
    y: h - ((p.value - min) / range) * h,
  }));
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const stroke = color === 'emerald' ? '#10b981' : color === 'indigo' ? '#6366f1' : color === 'cyan' ? '#22d3ee' : color === 'amber' ? '#f59e0b' : color === 'rose' ? '#ef4444' : '#a855f7';
  return (
    <svg width={w} height={h} className="opacity-60">
      <path d={d} stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
};

export const KPICard: React.FC<KPICardProps> = ({
  label, value, icon: Icon, trend, trendValue, subtext, color = 'emerald',
  loading, index = 0, sparkline, prefix, suffix,
}) => {
  const c = colorMap[color];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400';

  if (loading) {
    return (
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5 space-y-3">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-8 w-32 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -2 }}
      className={clsx(
        'bg-[#111827] rounded-2xl border border-[#1E293B] p-5 cursor-default',
        'hover:shadow-lg transition-all duration-200',
        c.glow, c.border
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', c.icon)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {sparkline && <MiniSparkline points={sparkline} color={color} />}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-extrabold text-white">
          {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}{suffix}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {trend && trendValue ? (
          <div className={clsx('flex items-center gap-1 text-xs font-semibold', trendColor)}>
            <TrendIcon className="w-3.5 h-3.5" />
            {trendValue}
          </div>
        ) : <div />}
        {subtext && <p className="text-[10px] text-slate-600">{subtext}</p>}
      </div>
    </motion.div>
  );
};
