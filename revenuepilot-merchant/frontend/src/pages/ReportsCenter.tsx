import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Download, UploadCloud, CheckCircle, Clock, RefreshCw,
  Search, Filter, Database, Calendar, ShieldCheck, DollarSign, CreditCard, Package, Users, Zap
} from 'lucide-react';
import { automationAPI } from '../services/api';
import { KPICard } from '../components/cards/KPICard';

export const ReportsCenter: React.FC = () => {
  const [dateRange, setDateRange] = useState('7d');
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<any>(null);
  const [awsStatus, setAwsStatus] = useState<any>(null);

  const reportCards = [
    { type: 'revenue', title: 'Revenue Operations Report', icon: DollarSign, color: 'emerald', desc: 'Gross sales, net revenue, refund rates, and daily expansion trends.' },
    { type: 'payment', title: 'Payment Audit Report', icon: CreditCard, color: 'indigo', desc: 'Razorpay failure breakdowns, gateway latencies, and decline reasons.' },
    { type: 'inventory', title: 'Inventory Stock Report', icon: Package, color: 'amber', desc: 'Low stock SKUs, stockout velocity, unsold items, and reorder projections.' },
    { type: 'customer', title: 'Customer Intelligence Report', icon: Users, color: 'sky', desc: 'LTV distribution, VIP buyers, churn risk, and retention benchmarks.' },
    { type: 'recovery', title: 'Recovery Campaign Report', icon: Zap, color: 'rose', desc: 'Recovered checkout revenue, coupon conversion rates, and SMS/WhatsApp ROI.' },
    { type: 'security', title: 'Security & Audit Report', icon: ShieldCheck, color: 'violet', desc: 'DevOps audit trails, HMAC signature checks, and JWT auth logs.' },
  ];

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatingType, setGeneratingType] = useState<string | null>(null);

  const triggerBrowserDownload = (content: string, filename: string, format: string) => {
    const fmt = format.toLowerCase();
    const mimeType = fmt === 'json' ? 'application/json' : (fmt === 'csv' ? 'text/csv' : (fmt === 'pdf' ? 'application/pdf' : 'text/plain'));
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const loadData = useCallback(async () => {
    try {
      const awsRes = await automationAPI.awsHealth().catch(() => ({ data: {} }));
      setAwsStatus(awsRes.data);
      const histRes = await automationAPI.reportsHistory().catch(() => ({ data: { reports: [] } }));
      if (histRes.data?.reports) {
        setReportHistory(histRes.data.reports);
      }
    } catch (err) {
      console.error('Failed to load reports metadata', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async (reportType: string, format: string) => {
    setLoading(true);
    setGeneratingType(`${reportType}-${format}`);
    setErrorMsg(null);
    try {
      const res = await automationAPI.generateReport({
        report_type: reportType,
        format,
        date_range: dateRange,
      });
      const rep = res.data;
      setActiveReport(rep);
      setReportHistory((prev) => [rep, ...prev.filter((r) => r.report_id !== rep.report_id)]);

      if (rep.content && rep.filename) {
        triggerBrowserDownload(rep.content, rep.filename, format);
      }
    } catch (err: any) {
      console.error('Failed to generate report', err);
      setErrorMsg(err?.response?.data?.detail || err.message || 'Failed to connect to RevenuePilot AI Engine. Please make sure local services are running.');
    } finally {
      setLoading(false);
      setGeneratingType(null);
    }
  };

  const handleDirectDownload = (rep: any) => {
    if (rep.content && rep.filename) {
      triggerBrowserDownload(rep.content, rep.filename, rep.format || 'csv');
    } else if (rep.download_url && rep.download_url.startsWith('http')) {
      window.open(rep.download_url, '_blank');
    } else if (rep.filename) {
      const baseUrl = import.meta.env.VITE_AI_API_URL || 'http://localhost:8001';
      window.open(`${baseUrl}/automation/reports/download/${rep.filename}`, '_blank');
    }
  };

  return (
    <div className="space-y-8 max-w-screen-xl bg-[#050816] text-slate-100 p-6 rounded-3xl min-h-screen border border-[#00F5A0]/10 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F5A0] animate-pulse" />
            <span className="text-[11px] font-extrabold tracking-widest text-[#00F5A0] uppercase">Automated Cloud Reporting</span>
          </div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            Reports &amp; Intelligence Center
            <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
              awsStatus?.has_credentials
                ? 'bg-[#FF9900]/10 border-[#FF9900]/40 text-[#FF9900]'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              {awsStatus?.has_credentials ? 'S3 STORED (ap-south-1)' : 'LOCAL STORAGE MODE'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Export financial, inventory, payment, and security audit reports in CSV, JSON, or PDF formats</p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex items-center gap-2 bg-[#0B1120] border border-[#1E293B] p-1.5 rounded-2xl text-xs">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setDateRange(item.id)}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition-all ${
                dateRange === item.id ? 'bg-[#00F5A0] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 font-medium flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 font-bold hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {reportCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.type}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-5 bg-[#0B1120] border border-[#1E293B] hover:border-[#00F5A0]/30 rounded-2xl space-y-4 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="p-2.5 rounded-xl bg-[#00F5A0]/10 text-[#00F5A0] border border-[#00F5A0]/20">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">PDF · CSV · JSON</span>
                </div>
                <h3 className="text-sm font-extrabold text-white">{card.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
              </div>

              <div className="pt-3 border-t border-[#1E293B] space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={loading}
                    onClick={() => handleGenerate(card.type, 'csv')}
                    className="py-1.5 bg-[#050816] hover:bg-[#00F5A0]/20 border border-[#1E293B] hover:border-[#00F5A0]/40 text-[#00F5A0] font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {generatingType === `${card.type}-csv` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} CSV
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleGenerate(card.type, 'json')}
                    className="py-1.5 bg-[#050816] hover:bg-amber-500/20 border border-[#1E293B] hover:border-amber-500/40 text-amber-400 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {generatingType === `${card.type}-json` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} JSON
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleGenerate(card.type, 'pdf')}
                    className="py-1.5 bg-[#050816] hover:bg-indigo-500/20 border border-[#1E293B] hover:border-indigo-500/40 text-indigo-400 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {generatingType === `${card.type}-pdf` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Generated Report Output Inspector */}
      {activeReport && (
        <div className="p-5 bg-[#0B1120] border border-[#00F5A0]/30 rounded-2xl space-y-3 text-xs shadow-2xl">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#00F5A0]" />
              <span className="font-extrabold text-white text-sm">Generated: {activeReport.filename}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[#00F5A0] bg-[#00F5A0]/10 px-3 py-1 rounded-full font-bold">
                {activeReport.record_count} Records Processed ({activeReport.date_range?.toUpperCase() || '7D'})
              </span>
              <button
                onClick={() => handleDirectDownload(activeReport)}
                className="px-3.5 py-1.5 bg-[#00F5A0] hover:bg-[#00F5A0]/80 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download File
              </button>
            </div>
          </div>

          <pre className="p-4 bg-[#050816] rounded-xl border border-[#1E293B] font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
            {activeReport.content}
          </pre>
        </div>
      )}

      {/* Report History Table */}
      <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-[#1E293B] flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white">Generated Reports Audit Log</h3>
          <span className="text-xs font-mono text-[#00F5A0]">MongoDB Collection: reports</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="px-5 py-3 font-bold">Report ID</th>
                <th className="px-5 py-3 font-bold">Report Type</th>
                <th className="px-5 py-3 font-bold">Format</th>
                <th className="px-5 py-3 font-bold">Filter</th>
                <th className="px-5 py-3 font-bold">Storage Target</th>
                <th className="px-5 py-3 font-bold">Created At</th>
                <th className="px-5 py-3 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {reportHistory.length > 0 ? (
                reportHistory.map((rep, idx) => (
                  <tr key={rep.report_id || idx} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-mono text-[#00F5A0] font-bold">{rep.report_id}</td>
                    <td className="px-5 py-3.5 text-white font-extrabold capitalize">{rep.report_type} Report</td>
                    <td className="px-5 py-3.5 font-mono text-amber-400 uppercase">{rep.format}</td>
                    <td className="px-5 py-3.5 font-mono text-sky-400 uppercase">{rep.date_range || '7d'}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono text-[10px]">{rep.s3_url}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(rep.created_at).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDirectDownload(rep)}
                        className="px-2.5 py-1 bg-[#050816] hover:bg-[#00F5A0]/20 border border-[#1E293B] hover:border-[#00F5A0]/40 text-[#00F5A0] text-[10px] font-extrabold rounded-lg inline-flex items-center gap-1 transition-all"
                      >
                        <Download className="w-3 h-3" /> Save File
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500 italic">
                    No reports generated in this session. Click any card above to generate a report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
