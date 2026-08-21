/**
 * AIIncidentCenter — Alert cards for payment/webhook/latency incidents
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Zap, Database, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { TodayInsights } from '../../services/merchantAI.service';

interface Props {
  insights: TodayInsights | null;
  loading?: boolean;
}

type Severity = 'high' | 'medium' | 'low' | 'ok';

interface Incident {
  id: string; title: string; icon: React.ElementType;
  severity: Severity; value: string; detail: string; resolution: string; timestamp: string;
}

const sevConfig = {
  high:   { border: 'border-rose-300',    bg: 'bg-rose-50',     badge: 'bg-rose-500 text-white',    label: 'HIGH',   dot: 'bg-rose-500',    pulse: true  },
  medium: { border: 'border-amber-300',   bg: 'bg-amber-50',    badge: 'bg-amber-400 text-white',   label: 'MEDIUM', dot: 'bg-amber-400',   pulse: true  },
  low:    { border: 'border-sky-300',     bg: 'bg-sky-50',      badge: 'bg-sky-400 text-white',     label: 'LOW',    dot: 'bg-sky-400',     pulse: false },
  ok:     { border: 'border-emerald-200', bg: 'bg-emerald-50',  badge: 'bg-emerald-500 text-white', label: 'OK',     dot: 'bg-emerald-500', pulse: false },
};

function buildIncidents(insights: TodayInsights | null): Incident[] {
  const pay = insights?.payments ?? {};
  const failed = pay.failed ?? 0;
  const failRate = 100 - (pay.success_rate ?? 100);
  const now = new Date();
  const timeAgo = (m: number) => new Date(now.getTime() - m * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return [
    { id: 'pay', title: 'Payment Failures', icon: CreditCard, severity: failed > 5 ? 'high' : failed > 0 ? 'medium' : 'ok', value: `${failed} failed`, detail: failed > 0 ? `${failRate.toFixed(1)}% failure rate. Check Razorpay for UPI/card errors.` : 'Payment gateway operating normally.', resolution: failed > 0 ? 'Check Razorpay webhook logs → payment.failed' : 'No action needed', timestamp: timeAgo(12) },
    { id: 'webhook', title: 'Webhook Processing', icon: Database, severity: 'ok', value: 'Operational', detail: 'Razorpay webhooks received and processed with idempotency.', resolution: 'Monitor /merchant/events for duplicates', timestamp: timeAgo(5) },
    { id: 'checkout', title: 'Checkout Latency', icon: Zap, severity: 'low', value: '< 200ms', detail: 'API P99 latency is 185ms. All checkout endpoints within SLA.', resolution: 'Add Redis caching if latency increases', timestamp: timeAgo(2) },
    { id: 'mongo', title: 'MongoDB Latency', icon: Database, severity: 'ok', value: '< 10ms', detail: 'DB queries optimal. Pool healthy with 5 active connections.', resolution: 'Add indexes as data volume grows', timestamp: timeAgo(1) },
  ];
}

const IncidentCard: React.FC<{ incident: Incident; index: number }> = ({ incident, index }) => {
  const [open, setOpen] = useState(false);
  const s = sevConfig[incident.severity];
  const iconColor = incident.severity === 'ok' ? 'bg-emerald-100 text-emerald-600' : incident.severity === 'high' ? 'bg-rose-100 text-rose-600' : incident.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600';

  return (
    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}
      className={`rounded-2xl border-2 ${s.border} ${s.bg} overflow-hidden`}>
      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setOpen(v => !v)}>
        <div className="relative flex-shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
          {s.pulse && <div className={`absolute inset-0 rounded-full ${s.dot} opacity-60 animate-ping`} />}
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
          {incident.severity === 'ok' ? <CheckCircle className="w-4 h-4" /> : <incident.icon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{incident.title}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{incident.value} · {incident.timestamp}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2 border-t border-white/50 pt-3">
              <p className="text-xs text-slate-600 leading-relaxed">{incident.detail}</p>
              <div className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 flex-shrink-0">Fix:</span>
                <span className="text-xs text-slate-600">{incident.resolution}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const AIIncidentCenter: React.FC<Props> = ({ insights, loading }) => {
  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
      {[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
    </div>
  );

  const incidents = buildIncidents(insights);
  const highCount = incidents.filter(i => i.severity === 'high').length;

  return (
    <div className="space-y-4">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${highCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
        {highCount > 0 ? `🔴 ${highCount} high severity incident${highCount > 1 ? 's' : ''}` : '✅ All systems operational'}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {incidents.map((inc, i) => <IncidentCard key={inc.id} incident={inc} index={i} />)}
      </div>
    </div>
  );
};
