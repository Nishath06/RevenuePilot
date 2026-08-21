/**
 * RecoveryTable — Failed payment + abandoned cart recovery table
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, MessageCircle, Mail, ShoppingCart, AlertCircle } from 'lucide-react';
import { CartSnapshot, RecoveryData } from '../../services/merchantAI.service';

interface Props {
  recovery: RecoveryData | null;
  loading?: boolean;
}

export const RecoveryTable: React.FC<Props> = ({ recovery, loading }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  const carts = recovery?.abandoned_carts ?? [];
  const whatsapp = recovery?.whatsapp_messages ?? [];
  const emails = recovery?.email_messages ?? [];

  if (carts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <ShoppingCart className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="font-bold text-slate-700">No Abandoned Carts</p>
        <p className="text-sm text-slate-400">All customers completed their purchases. Excellent retention! 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-bold text-rose-700">
            ₹{(recovery?.total_recoverable_amount ?? 0).toLocaleString('en-IN')} recoverable
          </span>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <ShoppingCart className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-amber-700">{carts.length} abandoned cart{carts.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3 font-bold">#</th>
              <th className="px-4 py-3 font-bold">User</th>
              <th className="px-4 py-3 font-bold">Cart Value</th>
              <th className="px-4 py-3 font-bold">Items</th>
              <th className="px-4 py-3 font-bold">WhatsApp</th>
              <th className="px-4 py-3 font-bold">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <AnimatePresence>
              {carts.map((cart: CartSnapshot, i: number) => {
                const waMsgId = `wa-${i}`;
                const emailMsgId = `email-${i}`;
                const waMsg = whatsapp[i] ?? '';
                const emailMsg = emails[i] ?? '';

                return (
                  <motion.tr
                    key={cart.user_id + i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-slate-700 max-w-[120px] truncate" title={cart.user_id}>
                      {cart.user_id.slice(-8)}…
                    </td>
                    <td className="px-4 py-3 font-extrabold text-rose-600">
                      ₹{cart.subtotal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{cart.items_count} item{cart.items_count !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3">
                      {waMsg ? (
                        <button
                          onClick={() => copy(waMsg, waMsgId)}
                          className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors rounded-lg px-2.5 py-1.5 font-semibold"
                          title={waMsg}
                        >
                          {copied === waMsgId ? <Check className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                          {copied === waMsgId ? 'Copied!' : 'Copy'}
                        </button>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {emailMsg ? (
                        <button
                          onClick={() => copy(emailMsg, emailMsgId)}
                          className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors rounded-lg px-2.5 py-1.5 font-semibold"
                          title={emailMsg}
                        >
                          {copied === emailMsgId ? <Check className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                          {copied === emailMsgId ? 'Copied!' : 'Copy'}
                        </button>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
};
