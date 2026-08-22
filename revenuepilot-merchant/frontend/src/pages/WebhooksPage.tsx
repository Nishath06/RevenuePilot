import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Webhook, CheckCircle, XCircle, Clock, Search } from 'lucide-react';
import { aiAPI, merchantAPI } from '../services/api';

export const WebhooksPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      aiAPI.events().then(r => Array.isArray(r.data) ? r.data : r.data?.events ?? []),
      merchantAPI.events().then(r => Array.isArray(r.data) ? r.data : r.data?.events ?? []),
    ]).then(([a, b]) => setEvents([...a, ...b])).catch(() => setEvents([])).finally(() => setLoading(false));
  }, []);

  const filtered = events.filter(e =>
    !search || e.event_type?.toLowerCase().includes(search.toLowerCase()) || e.event_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-white">Webhook Event Center</h1>
        <div className="flex items-center gap-2 bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..."
            className="bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none w-40" />
        </div>
      </div>
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">{[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Webhook className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">{events.length === 0 ? 'No webhook events yet' : 'No matching events'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-500 uppercase tracking-wider">
                  {['Event ID', 'Type', 'Status', 'Timestamp'].map(h => <th key={h} className="px-5 py-3 font-bold">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B] font-mono">
                {filtered.map((evt, i) => (
                  <motion.tr key={evt.event_id + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-300">{evt.event_id}</td>
                    <td className="px-5 py-3 text-indigo-400 font-semibold">{evt.event_type}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-sans font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> Processed
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 font-sans">{new Date(evt.created_at).toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
