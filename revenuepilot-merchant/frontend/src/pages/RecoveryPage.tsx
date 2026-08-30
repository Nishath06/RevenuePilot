import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { ShoppingBag, Zap, Copy, Check, Send, AlertTriangle, XCircle, RotateCcw, MessageSquare, Mail } from 'lucide-react';
import { aiAPI } from '../services/api';
import { merchantIntelAPI } from '../services/api';
import toast from 'react-hot-toast';

export const RecoveryPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'failed' | 'cancelled' | 'abandoned'>('all');

  useEffect(() => {
    aiAPI.recovery()
      .then(r => setData(r.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const failedItems = data?.failed_payments?.filter((item: any) => item.type === 'failed') ?? [];
  const cancelledItems = data?.failed_payments?.filter((item: any) => item.type === 'cancelled') ?? [];
  const abandonedCarts = data?.abandoned_carts ?? [];
  const total = data?.total_recoverable_amount ?? 0;

  const allRecoveryCards = [
    ...failedItems.map((item: any) => ({ ...item, category: 'failed' })),
    ...cancelledItems.map((item: any) => ({ ...item, category: 'cancelled' })),
    ...abandonedCarts.map((item: any) => ({ ...item, category: 'abandoned', amount: item.subtotal })),
  ];

  const filteredCards = allRecoveryCards.filter((card) => {
    if (activeTab === 'all') return true;
    return card.category === activeTab;
  });

  return (
    <div className="space-y-8 max-w-screen-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">AI Recovery Center</h1>
          <p className="text-sm text-slate-400 mt-1">Convert lost revenue from failed payments, cancelled checkouts, and abandoned carts</p>
        </div>
        {total > 0 && (
          <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-sm font-bold text-rose-400 flex items-center gap-2 self-start sm:self-auto">
            <Zap className="w-4 h-4 text-rose-400" />
            ₹{total.toLocaleString('en-IN')} Recoverable Opportunity
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Failed Payments" value={failedItems.length} icon={XCircle} color="rose" loading={loading} index={0} />
        <KPICard label="Cancelled Payments" value={cancelledItems.length} icon={AlertTriangle} color="amber" loading={loading} index={1} />
        <KPICard label="Abandoned Carts" value={abandonedCarts.length} icon={ShoppingBag} color="indigo" loading={loading} index={2} />
        <KPICard label="Total Recoverable" value={`₹${total.toLocaleString('en-IN')}`} icon={Zap} color="emerald" loading={loading} index={3} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-3">
        {[
          { key: 'all', label: `All Items (${allRecoveryCards.length})` },
          { key: 'failed', label: `Failed Payments (${failedItems.length})` },
          { key: 'cancelled', label: `Cancelled Payments (${cancelledItems.length})` },
          { key: 'abandoned', label: `Abandoned Carts (${abandonedCarts.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recovery Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 bg-[#111827] rounded-2xl border border-[#1E293B]" />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-[#111827] rounded-2xl border border-[#1E293B]">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-400" />
          <p className="font-semibold text-slate-300">No recovery items in this category.</p>
          <p className="text-xs text-slate-500 mt-1">Checkouts are processing cleanly!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCards.map((card: any, i: number) => {
            const cardId = card.order_id || card.user_id || `item-${i}`;
            const hasSent = sent.has(cardId);
            const isFailed = card.category === 'failed';
            const isCancelled = card.category === 'cancelled';

            const badgeColor = isFailed
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : isCancelled
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';

            return (
              <motion.div
                key={cardId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden flex flex-col justify-between"
              >
                {/* Header Strip */}
                <div
                  className={`h-1.5 ${
                    isFailed ? 'bg-rose-500' : isCancelled ? 'bg-amber-400' : 'bg-indigo-500'
                  }`}
                />

                <div className="p-5 space-y-4 flex-1">
                  {/* Title & Badge */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Customer</p>
                      <h3 className="text-base font-extrabold text-white">{card.customer_name}</h3>
                      {card.customer_email && (
                        <p className="text-xs text-slate-400 truncate max-w-[200px]">{card.customer_email}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${badgeColor} uppercase tracking-wider`}>
                      {card.category}
                    </span>
                  </div>

                  {/* Amount & Failure Reason */}
                  <div className="bg-[#1E293B]/60 p-3 rounded-xl border border-[#1E293B] space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-400">Target Amount</span>
                      <span className="text-lg font-extrabold text-white">
                        ₹{(card.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {card.failure_reason && (
                      <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5 pt-1 border-t border-[#1E293B]">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{card.failure_reason}</span>
                      </p>
                    )}
                  </div>

                  {/* AI Generated WhatsApp & Email Messages */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      AI Generated Recovery Campaign
                    </span>

                    {/* WhatsApp */}
                    {card.whatsapp_message && (
                      <div className="bg-[#1E293B]/40 p-2.5 rounded-xl border border-[#1E293B] flex items-start gap-2 text-xs">
                        <MessageSquare className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-[11px] text-slate-300 line-clamp-2">
                          {card.whatsapp_message}
                        </div>
                        <button
                          onClick={() => copy(card.whatsapp_message, `wa-${cardId}`)}
                          className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors flex-shrink-0"
                          title="Copy WhatsApp message"
                        >
                          {copied === `wa-${cardId}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    {/* Email */}
                    {card.email_message && (
                      <div className="bg-[#1E293B]/40 p-2.5 rounded-xl border border-[#1E293B] flex items-start gap-2 text-xs">
                        <Mail className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-[11px] text-slate-300 line-clamp-2">
                          {card.email_message}
                        </div>
                        <button
                          onClick={() => copy(card.email_message, `email-${cardId}`)}
                          className="p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors flex-shrink-0"
                          title="Copy Email message"
                        >
                          {copied === `email-${cardId}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-[#161F30] border-t border-[#1E293B] flex gap-2">
                  <button
                    onClick={async () => {
                      if (hasSent || sending.has(cardId)) return;
                      setSending((s) => new Set([...s, cardId]));
                      try {
                        await merchantIntelAPI.markRecoverySent(cardId);
                        setSent((s) => new Set([...s, cardId]));
                        toast.success('Recovery campaign sent & logged!');
                      } catch {
                        toast.error('Failed to send recovery campaign');
                      } finally {
                        setSending((s) => { const n = new Set(s); n.delete(cardId); return n; });
                      }
                    }}
                    disabled={hasSent || sending.has(cardId)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      hasSent
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : sending.has(cardId)
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                    }`}
                  >
                    {hasSent ? (
                      <>
                        <Check className="w-4 h-4" /> Recovery Link Sent!
                      </>
                    ) : sending.has(cardId) ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" /> Retry Payment Campaign
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
