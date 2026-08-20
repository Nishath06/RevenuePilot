import React, { useState, useEffect } from 'react';
import { ShoppingBag, DollarSign, CheckCircle, XCircle, Clock, Activity, Users, Database } from 'lucide-react';
import { merchantService } from '../services/merchant.service';
import { RevenueSummary, WebhookEvent } from '../types';

export const MerchantDashboard: React.FC = () => {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      merchantService.getRevenueSummary(),
      merchantService.getEvents()
    ])
      .then(([summaryData, eventsData]) => {
        setSummary(summaryData);
        setEvents(eventsData);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-200 mb-2">
            <Activity className="w-3.5 h-3.5" /> Read-Only APIs for RevenuePilot AI
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Merchant Dashboard</h1>
          <p className="text-sm text-slate-500">Live operational telemetry & revenue analytics.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
            <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{summary?.total_orders || 0}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600">₹{(summary?.total_revenue || 0).toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paid Orders</span>
            <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-teal-600">{summary?.paid_orders || 0}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Failed Payments</span>
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-600">{summary?.failed_payments || 0}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Orders</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-600">{summary?.pending_orders || 0}</p>
        </div>

      </div>

      {/* Webhook Event Logs */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Webhook Event Log (Razorpay Idempotency Audit)</h2>
          </div>
          <span className="text-xs font-mono text-slate-400">GET /merchant/events</span>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No webhook events recorded yet. Trigger Razorpay checkout to test webhooks.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Processed Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {events.map((evt) => (
                  <tr key={evt.event_id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">{evt.event_id}</td>
                    <td className="py-3 px-4 font-semibold text-indigo-600">{evt.event_type}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-sans font-bold rounded">
                        Processed
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{new Date(evt.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
