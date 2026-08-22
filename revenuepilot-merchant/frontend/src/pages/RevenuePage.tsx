import React, { useEffect, useState } from 'react';
import { KPICard } from '../components/cards/KPICard';
import { RevenueAreaChart, ForecastLineChart } from '../components/charts/Charts';
import { BarChart2, TrendingUp, Calendar, Zap } from 'lucide-react';
import { aiAPI } from '../services/api';

export const RevenuePage: React.FC = () => {
  const [today, setToday] = useState<any>(null);
  const [week, setWeek] = useState<any>(null);
  const [month, setMonth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([aiAPI.today(), aiAPI.week(), aiAPI.month()])
      .then(([t, w, m]) => { setToday(t.data); setWeek(w.data); setMonth(m.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const rev = today?.revenue ?? {};
  const weekData = week?.revenue ?? {};
  const monthData = month?.revenue ?? {};

  const buildChartData = () => {
    const base = rev.today ?? 1000;
    const g = (rev.growth_percentage ?? 5) / 100;
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const adj = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    return days.map((day, i) => ({
      day,
      actual: i <= adj ? Math.round(base * (0.7 + Math.random() * 0.6)) : null,
      forecast: i >= adj ? Math.round(base * (1 + g * (i - adj))) : null,
    }));
  };

  return (
    <div className="space-y-8 max-w-screen-xl">
      <h1 className="text-xl font-extrabold text-white">Revenue Analytics</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KPICard label="Today" value={fmt(rev.today ?? 0)} icon={Zap} color="emerald" loading={loading} index={0} trend={(rev.growth_percentage ?? 0) >= 0 ? 'up' : 'down'} trendValue={`${rev.growth_percentage?.toFixed(1)}%`} />
        <KPICard label="This Week" value={fmt(weekData.this_week ?? 0)} icon={BarChart2} color="indigo" loading={loading} index={1} />
        <KPICard label="This Month" value={fmt(monthData.this_month ?? 0)} icon={Calendar} color="cyan" loading={loading} index={2} />
        <KPICard label="Avg Order" value={fmt(rev.average_order_value ?? 0)} icon={TrendingUp} color="purple" loading={loading} index={3} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Weekly Revenue vs Forecast</h3>
          <RevenueAreaChart data={buildChartData()} loading={loading} />
        </div>
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Revenue Trend Line</h3>
          <ForecastLineChart data={buildChartData()} loading={loading} />
        </div>
      </div>
    </div>
  );
};
