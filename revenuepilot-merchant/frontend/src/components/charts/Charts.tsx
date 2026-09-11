import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const DARK_TOOLTIP = {
  contentStyle: {
    background: '#111827',
    border: '1px solid #1E293B',
    borderRadius: 12,
    fontSize: 12,
    color: '#e2e8f0',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
  },
  labelStyle: { color: '#94a3b8', marginBottom: 4 },
};

const COLORS = {
  emerald: '#10b981', indigo: '#6366f1', cyan: '#22d3ee',
  amber: '#f59e0b', rose: '#ef4444', purple: '#a855f7', slate: '#64748b',
};

const PIE_PALETTE = [COLORS.emerald, COLORS.indigo, COLORS.cyan, COLORS.amber, COLORS.rose, COLORS.purple];

// ── Revenue Area Chart ────────────────────────────────────────────────────────
export const RevenueAreaChart: React.FC<{ data: any[]; loading?: boolean }> = ({ data, loading }) => {
  if (loading) return <div className="skeleton h-64 rounded-2xl" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.indigo} stopOpacity={0.2} />
            <stop offset="95%" stopColor={COLORS.indigo} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
        <Tooltip {...DARK_TOOLTIP} formatter={(v: unknown) => [`₹${(v as number).toLocaleString('en-IN')}`, '']} />
        <Area type="monotone" dataKey="actual" stroke={COLORS.emerald} strokeWidth={2} fill="url(#revGrad)" name="Actual" connectNulls dot={false} />
        <Area type="monotone" dataKey="forecast" stroke={COLORS.indigo} strokeWidth={2} strokeDasharray="5 3" fill="url(#forecastGrad)" name="Forecast" connectNulls dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ── Orders Bar Chart ──────────────────────────────────────────────────────────
export const OrdersBarChart: React.FC<{ data: any[]; loading?: boolean }> = ({ data, loading }) => {
  if (loading) return <div className="skeleton h-64 rounded-2xl" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip {...DARK_TOOLTIP} />
        <Bar dataKey="paid" name="Paid" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
        <Bar dataKey="pending" name="Pending" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
        <Bar dataKey="failed" name="Failed" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Payment Pie Chart ─────────────────────────────────────────────────────────
export const PaymentPieChart: React.FC<{ data: any[]; loading?: boolean }> = ({ data, loading }) => {
  if (loading) return <div className="skeleton h-48 rounded-2xl" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
          paddingAngle={3} dataKey="value" nameKey="name">
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip {...DARK_TOOLTIP} formatter={(v: unknown) => [(v as number).toFixed(1) + '%', '']} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── Revenue Line Chart (Forecast) ─────────────────────────────────────────────
export const ForecastLineChart: React.FC<{ data: any[]; loading?: boolean }> = ({ data, loading }) => {
  if (loading) return <div className="skeleton h-64 rounded-2xl" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip {...DARK_TOOLTIP} formatter={(v: unknown) => [`₹${(v as number).toLocaleString('en-IN')}`, '']} />
        <Line type="monotone" dataKey="actual" stroke={COLORS.emerald} strokeWidth={2} dot={false} name="Actual" />
        <Line type="monotone" dataKey="forecast" stroke={COLORS.indigo} strokeWidth={2} strokeDasharray="5 3" dot={false} name="Forecast" />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Inventory Bar Chart ────────────────────────────────────────────────────────
export const InventoryBarChart: React.FC<{ data: any[]; loading?: boolean }> = ({ data, loading }) => {
  if (loading) return <div className="skeleton h-48 rounded-2xl" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 60 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
        <Tooltip {...DARK_TOOLTIP} />
        <Bar dataKey="stock" name="Stock" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.stock === 0 ? COLORS.rose : d.stock <= 5 ? COLORS.amber : COLORS.emerald} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Generic Line Chart ─────────────────────────────────────────────────────────
export const GenericLineChart: React.FC<{ data: any[]; xKey: string; dataKey: string; stroke?: string; loading?: boolean }> = ({ data, xKey, dataKey, stroke = COLORS.emerald, loading }) => {
  if (loading) return <div className="skeleton h-64 rounded-2xl" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 15, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
        <Tooltip {...DARK_TOOLTIP} formatter={(v: unknown) => [`₹${(v as number).toLocaleString('en-IN')}`, 'Revenue']} />
        <Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2.5} dot={{ r: 4, fill: stroke }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Heatmap Bar Chart (Weekday Mon-Sun) ───────────────────────────────────────
export const HeatmapBarChart: React.FC<{ data: any[]; loading?: boolean }> = ({ data, loading }) => {
  if (loading) return <div className="skeleton h-48 rounded-2xl" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey="weekday" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
        <Tooltip {...DARK_TOOLTIP} formatter={(v: unknown) => [`₹${(v as number).toLocaleString('en-IN')}`, 'Revenue']} />
        <Bar dataKey="revenue" name="Revenue" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Hourly Bar Chart (24-Hour) ────────────────────────────────────────────────
export const HourlyBarChart: React.FC<{ data: any[]; loading?: boolean }> = ({ data, loading }) => {
  if (loading) return <div className="skeleton h-48 rounded-2xl" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => `₹${v}`} />
        <Tooltip {...DARK_TOOLTIP} formatter={(v: unknown) => [`₹${(v as number).toLocaleString('en-IN')}`, 'Hourly Rev']} />
        <Bar dataKey="revenue" name="Hourly Revenue" fill={COLORS.cyan} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

