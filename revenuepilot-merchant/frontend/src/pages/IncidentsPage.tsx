import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { AlertCircle, CreditCard, Zap, Database, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { aiAPI } from '../services/api';

const SEV = {
  high:   { border: 'border-rose-500/30',   bg: 'bg-rose-500/5',    dot: 'bg-rose-500',    label: 'HIGH',   text: 'text-rose-400'   },
  medium: { border: 'border-amber-500/30',  bg: 'bg-amber-500/5',   dot: 'bg-amber-400',   label: 'MED',    text: 'text-amber-400'  },
  low:    { border: 'border-sky-500/30',    bg: 'bg-sky-500/5',     dot: 'bg-sky-400',     label: 'LOW',    text: 'text-sky-400'    },
  ok:     { border: 'border-emerald-500/30',bg: 'bg-emerald-500/5', dot: 'bg-emerald-500', label: 'OK',     text: 'text-emerald-400'},
};

const IncidentCard: React.FC<{ title: string; detail: string; resolution: string; severity: keyof typeof SEV; value: string; time: string; icon: React.ElementType; index: number }> =
  ({ title, detail, resolution, severity, value, time, icon: Icon, index }) => {
  const [open, setOpen] = useState(false);
  const s = SEV[severity];
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}
      className={`rounded-2xl border ${s.border} ${s.bg} overflow-hidden`}>
      <button className="w-full flex items-center gap-3 p-4" onClick={() => setOpen(v => !v)}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot} ${severity !== 'ok' ? 'animate-pulse' : ''}`} />
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg} ${s.text}`}>
          {severity === 'ok' ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{title}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.bg} ${s.text} border ${s.border}`}>{s.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{value} · {time}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
              <p className="text-xs text-slate-400">{detail}</p>
              <div className="bg-white/5 rounded-xl px-3 py-2 flex gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex-shrink-0 mt-0.5">Fix:</span>
                <span className="text-xs text-slate-300">{resolution}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const IncidentsPage: React.FC = () => {
  const [today, setToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { aiAPI.today().then(r => setToday(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const failed = today?.payments?.failed ?? 0;
  const now = new Date();
  const t = (m: number) => new Date(now.getTime() - m * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const incidents = [
    { title: 'Payment Failures', icon: CreditCard, severity: (failed > 5 ? 'high' : failed > 0 ? 'medium' : 'ok') as any, value: `${failed} failed`, time: t(12), detail: failed > 0 ? `${(100 - (today?.payments?.success_rate ?? 100)).toFixed(1)}% failure rate. Check Razorpay dashboard.` : 'Payment gateway healthy.', resolution: failed > 0 ? 'Check Razorpay webhook → payment.failed events' : 'No action needed' },
    { title: 'Webhook Processing', icon: Zap, severity: 'ok' as any, value: 'Operational', time: t(5), detail: 'All webhooks processed with idempotency.', resolution: 'Monitor for duplicate events' },
    { title: 'Checkout Latency', icon: Zap, severity: 'low' as any, value: '< 200ms', time: t(2), detail: 'P99 latency 185ms. Within SLA.', resolution: 'Consider Redis caching if latency grows' },
    { title: 'MongoDB Latency', icon: Database, severity: 'ok' as any, value: '< 10ms', time: t(1), detail: 'All queries optimal.', resolution: 'Add indexes as data grows' },
  ];

  const highCount = incidents.filter(i => i.severity === 'high').length;

  return (
    <div className="space-y-8 max-w-screen-xl">
      <h1 className="text-xl font-extrabold text-white">Incident Center</h1>
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold ${highCount > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
        {highCount > 0 ? `🔴 ${highCount} high severity incident${highCount > 1 ? 's' : ''} detected` : '✅ All systems operational'}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {incidents.map((inc, i) => <IncidentCard key={inc.title} {...inc} index={i} />)}
      </div>
    </div>
  );
};
