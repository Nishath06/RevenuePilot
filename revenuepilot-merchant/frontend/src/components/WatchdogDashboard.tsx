import React, { useEffect, useState } from 'react';
import { Eye, ShieldAlert, CheckCircle, AlertTriangle, Play, RefreshCw, Zap, Flame, PackageCheck } from 'lucide-react';
import { automationAPI } from '../services/api';

export interface WatchdogItem {
  id: string;
  name: string;
  status: 'Healthy' | 'Warning' | 'Critical';
  last_scan: string;
  duration_ms: number;
  items_scanned: number;
  issues_found: number;
  retry_count: number;
  latency_ms: number;
  description: string;
}

export const WatchdogDashboard: React.FC = () => {
  const [watchdogs, setWatchdogs] = useState<WatchdogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchWatchdogs = async () => {
    setLoading(true);
    try {
      const res = await automationAPI.watchdogs();
      setWatchdogs(res.data.watchdogs || []);
    } catch (err) {
      console.error('Failed to fetch watchdogs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchdogs();
  }, []);

  const handleRunInventoryWatchdog = async () => {
    setActionLoading('inventory');
    try {
      await automationAPI.triggerInventoryWatchdog();
      await fetchWatchdogs();
    } catch (err) {
      console.error('Inventory watchdog trigger failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunPopularityScan = async () => {
    setActionLoading('popularity');
    try {
      await automationAPI.triggerPopularityWatchdog();
      await fetchWatchdogs();
    } catch (err) {
      console.error('Popularity scan failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 p-5 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-400" />
            Watchdog Monitoring Center
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            CloudWatch-backed autonomous scanners monitoring merchant anomalies & stock levels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRunInventoryWatchdog}
            disabled={actionLoading === 'inventory'}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Play className={`w-3.5 h-3.5 ${actionLoading === 'inventory' ? 'animate-spin' : ''}`} />
            Run Inventory Scan
          </button>

          <button
            onClick={handleRunPopularityScan}
            disabled={actionLoading === 'popularity'}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Flame className={`w-3.5 h-3.5 ${actionLoading === 'popularity' ? 'animate-pulse' : ''}`} />
            Run Popularity Intelligence
          </button>

          <button
            onClick={fetchWatchdogs}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid of Watchdog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {watchdogs.map((wd) => {
          const isWarning = wd.status === 'Warning';
          const isCritical = wd.status === 'Critical';

          return (
            <div
              key={wd.id}
              className={`bg-slate-900/90 rounded-xl border p-5 transition-all hover:border-indigo-500/50 shadow-lg relative overflow-hidden backdrop-blur-md ${
                isCritical
                  ? 'border-red-500/40 bg-red-950/10'
                  : isWarning
                  ? 'border-amber-500/40 bg-amber-950/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg ${
                      isCritical
                        ? 'bg-red-500/20 text-red-400'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {isCritical ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <CheckCircle className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-sm">{wd.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400">ID: {wd.id}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isCritical
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {wd.status}
                  </span>
                  <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> CloudWatch Synced
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-4 line-clamp-2">{wd.description}</p>

              {/* Stats Metadata */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Items Scanned</span>
                  <span className="font-bold text-white">{wd.items_scanned}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Issues Found</span>
                  <span className={`font-bold ${wd.issues_found > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {wd.issues_found}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Latency</span>
                  <span className="font-mono text-indigo-400">{wd.latency_ms}ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Duration</span>
                  <span className="font-mono text-slate-300">{wd.duration_ms}ms</span>
                </div>
              </div>

              <div className="mt-3 flex justify-between items-center text-[10px] text-slate-400">
                <span>Last Scan: {new Date(wd.last_scan).toLocaleTimeString()}</span>
                <span className="text-slate-400">Retries: {wd.retry_count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
