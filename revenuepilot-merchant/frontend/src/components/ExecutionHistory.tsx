import React, { useEffect, useState } from 'react';
import { History, CheckCircle, XCircle, Clock, RefreshCw, Filter } from 'lucide-react';
import { automationAPI } from '../services/api';

export interface ExecutionLog {
  execution_id: string;
  rule_name: string;
  trigger: string;
  status: string;
  items_scanned?: number;
  low_stock_count?: number;
  out_of_stock_count?: number;
  duration_ms: number;
  timestamp: string;
}

export const ExecutionHistory: React.FC = () => {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await automationAPI.history();
      setLogs(res.data.history || []);
    } catch (err) {
      console.error('Failed to fetch execution history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 p-5 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            Automation Audit Execution Logs
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable trace history of every executed business automation and cron scan.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3.5 px-5">Rule / Automation Name</th>
                <th className="py-3.5 px-4">Trigger</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Items Scanned</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-5 text-right">Timestamp</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {logs.map((log, idx) => {
                const isSuccess = log.status.toLowerCase() === 'success';

                return (
                  <tr key={log.execution_id || idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-white">
                      {log.rule_name}
                      <span className="block text-[10px] font-mono text-slate-500 font-normal">
                        {log.execution_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {log.trigger}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isSuccess
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {isSuccess ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono">{log.items_scanned ?? '-'}</td>
                    <td className="py-3.5 px-4 font-mono text-indigo-400">{log.duration_ms}ms</td>
                    <td className="py-3.5 px-5 text-right font-mono text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
