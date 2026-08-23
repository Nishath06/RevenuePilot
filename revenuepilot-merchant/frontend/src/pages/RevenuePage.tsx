import React, { useEffect, useState } from 'react';
import { KPICard } from '../components/cards/KPICard';
import { RevenueAreaChart, PaymentPieChart, GenericLineChart, HeatmapBarChart, HourlyBarChart } from '../components/charts/Charts';
import { DollarSign, BarChart2, Calendar, TrendingUp, ShoppingBag, Clock, Activity, Zap, RefreshCw } from 'lucide-react';
import { aiAPI } from '../services/api';

export const RevenuePage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await aiAPI.revenueMetrics();
      setMetrics(res.data);
    } catch (err) {
      console.error('Failed to load revenue metrics', err);
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
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n ?? 0).toFixed(1)}%`;

  const pmPieData = (metrics?.by_payment_method ?? []).map((m: any) => ({
    name: m.method,
    value: m.amount,
  }));

  const area30dData = (metrics?.trend_30d ?? []).map((d: any) => ({
    day: d.date?.slice(5) || d.date,
    actual: d.revenue,
  }));

  return (
    <div className="space-y-8 max-w-screen-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Live MongoDB Telemetry</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Revenue Analytics & Financial Breakdown</h1>
          <p className="text-xs text-slate-400 mt-1">Daily, weekly, monthly aggregations and gateway transaction distribution</p>
        </div>

        <button
          onClick={() => { setRefreshing(true); loadData(); }}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-[#1E293B] hover:bg-white/5 rounded-xl text-slate-300 text-xs font-bold transition-all w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Task 1 — 8 Live KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Today's Revenue" value={fmt(metrics?.today_revenue)} icon={Zap} color="emerald" loading={loading} index={0} trend={(metrics?.growth_percentage ?? 0) >= 0 ? 'up' : 'down'} trendValue={pct(metrics?.growth_percentage ?? 0)} subtext="vs yesterday" />
        <KPICard label="Yesterday Revenue" value={fmt(metrics?.yesterday_revenue)} icon={Clock} color="indigo" loading={loading} index={1} subtext="Previous 24h total" />
        <KPICard label="Weekly Revenue" value={fmt(metrics?.weekly_revenue)} icon={BarChart2} color="cyan" loading={loading} index={2} subtext="Current 7 days" />
        <KPICard label="Monthly Revenue" value={fmt(metrics?.monthly_revenue)} icon={Calendar} color="purple" loading={loading} index={3} subtext="Current 30 days" />
        <KPICard label="Total Revenue" value={fmt(metrics?.total_revenue)} icon={DollarSign} color="emerald" loading={loading} index={4} subtext="All-time store volume" />
        <KPICard label="Avg Order Value" value={fmt(metrics?.average_order_value)} icon={TrendingUp} color="amber" loading={loading} index={5} subtext="Per paid order" />
        <KPICard label="Revenue Growth %" value={pct(metrics?.growth_percentage ?? 0)} icon={Activity} color={(metrics?.growth_percentage ?? 0) >= 0 ? 'emerald' : 'rose'} loading={loading} index={6} subtext="Daily growth delta" />
        <KPICard label="Total Paid Orders" value={metrics?.total_paid_orders ?? 0} icon={ShoppingBag} color="indigo" loading={loading} index={7} subtext="Completed transactions" />
      </div>

      {/* Recharts Grid — 7-Day Line & 30-Day Area */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">7-Day Revenue Trend</h3>
              <p className="text-xs text-slate-500">Daily revenue line curve</p>
            </div>
            <span className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-mono">Line Chart</span>
          </div>
          <GenericLineChart data={metrics?.trend_7d ?? []} xKey="day" dataKey="revenue" loading={loading} />
        </div>

        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">30-Day Revenue Trend</h3>
              <p className="text-xs text-slate-500">Daily revenue aggregation with gradient fill</p>
            </div>
            <span className="text-[10px] px-2 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md font-mono">Area Chart</span>
          </div>
          <RevenueAreaChart data={area30dData} loading={loading} />
        </div>
      </div>

      {/* Payment Method Breakdown, Weekday Heatmap, and Hourly Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart — Revenue by Payment Method */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-1">Revenue by Payment Method</h3>
          <p className="text-xs text-slate-500 mb-4">Razorpay Card, UPI, NetBanking</p>
          <PaymentPieChart data={pmPieData} loading={loading} />
          <div className="mt-4 space-y-2">
            {(metrics?.by_payment_method ?? []).map((m: any) => (
              <div key={m.method} className="flex justify-between text-xs py-1 border-b border-[#1E293B] last:border-0">
                <span className="text-slate-400 font-semibold">{m.method}</span>
                <span className="font-extrabold text-white">{fmt(m.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap Bar Chart — Weekday Mon-Sun */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-1">Revenue Heatmap by Weekday</h3>
          <p className="text-xs text-slate-500 mb-4">Grouped revenue Mon through Sun</p>
          <HeatmapBarChart data={metrics?.revenue_heatmap ?? []} loading={loading} />
        </div>

        {/* Hourly 24-hour Revenue Chart */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-1">Hourly Revenue Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">24-hour revenue volume breakdown</p>
          <HourlyBarChart data={metrics?.hourly_revenue ?? []} loading={loading} />
        </div>
      </div>
    </div>
  );
};
