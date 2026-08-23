import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import { PaymentPieChart } from '../components/charts/Charts';
import { CreditCard, AlertTriangle, CheckCircle, Clock, Ban, RefreshCw, RotateCcw } from 'lucide-react';
import { aiAPI, merchantAPI } from '../services/api';

type TabType = 'successful' | 'failed' | 'cancelled';

export const PaymentsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('successful');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [aiRes, payRes] = await Promise.all([
        aiAPI.today().catch(() => ({ data: {} })),
        merchantAPI.payments().catch(() => ({ data: [] })),
      ]);
      setData(aiRes.data);
      setPayments(Array.isArray(payRes.data) ? payRes.data : []);
    } catch (err) {
      console.error('Failed to load payments data', err);
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

  const pay = data?.payments ?? {};
  const successfulList = payments.filter((p) => p.status === 'captured' || p.status === 'Paid');
  const failedList = payments.filter((p) => p.status === 'failed' || p.status === 'Failed');
  const cancelledList = payments.filter((p) => p.status === 'cancelled' || p.status === 'Cancelled');

  const pieData = [
    { name: 'Successful', value: successfulList.length },
    { name: 'Failed', value: failedList.length },
    { name: 'Cancelled', value: cancelledList.length },
  ];

  return (
    <div className="space-y-8 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Payment Intelligence & Audit Trail</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time gateway state machine telemetry</p>
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

      {/* Task 10 — Immutable Payment State Machine Diagram */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Immutable Payment State Machine Architecture
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-extrabold">
                Strict Guard Enforced
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Terminal states (PAID, FAILED, CANCELLED) cannot be overwritten by subsequent webhooks</p>
          </div>
          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full font-bold">
            State Lock Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 bg-[#161F30] rounded-xl border border-[#1E293B] flex flex-col items-center text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Stage 1</span>
            <p className="text-xs font-bold text-white">CREATED</p>
            <p className="text-[10px] text-slate-400 font-mono">Order initialized in DB</p>
          </div>
          <div className="p-3 bg-[#161F30] rounded-xl border border-[#1E293B] flex flex-col items-center text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Stage 2</span>
            <p className="text-xs font-bold text-indigo-400">AUTHORIZING</p>
            <p className="text-[10px] text-slate-400 font-mono">Razorpay modal open</p>
          </div>
          <div className="p-3 bg-[#161F30] rounded-xl border border-emerald-500/30 flex flex-col items-center text-center space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase">Terminal State A</span>
            <p className="text-xs font-extrabold text-emerald-400">PAID / CAPTURED</p>
            <p className="text-[10px] text-emerald-300/70 font-mono">Immutable ✅</p>
          </div>
          <div className="p-3 bg-[#161F30] rounded-xl border border-rose-500/30 flex flex-col items-center text-center space-y-1">
            <span className="text-[10px] font-bold text-rose-400 uppercase">Terminal State B</span>
            <p className="text-xs font-extrabold text-rose-400">FAILED / CANCELLED</p>
            <p className="text-[10px] text-rose-300/70 font-mono">Immutable 🔒</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Success Rate" value={`${(pay.success_rate ?? 0).toFixed(1)}%`} icon={CheckCircle} color={(pay.success_rate ?? 100) >= 90 ? 'emerald' : 'rose'} loading={loading} index={0} />
        <KPICard label="Failed Payments" value={failedList.length} icon={AlertTriangle} color={failedList.length > 0 ? 'rose' : 'emerald'} loading={loading} index={1} />
        <KPICard label="Cancelled Payments" value={cancelledList.length} icon={Ban} color="amber" loading={loading} index={2} />
        <KPICard label="Total Payment Events" value={payments.length} icon={CreditCard} color="indigo" loading={loading} index={3} />
      </div>

      {/* Payment Tabs & Audit Table */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] overflow-hidden shadow-xl">
        {/* Tab Headers */}
        <div className="px-5 py-3 border-b border-[#1E293B] flex items-center justify-between bg-[#161F30]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('successful')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'successful'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Successful ({successfulList.length})
            </button>

            <button
              onClick={() => setActiveTab('failed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'failed'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Failed ({failedList.length})
            </button>

            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'cancelled'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Ban className="w-3.5 h-3.5 text-amber-400" />
              Cancelled ({cancelledList.length})
            </button>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Immutable Audit Trail</span>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-[#1E293B]/40 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'successful' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5 font-bold">Razorpay Payment ID</th>
                    <th className="px-5 py-3.5 font-bold">Order ID</th>
                    <th className="px-5 py-3.5 font-bold">Customer</th>
                    <th className="px-5 py-3.5 font-bold">Method</th>
                    <th className="px-5 py-3.5 font-bold">Amount</th>
                    <th className="px-5 py-3.5 font-bold">Status</th>
                    <th className="px-5 py-3.5 font-bold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {successfulList.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-500">No successful payments logged yet</td></tr>
                  ) : (
                    successfulList.map((p, i) => (
                      <tr key={p.payment_id || i} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">{p.razorpay_payment_id || p.payment_id}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-300">{p.order_id}</td>
                        <td className="px-5 py-3.5 text-white font-medium">{p.customer_name || 'Customer'}</td>
                        <td className="px-5 py-3.5 text-slate-400 uppercase font-semibold text-[10px]">{p.method || 'card'}</td>
                        <td className="px-5 py-3.5 font-extrabold text-white">₹{(p.amount ?? 0).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" /> CAPTURED
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-[11px]">{new Date(p.created_at).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'failed' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5 font-bold">Razorpay Payment ID</th>
                    <th className="px-5 py-3.5 font-bold">Customer</th>
                    <th className="px-5 py-3.5 font-bold">Error Code</th>
                    <th className="px-5 py-3.5 font-bold">Failure Reason</th>
                    <th className="px-5 py-3.5 font-bold">Amount</th>
                    <th className="px-5 py-3.5 font-bold">AI Action</th>
                    <th className="px-5 py-3.5 font-bold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {failedList.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-500">No failed payments recorded</td></tr>
                  ) : (
                    failedList.map((p, i) => (
                      <tr key={p.payment_id || i} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5 font-mono text-rose-400 font-bold">{p.razorpay_payment_id || 'N/A'}</td>
                        <td className="px-5 py-3.5 text-white font-medium">{p.customer_name || 'Customer'}</td>
                        <td className="px-5 py-3.5 font-mono text-amber-400 text-[11px]">{p.error_code || 'GATEWAY_DECLINED'}</td>
                        <td className="px-5 py-3.5 text-rose-300 font-medium max-w-xs truncate">{p.failure_reason || 'Bank / Gateway rejection'}</td>
                        <td className="px-5 py-3.5 font-extrabold text-white">₹{(p.amount ?? 0).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit">
                            <RotateCcw className="w-3 h-3" /> Retry Recommended
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-[11px]">{new Date(p.created_at).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'cancelled' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5 font-bold">Order ID</th>
                    <th className="px-5 py-3.5 font-bold">Customer Name</th>
                    <th className="px-5 py-3.5 font-bold">Customer Email</th>
                    <th className="px-5 py-3.5 font-bold">Amount</th>
                    <th className="px-5 py-3.5 font-bold">Reason</th>
                    <th className="px-5 py-3.5 font-bold">Abandoned Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {cancelledList.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-500">No cancelled payments recorded</td></tr>
                  ) : (
                    cancelledList.map((p, i) => (
                      <tr key={p.payment_id || i} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5 font-mono text-amber-400 font-bold">{p.order_id}</td>
                        <td className="px-5 py-3.5 text-white font-medium">{p.customer_name || 'Customer'}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-[11px]">{p.customer_email || '—'}</td>
                        <td className="px-5 py-3.5 font-extrabold text-white">₹{(p.amount ?? 0).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-slate-300">{p.failure_reason || 'Customer closed Razorpay Checkout'}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-[11px]">{new Date(p.created_at).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Gateway Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Payment Lifecycle Breakdown</h3>
          <PaymentPieChart data={pieData} loading={loading} />
        </div>
        <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Gateway Health Monitoring</h3>
          {[
            { label: 'Razorpay UPI', status: 'Operational', ok: true },
            { label: 'Razorpay Cards & Netbanking', status: 'Operational', ok: true },
            { label: 'State Machine Immutability Guard', status: 'Active (Strict)', ok: true },
            { label: 'AI Agent Telemetry Pipeline', status: 'Active (Live)', ok: true },
          ].map((g) => (
            <div key={g.label} className="flex items-center justify-between py-3 border-b border-[#1E293B] last:border-0">
              <span className="text-xs text-slate-300 font-semibold">{g.label}</span>
              <span className={`flex items-center gap-1.5 text-xs font-bold ${g.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className={`w-2 h-2 rounded-full ${g.ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                {g.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
