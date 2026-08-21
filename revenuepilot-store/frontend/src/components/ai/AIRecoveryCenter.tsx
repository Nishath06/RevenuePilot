/**
 * AIRecoveryCenter — Full recovery center with abandoned cart cards,
 * recovery probability, suggested discount, and message copy buttons.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Copy, Check, MessageCircle, Mail, Tag, Percent, Send, AlertCircle } from 'lucide-react';
import { RecoveryData, CartSnapshot } from '../../services/merchantAI.service';

interface Props {
  recovery: RecoveryData | null;
  loading?: boolean;
}

// Mock fallback data
const MOCK_RECOVERY: RecoveryData = {
  failed_payments: [{ count: 3, note: 'UPI timeout' }],
  abandoned_carts: [
    { user_id: 'usr_a1b2c3d4', items_count: 3, subtotal: 8499, updated_at: new Date(Date.now() - 3600000).toISOString() },
    { user_id: 'usr_e5f6g7h8', items_count: 1, subtotal: 24999, updated_at: new Date(Date.now() - 7200000).toISOString() },
    { user_id: 'usr_i9j0k1l2', items_count: 2, subtotal: 4299, updated_at: new Date(Date.now() - 1800000).toISOString() },
  ],
  whatsapp_messages: [
    "Hey! 👋 You left ₹8,499 worth of items in your cart. Complete your order now and get FREE shipping! Link: revenuepilot.store/cart",
    "Hi there! Your MacBook Pro is waiting 🎧 Complete checkout for ₹24,999 and enjoy 30-day returns. Link: revenuepilot.store/cart",
    "Don't miss out! ₹4,299 in your cart. Order in the next 2 hours & save 10%! Link: revenuepilot.store/cart",
  ],
  email_messages: [
    "Subject: Your cart misses you! | You left 3 items worth ₹8,499. Come back and complete your purchase with free shipping.",
    "Subject: Your MacBook is reserved! | Complete your ₹24,999 order before it sells out. 30-day hassle-free returns.",
    "Subject: 10% off your pending cart | ₹4,299 in savings waiting for you. Use code COMEBACK10 at checkout.",
  ],
  priority_customers: [],
  total_recoverable_amount: 37797,
};

function recoveryProbability(subtotal: number, updatedAt?: string): number {
  let prob = 70;
  if (subtotal > 20000) prob -= 15;
  if (subtotal < 2000) prob += 10;
  if (updatedAt) {
    const hoursAgo = (Date.now() - new Date(updatedAt).getTime()) / 3600000;
    if (hoursAgo < 1) prob += 15;
    else if (hoursAgo > 24) prob -= 20;
  }
  return Math.min(95, Math.max(10, prob));
}

function suggestedDiscount(subtotal: number): number {
  if (subtotal > 15000) return 5;
  if (subtotal > 5000) return 10;
  return 15;
}

export const AIRecoveryCenter: React.FC<Props> = ({ recovery, loading }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const data = recovery ?? MOCK_RECOVERY;
  const isMock = !recovery;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const mockSend = (key: string) => {
    setSent(prev => new Set([...prev, key]));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
        {[1,2,3].map(i => <div key={i} className="h-72 bg-slate-100 rounded-2xl" />)}
      </div>
    );
  }

  if (data.abandoned_carts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <ShoppingCart className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="font-bold text-slate-700">No Abandoned Carts</p>
        <p className="text-sm text-slate-400">All customers completed their purchases — excellent retention! 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary banner */}
      {isMock && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Showing demo data — start the AI service to see live abandoned cart data
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-bold text-rose-700">₹{data.total_recoverable_amount.toLocaleString('en-IN')} total recoverable</span>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          <ShoppingCart className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-amber-700">{data.abandoned_carts.length} abandoned cart{data.abandoned_carts.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Cart cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence>
          {data.abandoned_carts.map((cart: CartSnapshot, i: number) => {
            const prob = recoveryProbability(cart.subtotal, cart.updated_at);
            const discount = suggestedDiscount(cart.subtotal);
            const waKey = `wa-${i}`;
            const emailKey = `email-${i}`;
            const sendKey = `send-${i}`;
            const waMsg = data.whatsapp_messages[i] ?? '';
            const emailMsg = data.email_messages[i] ?? '';
            const probColor = prob >= 70 ? 'emerald' : prob >= 45 ? 'amber' : 'rose';
            const hasSent = sent.has(sendKey);

            return (
              <motion.div
                key={cart.user_id + i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col"
              >
                {/* Recovery probability bar */}
                <div className={`h-1.5 ${probColor === 'emerald' ? 'bg-emerald-500' : probColor === 'amber' ? 'bg-amber-400' : 'bg-rose-500'}`}
                  style={{ width: `${prob}%`, transition: 'width 1s ease' }} />

                <div className="p-4 flex-1 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-mono text-slate-400">User {cart.user_id.slice(-6)}</p>
                      <p className="text-xl font-extrabold text-rose-600">₹{cart.subtotal.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-slate-500">{cart.items_count} item{cart.items_count !== 1 ? 's' : ''} in cart</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        probColor === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                        probColor === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                      }`}>{prob}% recovery</span>
                    </div>
                  </div>

                  {/* Recovery probability bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Recovery Probability</span><span>{prob}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${probColor === 'emerald' ? 'bg-emerald-500' : probColor === 'amber' ? 'bg-amber-400' : 'bg-rose-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${prob}%` }}
                        transition={{ duration: 1, delay: i * 0.1 + 0.3 }}
                      />
                    </div>
                  </div>

                  {/* Suggested discount */}
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                    <Percent className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-indigo-700">AI Suggests {discount}% discount</span>
                      <p className="text-[10px] text-indigo-500">Save ₹{Math.round(cart.subtotal * discount / 100).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-2">
                    {waMsg && (
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => copy(waMsg, waKey)}
                          className="flex-1 text-left text-[10px] text-slate-600 bg-green-50 border border-green-200 rounded-xl p-2.5 hover:bg-green-100 transition-colors line-clamp-2"
                          title={waMsg}
                        >
                          <span className="font-bold text-green-700 flex items-center gap-1 mb-1">
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </span>
                          {waMsg.slice(0, 80)}…
                        </button>
                        <button onClick={() => copy(waMsg, waKey)} className="p-2 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors flex-shrink-0">
                          {copied === waKey ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-green-600" />}
                        </button>
                      </div>
                    )}
                    {emailMsg && (
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => copy(emailMsg, emailKey)}
                          className="flex-1 text-left text-[10px] text-slate-600 bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 hover:bg-indigo-100 transition-colors line-clamp-2"
                          title={emailMsg}
                        >
                          <span className="font-bold text-indigo-700 flex items-center gap-1 mb-1">
                            <Mail className="w-3 h-3" /> Email
                          </span>
                          {emailMsg.slice(0, 80)}…
                        </button>
                        <button onClick={() => copy(emailMsg, emailKey)} className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors flex-shrink-0">
                          {copied === emailKey ? <Check className="w-3 h-3 text-indigo-600" /> : <Copy className="w-3 h-3 text-indigo-600" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Send button */}
                <div className="px-4 pb-4">
                  <motion.button
                    whileHover={{ scale: hasSent ? 1 : 1.02 }}
                    whileTap={{ scale: hasSent ? 1 : 0.98 }}
                    onClick={() => mockSend(sendKey)}
                    disabled={hasSent}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      hasSent
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:shadow-md'
                    }`}
                  >
                    {hasSent ? <><Check className="w-4 h-4" /> Sent!</> : <><Send className="w-4 h-4" /> Send Recovery Message</>}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
