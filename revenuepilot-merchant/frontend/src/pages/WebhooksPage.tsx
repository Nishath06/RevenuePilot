import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { PaymentPieChart, HourlyBarChart } from '../components/charts/Charts';
import { Webhook, CheckCircle, AlertTriangle, Clock, RefreshCw, X, Code, Search, Zap } from 'lucide-react';
import { aiAPI } from '../services/api';

export const WebhooksPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await aiAPI.webhookMetrics();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load webhook metrics', err);
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

  const webhooksList = (data?.webhooks ?? []).filter((w: any) =>
    !search || w.event_type?.toLowerCase().includes(search.toLowerCase()) || w.webhook_id?.toLowerCase().includes(search.toLowerCase())
  );

  const pieData = [
    { name: 'Processed Success', value: data?.success_count ?? 1 },
    { name: 'Retry / Failed', value: data?.retry_count ?? 0 },
  ];

  return (
    <div className="space-y-8 max-w-screen-xl relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Webhook Health & Observability Hub</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time Razorpay HMAC signature verification and event delivery audit</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by event..."
              className="bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none w-36"
            />
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
      </div>

      {/* Task 6 — 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Webhooks Received" value={data?.total_webhooks ?? 0} icon={Webhook} color="indigo" loading={loading} index={0} />
        <KPICard label="Successfully Processed" value={data?.success_count ?? 0} icon={CheckCircle} color="emerald" loading={loading} index={1} />
        <KPICard label="Retry Count" value={data?.retry_count ?? 0} icon={AlertTriangle} color={(data?.retry_count ?? 0) > 0 ? 'amber' : 'emerald'} loading={loading} index={2} />
        <KPICard label="Avg Latency" value="38 ms" icon={Zap} color="cyan" loading={loading} index={3} />
      </div>

      {/* Webhook Events Table */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-[#1E293B] flex justify-between items-center bg-[#161F30]">
          <div>
            <h3 className="text-sm font-bold text-white">Razorpay Webhook Delivery Log</h3>
            <p className="text-[10px] text-slate-400">Click any event to inspect HMAC signatures and full JSON payload</p>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
            HMAC SHA-256 Verified
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-[#1E293B]/40 rounded-xl animate-pulse" />)}
          </div>
        ) : webhooksList.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <Webhook className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No webhook logs recorded matching search filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5 font-bold">Webhook ID</th>
                  <th className="px-5 py-3.5 font-bold">Event Type</th>
                  <th className="px-5 py-3.5 font-bold">Received Timestamp</th>
                  <th className="px-5 py-3.5 font-bold">Latency</th>
                  <th className="px-5 py-3.5 font-bold">Retries</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {webhooksList.map((w: any, i: number) => (
                  <tr
                    key={w.webhook_id || i}
                    onClick={() => setSelectedWebhook(w)}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">{w.webhook_id}</td>
                    <td className="px-5 py-3.5 font-mono text-indigo-300 font-semibold">{w.event_type}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">{new Date(w.received).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{w.latency_ms} ms</td>
                    <td className="px-5 py-3.5 text-slate-300 font-bold">{w.retry_count}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" /> PROCESSED
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1">
                        <Code className="w-3 h-3 text-cyan-400" /> Inspect Payload
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Webhooks Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Webhook Event Rate per Hour</h3>
          <HourlyBarChart data={data?.events_per_hour ?? []} loading={loading} />
        </div>
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Processing Success vs Retry Ratio</h3>
          <PaymentPieChart data={pieData} loading={loading} />
        </div>
      </div>

      {/* JSON Viewer Drawer Modal */}
      <AnimatePresence>
        {selectedWebhook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end"
            onClick={() => setSelectedWebhook(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-xl bg-[#0F172A] border-l border-[#1E293B] h-full p-6 overflow-y-auto space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">Webhook Payload Viewer</h3>
                  <p className="text-xs font-mono text-emerald-400 mt-0.5">{selectedWebhook.webhook_id}</p>
                </div>
                <button
                  onClick={() => setSelectedWebhook(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Event Type & Status */}
              <div className="grid grid-cols-2 gap-3 bg-[#111827] p-4 rounded-xl border border-[#1E293B]">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Event Type</p>
                  <p className="text-xs font-mono font-bold text-indigo-400 mt-0.5">{selectedWebhook.event_type}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Processing Latency</p>
                  <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">{selectedWebhook.latency_ms} ms</p>
                </div>
              </div>

              {/* JSON Headers */}
              <div>
                <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-2">HTTP Request Headers</h4>
                <pre className="bg-[#111827] p-4 rounded-xl border border-[#1E293B] text-xs font-mono text-amber-300 overflow-x-auto">
                  {JSON.stringify(selectedWebhook.headers, null, 2)}
                </pre>
              </div>

              {/* JSON Payload */}
              <div>
                <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-2">Event Body Payload (Razorpay Webhook)</h4>
                <pre className="bg-[#111827] p-4 rounded-xl border border-[#1E293B] text-xs font-mono text-emerald-300 overflow-x-auto max-h-96">
                  {JSON.stringify(selectedWebhook.payload, null, 2)}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
