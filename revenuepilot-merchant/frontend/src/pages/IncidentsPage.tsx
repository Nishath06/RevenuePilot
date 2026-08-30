import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { AlertCircle, AlertTriangle, CheckCircle, Database, Zap, CreditCard, RefreshCw, ShieldAlert, Check } from 'lucide-react';
import { aiAPI } from '../services/api';
import { merchantIntelAPI } from '../services/api';
import toast from 'react-hot-toast';

export const IncidentsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolving, setResolving] = useState<Set<string>>(new Set());

  const loadData = async () => {
    try {
      const res = await aiAPI.incidentMetrics();
      setData(res.data);
      setIncidents(res.data?.incidents ?? []);
    } catch (err) {
      console.error('Failed to load incident metrics', err);
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

  const handleResolve = async (id: string) => {
    if (!id) return;
    // Optimistic update
    setIncidents((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'resolved' } : item))
    );
    setResolving((s) => new Set([...s, id]));
    try {
      await merchantIntelAPI.resolveIncident(id);
      toast.success('Incident resolved and saved');
    } catch (err) {
      console.error('Failed to resolve incident in MongoDB', err);
      // Rollback optimistic update on failure
      setIncidents((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'open' } : item))
      );
      toast.error('Failed to resolve incident — please retry');
    } finally {
      setResolving((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };



  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full text-[10px] font-extrabold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> CRITICAL</span>;
      case 'high':
        return <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-full text-[10px] font-extrabold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> HIGH</span>;
      case 'medium':
        return <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-[10px] font-extrabold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> MEDIUM</span>;
      default:
        return <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-full text-[10px] font-extrabold flex items-center gap-1"><Zap className="w-3 h-3" /> LOW</span>;
    }
  };

  return (
    <div className="space-y-8 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Incident Response & Operational Telemetry</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time system watchdog for MongoDB, Store API, Razorpay webhooks, and payment failures</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); loadData(); }}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-[#1E293B] hover:bg-white/5 rounded-xl text-slate-300 text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Task 7 — 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Critical Alerts" value={data?.critical_alerts ?? 0} icon={ShieldAlert} color={(data?.critical_alerts ?? 0) > 0 ? 'rose' : 'emerald'} loading={loading} index={0} />
        <KPICard label="Warnings Count" value={data?.warnings ?? 0} icon={AlertTriangle} color={(data?.warnings ?? 0) > 0 ? 'amber' : 'emerald'} loading={loading} index={1} />
        <KPICard label="Resolved Incidents" value={data?.resolved_incidents ?? 0} icon={CheckCircle} color="emerald" loading={loading} index={2} />
        <KPICard label="Webhook Failures" value={data?.webhook_failures ?? 0} icon={Zap} color={(data?.webhook_failures ?? 0) > 0 ? 'rose' : 'emerald'} loading={loading} index={3} />
      </div>

      {/* System Status Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between ${
        (data?.critical_alerts ?? 0) > 0 || (data?.warnings ?? 0) > 0
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${
            (data?.critical_alerts ?? 0) > 0 ? 'bg-rose-500 animate-ping' : (data?.warnings ?? 0) > 0 ? 'bg-amber-400' : 'bg-emerald-400'
          }`} />
          <div>
            <p className="text-sm font-bold text-white">
              {(data?.critical_alerts ?? 0) > 0
                ? 'Action Required: Critical telemetry issues detected'
                : (data?.warnings ?? 0) > 0
                ? 'System Operational with Warnings'
                : 'All Core Microservices Operational & Healthy'}
            </p>
            <p className="text-xs opacity-80">Automatic watchdog monitoring active every 15 seconds.</p>
          </div>
        </div>
      </div>

      {/* Incidents Feed */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-[#1E293B] flex justify-between items-center bg-[#161F30]">
          <div>
            <h3 className="text-sm font-bold text-white">Live Incident Stream</h3>
            <p className="text-[10px] text-slate-400">Track and acknowledge component failures or alerts</p>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full font-bold">
            Telemetry Feed
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[#1E293B]/40 rounded-xl animate-pulse" />)}
          </div>
        ) : incidents.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-60" />
            No open incidents or system alerts detected.
          </div>
        ) : (
          <div className="divide-y divide-[#1E293B]">
            {incidents.map((inc: any, i: number) => (
              <motion.div
                key={inc.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-extrabold text-white">{inc.title}</span>
                    {getSeverityBadge(inc.severity)}
                    <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">
                      Component: {inc.component}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{inc.description}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Timestamp: {inc.timestamp}</p>
                </div>

                <div className="flex items-center gap-2">
                  {inc.status === 'resolved' ? (
                    <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolve(inc.id)}
                      className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark as Resolved
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
