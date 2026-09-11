import React, { useEffect, useState } from 'react';
import { Clock, Play, Power, CheckCircle, RefreshCw, Calendar, Tag } from 'lucide-react';
import { automationAPI } from '../services/api';

export interface ScheduleItem {
  id: string;
  schedule_name: string;
  cron_expression: string;
  frequency: string;
  category: string;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  status: string;
  execution_count: number;
  success_count: number;
  failure_count: number;
}

export const SchedulerPanel: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await automationAPI.schedules();
      setSchedules(res.data.schedules || []);
    } catch (err) {
      console.error('Failed to fetch schedules', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    setTogglingId(id);
    try {
      await automationAPI.toggleSchedule(id, !currentStatus);
      await fetchSchedules();
    } catch (err) {
      console.error('Toggle schedule failed', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      await automationAPI.runScheduleNow(id);
      await fetchSchedules();
    } catch (err) {
      console.error('Run schedule now failed', err);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 p-5 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Daily Autonomous Scheduler (Cron Engine)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            AWS EventBridge-compatible cron engine running recurring business automations.
          </p>
        </div>

        <button
          onClick={fetchSchedules}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Schedules
        </button>
      </div>

      {/* Grid of Schedule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {schedules.map((sched) => {
          const isEnabled = sched.enabled;

          return (
            <div
              key={sched.id}
              className={`bg-slate-900/90 rounded-xl border p-5 transition-all shadow-lg relative overflow-hidden backdrop-blur-md ${
                isEnabled ? 'border-slate-800 hover:border-indigo-500/50' : 'border-slate-800/60 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {sched.category || 'General'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      AWS EventBridge
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{sched.id}</span>
                  </div>
                  <h4 className="font-bold text-white text-base">{sched.schedule_name}</h4>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => handleToggle(sched.id, isEnabled)}
                  disabled={togglingId === sched.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Cron Expression & Frequency */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 mb-4 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Frequency:</span>
                  <span className="font-semibold text-slate-200">{sched.frequency}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Cron Spec:</span>
                  <span className="font-mono text-indigo-400 bg-indigo-950/50 px-1.5 py-0.5 rounded text-[11px]">
                    {sched.cron_expression}
                  </span>
                </div>
              </div>

              {/* Execution Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Runs</span>
                  <span className="font-bold text-white">{sched.execution_count}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Success Count</span>
                  <span className="font-bold text-emerald-400">{sched.success_count}</span>
                </div>
              </div>

              {/* Controls & Last Run */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                <div className="text-[10px] text-slate-400">
                  <span>Last Run: {sched.last_run ? new Date(sched.last_run).toLocaleTimeString() : 'Pending'}</span>
                </div>

                <button
                  onClick={() => handleRunNow(sched.id)}
                  disabled={runningId === sched.id}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-xs transition-all flex items-center gap-1.5 shadow"
                >
                  <Play className={`w-3 h-3 ${runningId === sched.id ? 'animate-spin' : ''}`} />
                  Run Now
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
