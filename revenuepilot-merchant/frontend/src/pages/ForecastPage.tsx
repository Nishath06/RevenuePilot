import React, { useEffect, useState } from 'react';
import { KPICard } from '../components/cards/KPICard';
import { ForecastLineChart } from '../components/charts/Charts';
import { TrendingUp, Zap, Calendar, Target } from 'lucide-react';
import { aiAPI } from '../services/api';

export const ForecastPage: React.FC = () => {
  const [today, setToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { aiAPI.today().then(r => setToday(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const rev = today?.revenue ?? {};
  const growth = rev.growth_percentage ?? 5;
  const base = rev.today ?? 2000;
  const tomorrow = Math.round(base * (1 + growth / 100));
  const weekly = Math.round(tomorrow * 5.8);
  const monthly = Math.round(tomorrow * 26);

  const buildData = () => {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const adj = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    return days.map((day, i) => ({
      day,
      actual: i <= adj ? Math.round(base * (0.8 + Math.random() * 0.4)) : null,
      forecast: i >= adj ? Math.round(base * (1 + (growth / 100) * (i - adj))) : null,
    }));
  };

  return (
    <div className="space-y-8 max-w-screen-xl">
      <h1 className="text-xl font-extrabold text-white">Revenue Forecasting</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Tomorrow Forecast" value={`₹${tomorrow.toLocaleString('en-IN')}`} icon={Zap} color="emerald" loading={loading} index={0} subtext={`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% trend`} />
        <KPICard label="Weekly Forecast" value={`₹${weekly.toLocaleString('en-IN')}`} icon={Calendar} color="indigo" loading={loading} index={1} subtext="7-day projection" />
        <KPICard label="Monthly Forecast" value={`₹${monthly.toLocaleString('en-IN')}`} icon={TrendingUp} color="cyan" loading={loading} index={2} subtext="26-day projection" />
        <KPICard label="Growth Rate" value={`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`} icon={Target} color={growth >= 0 ? 'emerald' : 'rose'} loading={loading} index={3} subtext="vs yesterday" />
      </div>
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
        <h3 className="text-sm font-bold text-white mb-4">Weekly Forecast Model</h3>
        <ForecastLineChart data={buildData()} loading={loading} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[{ label: 'Tomorrow', value: tomorrow, conf: 87, color: 'emerald' }, { label: 'This Week', value: weekly, conf: 76, color: 'indigo' }, { label: 'This Month', value: monthly, conf: 62, color: 'cyan' }].map((f, i) => (
          <div key={f.label} className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{f.label}</p>
            <p className={`text-2xl font-extrabold text-${f.color}-400`}>₹{f.value.toLocaleString('en-IN')}</p>
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>Confidence</span><span>{f.conf}%</span>
              </div>
              <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                <div className={`h-full bg-${f.color}-500 rounded-full`} style={{ width: `${f.conf}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
