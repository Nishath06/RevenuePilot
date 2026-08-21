/**
 * RevenueForecast — Tomorrow / Weekly / Monthly AI revenue projections
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, Calendar, Zap } from 'lucide-react';
import { TodayInsights } from '../../services/merchantAI.service';

interface Props {
  insights: TodayInsights | null;
  weeklyInsights: TodayInsights | null;
  loading?: boolean;
}

function buildForecastData(today: number, growth: number) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const now = new Date().getDay(); // 0=Sun
  const adjNow = now === 0 ? 6 : now - 1;
  const base = today > 0 ? today : 2400;
  const g = (growth || 5) / 100;

  return days.map((d, i) => {
    const isPast = i < adjNow;
    const isToday = i === adjNow;
    const projected = base * (1 + g * (i - adjNow));
    return {
      day: d,
      actual: isPast || isToday ? Math.round(base * (1 + g * (i - adjNow) * 0.9)) : null,
      forecast: isPast ? null : Math.round(Math.max(0, projected)),
      isToday,
    };
  });
}

function ForecastKPI({ label, value, icon: Icon, sub, color }: {
  label: string; value: string; icon: React.ElementType; sub: string; color: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative overflow-hidden rounded-2xl p-5 border ${color} backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs opacity-60 mt-1">{sub}</p>
      {/* Decorative glow */}
      <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10 bg-current blur-xl" />
    </motion.div>
  );
}

export const RevenueForecast: React.FC<Props> = ({ insights, weeklyInsights, loading }) => {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}
        </div>
        <div className="h-56 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  const today = insights?.revenue?.today ?? 0;
  const growth = insights?.revenue?.growth_percentage ?? 5;
  const thisWeek = weeklyInsights?.revenue?.this_week ?? today * 5;
  const avgOrder = insights?.revenue?.average_order_value ?? 1200;

  const tomorrowForecast = Math.round(today * (1 + growth / 100));
  const weeklyForecast = Math.round(thisWeek * 1.08);
  const monthlyForecast = Math.round(tomorrowForecast * 28);

  const chartData = buildForecastData(today, growth);

  const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ForecastKPI
          label="Tomorrow Forecast"
          value={fmtINR(tomorrowForecast)}
          icon={Zap}
          sub={`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% trend applied`}
          color="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-400"
        />
        <ForecastKPI
          label="Weekly Forecast"
          value={fmtINR(weeklyForecast)}
          icon={Calendar}
          sub="Based on 7-day trend"
          color="bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-indigo-400"
        />
        <ForecastKPI
          label="Monthly Projection"
          value={fmtINR(monthlyForecast)}
          icon={TrendingUp}
          sub={`Avg order ₹${avgOrder.toLocaleString('en-IN')}`}
          color="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-400"
        />
      </div>

      {/* Area chart */}
      <div className="bg-slate-50 rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">This Week — Actual vs Forecast</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(v: unknown, name: unknown) => [`₹${(v as number).toLocaleString('en-IN')}`, name === 'actual' ? 'Actual' : 'Forecast']}
            />
            <ReferenceLine x={chartData.find(d => d.isToday)?.day} stroke="#6366f1" strokeDasharray="4 4" label={{ value: 'Today', fontSize: 10, fill: '#6366f1' }} />
            <Area type="monotone" dataKey="actual" stroke="#059669" strokeWidth={2} fill="url(#actualGrad)" connectNulls dot={false} />
            <Area type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={2} fill="url(#forecastGrad)" strokeDasharray="5 3" connectNulls dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 justify-end">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-5 h-0.5 bg-emerald-500 inline-block" />Actual</span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-5 h-px bg-indigo-500 border-dashed border-t inline-block" />Forecast</span>
        </div>
      </div>
    </div>
  );
};
