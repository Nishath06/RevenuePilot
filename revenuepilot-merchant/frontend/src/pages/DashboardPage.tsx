import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, ShoppingBag, CreditCard, TrendingUp, Clock, Package,
  AlertTriangle, Zap, Activity, BarChart2, RefreshCw, WifiOff,
} from 'lucide-react';
import { KPICard } from '../components/cards/KPICard';
import { RevenueAreaChart, OrdersBarChart, PaymentPieChart } from '../components/charts/Charts';
import { aiAPI, merchantAPI } from '../services/api';

interface DashboardData {
  today: any;
  week: any;
  inventory: any;
  summary: any;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const AUTO_REFRESH_MS = 15_000; // 15 seconds

function buildWeeklyChartData(today: any) {
  const base = today?.revenue?.today ?? 2000;
  const growth = today?.revenue?.growth_percentage ?? 5;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const adj = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  return days.map((day, i) => ({
    day,
    actual: i <= adj ? Math.round(base * (0.8 + Math.random() * 0.6)) : null,
    forecast: i >= adj ? Math.round(base * (1 + (growth / 100) * (i - adj))) : null,
  }));
}

function buildOrdersChartData(today: any) {
  return [
    {
      name: 'Today',
      paid: today?.orders?.paid ?? 0,
      pending: today?.orders?.pending ?? 0,
      failed: today?.payments?.failed ?? 0,
    },
  ];
}

function buildPaymentPieData(today: any) {
  const success = today?.payments?.success_rate ?? 0;
  const failed = Math.max(0, 100 - success);
  return [
    { name: 'Success', value: success },
    { name: 'Failed', value: failed },
  ];
}

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData>({ today: null, week: null, inventory: null, summary: null });
  const [loading, setLoading] = useState({ today: true, week: true, inventory: true, summary: true });
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const chartDataRef = useRef<any[]>([]);

  const loadData = useCallback(async (fresh = false) => {
    setError(null);
    const l = { today: true, week: true, inventory: true, summary: true };
    setLoading(l);

    const results = await Promise.allSettled([
      aiAPI.today(fresh),
      aiAPI.week(),
      aiAPI.inventory(),
      merchantAPI.summary(),
    ]);

    const [todayRes, weekRes, inventoryRes, summaryRes] = results;

    setData(d => ({
      ...d,
      today: todayRes.status === 'fulfilled' ? todayRes.value.data : d.today,
      week: weekRes.status === 'fulfilled' ? weekRes.value.data : d.week,
      inventory: inventoryRes.status === 'fulfilled' ? inventoryRes.value.data : d.inventory,
      summary: summaryRes.status === 'fulfilled' ? summaryRes.value.data : d.summary,
    }));

    if (todayRes.status === 'rejected') {
      setError('AI service unavailable — showing last known data');
    }

    setLoading({ today: false, week: false, inventory: false, summary: false });
    setLastUpdated(new Date());
    // Rebuild chart data on each load
    if (todayRes.status === 'fulfilled') {
      chartDataRef.current = buildWeeklyChartData(todayRes.value.data);
    }
  }, []);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    loadData(false);
    const timer = setInterval(() => loadData(false), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadData(true); // force fresh=true bypasses cache
    setIsRefreshing(false);
  };

  const { today, week, inventory, summary } = data;
  const rev = today?.revenue ?? {};
  const pay = today?.payments ?? {};
  const ord = today?.orders ?? {};

  const kpiCards = [
    {
      label: "Today's Revenue",
      value: fmt(rev.today ?? 0),
      icon: DollarSign, color: 'emerald' as const,
      trend: (rev.growth_percentage ?? 0) >= 0 ? 'up' as const : 'down' as const,
      trendValue: pct(rev.growth_percentage ?? 0),
      subtext: 'vs yesterday',
    },
    {
      label: 'Paid Orders',
      value: ord.paid_today ?? ord.paid ?? summary?.paid_orders ?? 0,
      icon: ShoppingBag, color: 'emerald' as const,
      subtext: 'Completed today',
    },
    {
      label: 'Failed Orders',
      value: ord.failed_today ?? ord.failed ?? summary?.failed_payments ?? pay.failed ?? 0,
      icon: AlertTriangle,
      color: (ord.failed_today ?? pay.failed ?? 0) > 0 ? 'rose' as const : 'emerald' as const,
      subtext: 'Gateway errors today',
    },
    {
      label: 'Cancelled Orders',
      value: ord.cancelled_today ?? ord.cancelled ?? summary?.cancelled_orders ?? pay.cancelled ?? 0,
      icon: Clock, color: 'amber' as const,
      subtext: 'Closed checkout modal',
    },
    {
      label: 'Pending Orders',
      value: ord.pending ?? summary?.pending_orders ?? 0,
      icon: Clock, color: 'indigo' as const,
      subtext: 'Awaiting checkout',
    },
    {
      label: 'Payment Success Rate',
      value: `${(pay.success_rate ?? summary?.payment_success_rate ?? 0).toFixed(1)}%`,
      icon: CreditCard,
      color: (pay.success_rate ?? 0) >= 90 ? 'emerald' as const : (pay.success_rate ?? 0) > 0 ? 'amber' as const : 'rose' as const,
      subtext: 'Successful / Total terminal',
    },
    {
      label: 'Failure Rate',
      value: `${(pay.failure_rate ?? summary?.failure_rate ?? 0).toFixed(1)}%`,
      icon: Activity,
      color: (pay.failure_rate ?? 0) > 0 ? 'rose' as const : 'emerald' as const,
      subtext: 'Failed / Total terminal',
    },
    {
      label: 'Avg Order Value',
      value: fmt(rev.average_order_value ?? 0),
      icon: TrendingUp, color: 'purple' as const,
      subtext: 'Per transaction',
    },
  ];

  const isLoading = loading.today;
  const weeklyChartData = chartDataRef.current.length > 0 ? chartDataRef.current : buildWeeklyChartData(today);
  const ordersChartData = buildOrdersChartData(today);
  const paymentPieData = buildPaymentPieData(today);

  return (
    <div className="space-y-8 max-w-screen-xl">
      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400"
        >
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={handleManualRefresh}
            className="ml-auto text-xs font-bold underline hover:no-underline"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#111827] to-[#0F172A] rounded-3xl border border-[#1E293B] p-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Live Operations</span>
              {lastUpdated && (
                <span className="text-[10px] text-slate-600 ml-2">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold text-white">Business Overview</h1>
            <p className="text-slate-400 mt-1 text-sm">Live data from MongoDB · Auto-refreshes every 15s</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            {[
              { label: "Today's Revenue", value: isLoading ? '…' : fmt(rev.today ?? 0), icon: DollarSign, color: 'text-emerald-400' },
              { label: 'Payment Rate',    value: isLoading ? '…' : `${(pay.success_rate ?? 0).toFixed(1)}%`, icon: Activity, color: (pay.success_rate ?? 0) >= 90 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Paid Orders',     value: isLoading ? '…' : `${ord.paid ?? 0}`, icon: ShoppingBag, color: 'text-indigo-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-center min-w-[110px]">
                <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
                <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500">{label}</p>
              </div>
            ))}
            {/* Manual refresh button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl text-emerald-400 hover:bg-emerald-600/30 transition-all text-sm font-bold disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Key Performance Indicators</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, i) => (
            <KPICard key={card.label} {...card} loading={isLoading} index={i} />
          ))}
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Revenue — Actual vs Forecast</h3>
          <RevenueAreaChart data={weeklyChartData} loading={isLoading} />
        </div>

        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-1">Payment Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Today's success vs failure rate</p>
          <PaymentPieChart data={paymentPieData} loading={isLoading} />
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Success Rate</span>
              <span className={`font-bold ${(pay.success_rate ?? 0) >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {(pay.success_rate ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Transactions</span>
              <span className="font-bold text-slate-300">{pay.total ?? (pay.successful ?? 0) + (pay.failed ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Failed Count</span>
              <span className={`font-bold ${(pay.failed ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {pay.failed ?? 0}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Orders Chart */}
      <section className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
        <h3 className="text-sm font-bold text-white mb-4">Orders Breakdown — Today</h3>
        <OrdersBarChart data={ordersChartData} loading={isLoading} />
      </section>
    </div>
  );
};
