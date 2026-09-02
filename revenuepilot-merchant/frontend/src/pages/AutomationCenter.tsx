import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Cpu, Activity, Play, Plus, CheckCircle, AlertTriangle, ShieldCheck,
  Clock, RefreshCw, Layers, Server, Radio, ArrowRight, ShieldAlert,
  Send, Trash2, Eye, Sliders, Check, Workflow, Sparkles, AlertCircle, Database,
  Download, FileText, Lock, GitBranch, Terminal, Shield, Gauge, Share2,
  ExternalLink, ChevronRight, MessageSquare, Mail, Bell, CheckCircle2, XCircle
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { automationAPI } from '../services/api';
import { KPICard } from '../components/cards/KPICard';

type TabType =
  | 'operations_console'
  | 'cloudwatch_metrics'
  | 'event_timeline'
  | 'watchdogs'
  | 'schedulers'
  | 'lambdas'
  | 'reports'
  | 'recovery_campaigns'
  | 'rules'
  | 'test_generator'
  | 'demo_generator'
  | 'recovery_ai';

const CLOUDWATCH_METRICS = [
  { key: 'OrdersProcessed', label: 'Orders Processed', unit: 'Count', color: '#10b981' },
  { key: 'RevenueGenerated', label: 'Revenue Generated (₹)', unit: 'INR', color: '#00F5A0' },
  { key: 'FailedPayments', label: 'Failed Payments', unit: 'Count', color: '#ef4444' },
  { key: 'RecoveredPayments', label: 'Recovered Payments', unit: 'Count', color: '#3b82f6' },
  { key: 'InventoryAlerts', label: 'Inventory Alerts', unit: 'Count', color: '#f59e0b' },
  { key: 'LambdaInvocations', label: 'Lambda Invocations', unit: 'Count', color: '#a855f7' },
  { key: 'WebhookLatency', label: 'Webhook Latency (ms)', unit: 'ms', color: '#06b6d4' },
  { key: 'DatabaseLatency', label: 'Database Latency (ms)', unit: 'ms', color: '#8b5cf6' },
  { key: 'PaymentSuccessRate', label: 'Payment Success Rate (%)', unit: '%', color: '#10b981' },
  { key: 'SchedulerExecutions', label: 'Scheduler Executions', unit: 'Count', color: '#f97316' },
  { key: 'SNSNotificationsSent', label: 'SNS Notifications Sent', unit: 'Count', color: '#ec4899' },
  { key: 'S3ReportsUploaded', label: 'S3 Reports Uploaded', unit: 'Count', color: '#14b8a6' },
];

export const AutomationCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('operations_console');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Feeds & Automation Data
  const [metrics, setMetrics] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [awsHealth, setAwsHealth] = useState<any>(null);
  const [healthScore, setHealthScore] = useState<any>(null);
  const [feeds, setFeeds] = useState<any>(null);
  const [demoSummary, setDemoSummary] = useState<any>(null);

  // Demo Generator & Testing State
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [actionOutput, setActionOutput] = useState<any>(null);
  const [selectedMetricKey, setSelectedMetricKey] = useState('OrdersProcessed');

  // Preview Drawer for Recovery Campaigns
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [previewTab, setPreviewTab] = useState<'whatsapp' | 'email' | 'push'>('whatsapp');

  // Recovery AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysisSuccess, setShowAnalysisSuccess] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);

  const handleAnalyzeCustomers = async () => {
    setIsAnalyzing(true);
    try {
      const res = await automationAPI.analyzeRecovery();
      setAnalysisResult(res.data);
      setShowAnalysisSuccess(true);
      // Refresh candidates list
      loadRecoveryCandidates();
      loadData(); // refresh dashboard metrics
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadRecoveryCandidates = async () => {
    try {
      const res = await automationAPI.getRecoveryCandidates();
      setCandidates(res.data.candidates || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'recovery_ai') {
      loadRecoveryCandidates();
    }
  }, [activeTab]);

  // Developer Test Event State
  const [testEventType, setTestEventType] = useState('PAYMENT_FAILED');
  const [testPayload, setTestPayload] = useState({
    customer_name: 'Priya Sharma',
    customer_email: 'priya.sharma@example.com',
    amount: 6499,
    failure_reason: 'BAD_GATEWAY_TIMEOUT',
    method: 'UPI',
  });
  const [testResult, setTestResult] = useState<any>(null);

  // AWS Diagnostics State
  const [testingService, setTestingService] = useState<string | null>(null);
  const [serviceTestResult, setServiceTestResult] = useState<any>(null);

  // Load all live feeds and backend stats
  const loadData = useCallback(async () => {
    try {
      const [mRes, rRes, eRes, hRes, aRes, hsRes, feedsRes, sumRes] = await Promise.all([
        automationAPI.metrics().catch(() => ({ data: {} })),
        automationAPI.rules().catch(() => ({ data: [] })),
        automationAPI.events().catch(() => ({ data: { events: [] } })),
        automationAPI.history().catch(() => ({ data: { history: [] } })),
        automationAPI.awsHealth().catch(() => ({ data: {} })),
        automationAPI.healthScore().catch(() => ({ data: null })),
        automationAPI.getDemoFeeds().catch(() => ({ data: null })),
        automationAPI.getDemoSummary().catch(() => ({ data: null })),
      ]);

      setMetrics(mRes.data);
      setRules(Array.isArray(rRes.data) ? rRes.data : []);
      setEvents(eRes.data?.events ?? []);
      setHistory(hRes.data?.history ?? []);
      setAwsHealth(aRes.data);
      setHealthScore(hsRes.data);
      setFeeds(feedsRes.data);
      setDemoSummary(sumRes.data?.summary);
    } catch (err) {
      console.error('Failed to load AutoOps automation data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000); // 8-second live stream polling
    return () => clearInterval(interval);
  }, [loadData]);

  // QA Quick Action Handlers
  const handleGenerate30DayData = async () => {
    setActionLoading('generate_data');
    setProgress(15);
    setActionOutput(null);
    try {
      const timer = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? 90 : prev + 25));
      }, 70);
      const res = await automationAPI.generateDemoData({
        days: 30,
        orders: 2500,
        customers: 650,
        products: 120,
      });
      clearInterval(timer);
      setProgress(100);
      setActionOutput({ type: 'generate', data: res.data });
      await loadData();
    } catch (err) {
      console.error('Demo data generation failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulateEvents = async () => {
    setActionLoading('events');
    setProgress(30);
    try {
      const res = await automationAPI.generateDemoEvents({ count: 10 });
      setProgress(100);
      setActionOutput({ type: 'events', data: res.data });
      await loadData();
    } catch (err) {
      console.error('Event simulation failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunWatchdogs = async () => {
    setActionLoading('watchdogs');
    setProgress(30);
    try {
      const res = await automationAPI.runDemoWatchdogs();
      setProgress(100);
      setActionOutput({ type: 'watchdogs', data: res.data });
      await loadData();
    } catch (err) {
      console.error('Watchdog execution failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunSchedulers = async () => {
    setActionLoading('schedulers');
    setProgress(30);
    try {
      const res = await automationAPI.runDemoSchedulers();
      setProgress(100);
      setActionOutput({ type: 'schedulers', data: res.data });
      await loadData();
    } catch (err) {
      console.error('Scheduler execution failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunLambdas = async () => {
    setActionLoading('lambdas');
    setProgress(30);
    try {
      const res = await automationAPI.runDemoLambdas();
      setProgress(100);
      setActionOutput({ type: 'lambdas', data: res.data });
      await loadData();
    } catch (err) {
      console.error('Lambda execution failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunReports = async () => {
    setActionLoading('reports');
    setProgress(30);
    try {
      const res = await automationAPI.runDemoReports();
      setProgress(100);
      setActionOutput({ type: 'reports', data: res.data });
      await loadData();
    } catch (err) {
      console.error('Reports generation failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetDemoData = async () => {
    setActionLoading('reset');
    setProgress(50);
    try {
      const res = await automationAPI.resetDemoStore();
      setProgress(100);
      setActionOutput({ type: 'reset', data: res.data });
      await loadData();
    } catch (err) {
      console.error('Demo reset failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmitTestEvent = async () => {
    try {
      const res = await automationAPI.testEvent({
        event_type: testEventType,
        payload: testPayload,
        severity: testEventType.includes('FAILED') || testEventType.includes('DROP') ? 'warning' : 'info',
      });
      setTestResult(res.data);
      loadData();
    } catch (err) {
      console.error('Failed to emit test event', err);
    }
  };

  const handleTestAwsService = async (service: string) => {
    setTestingService(service);
    try {
      const res = await automationAPI.testAwsService(service);
      setServiceTestResult(res.data);
      loadData();
    } catch (err) {
      console.error('AWS test failed', err);
    } finally {
      setTestingService(null);
    }
  };

  const selectedMetricConfig =
    CLOUDWATCH_METRICS.find((m) => m.key === selectedMetricKey) || CLOUDWATCH_METRICS[0];
  const chartData = feeds?.cloudwatch_feed || [];

  return (
    <div className="space-y-8 max-w-screen-2xl bg-[#050816] text-slate-100 p-6 rounded-3xl min-h-screen border border-[#00F5A0]/10 shadow-2xl">
      {/* ── TOP HEADER & AWS STATUS BAR ────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E293B] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F5A0] animate-pulse" />
            <span className="text-[11px] font-extrabold tracking-widest text-[#00F5A0] uppercase font-mono">
              Autonomous Cloud Merchant OS v2.7
            </span>
          </div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 flex-wrap">
            AutoOps Live Operations Console
            {awsHealth?.aws_mode === 'cloud' ? (
              <span className="text-xs px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                AWS Production Mode (ap-south-1)
              </span>
            ) : (
              <span className="text-xs px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                AWS Connected Mode
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Full 30-day merchant dataset generation, AWS Lambda invocations, EventBridge rules, 7-watchdog health board, and 12-metric CloudWatch moving graphs.
          </p>
        </div>

        {/* AWS Live Service Status Badges with Test Pings */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'eventbridge', name: 'EventBridge', icon: Zap, color: 'text-cyan-400', bg: 'border-cyan-500/30' },
            { id: 'lambda', name: 'Lambda (5)', icon: Cpu, color: 'text-purple-400', bg: 'border-purple-500/30' },
            { id: 'sns', name: 'SNS', icon: Radio, color: 'text-pink-400', bg: 'border-pink-500/30' },
            { id: 's3', name: 'S3 Reports', icon: Database, color: 'text-emerald-400', bg: 'border-emerald-500/30' },
            { id: 'cloudwatch', name: 'CloudWatch', icon: Activity, color: 'text-amber-400', bg: 'border-amber-500/30' },
          ].map((srv) => {
            const Icon = srv.icon;
            const isTesting = testingService === srv.id;
            return (
              <button
                key={srv.id}
                onClick={() => handleTestAwsService(srv.id)}
                disabled={isTesting}
                className={`bg-[#0B1120] hover:bg-slate-800 text-[11px] font-mono font-bold px-3 py-1.5 rounded-xl border ${srv.bg} flex items-center gap-1.5 transition-all shadow-sm`}
                title={`Click to run diagnostic ping on AWS ${srv.name}`}
              >
                <Icon className={`w-3.5 h-3.5 ${srv.color} ${isTesting ? 'animate-spin' : ''}`} />
                <span className="text-slate-200">{srv.name}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0]" />
              </button>
            );
          })}

          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="p-2.5 bg-[#111827] border border-[#1E293B] hover:bg-white/5 rounded-xl text-slate-300 transition-all ml-1"
            title="Refresh Live Operations Console"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#00F5A0]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI HIGHLIGHTS ROW ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <KPICard
          label="Demo Orders"
          value={demoSummary?.orders ?? (metrics?.orders_count || 2500)}
          icon={Zap}
          color="emerald"
          loading={loading}
          index={0}
        />
        <KPICard
          label="Lambda Runs"
          value={demoSummary?.lambda_executions ?? 95}
          icon={Cpu}
          color="purple"
          loading={loading}
          index={1}
        />
        <KPICard
          label="Health Score"
          value={`${healthScore?.score ?? 96}/100`}
          icon={Gauge}
          color="emerald"
          loading={loading}
          index={2}
        />
        <KPICard
          label="Recovery Campaigns"
          value={demoSummary?.recovery_campaigns ?? 100}
          icon={Activity}
          color="indigo"
          loading={loading}
          index={3}
        />
        <KPICard
          label="Generated Reports"
          value={demoSummary?.reports ?? 30}
          icon={FileText}
          color="cyan"
          loading={loading}
          index={4}
        />
        <KPICard
          label="Active Watchdogs"
          value="7 / 7 Online"
          icon={ShieldCheck}
          color="amber"
          loading={loading}
          index={5}
        />
      </div>

      {/* ── FEATURE 1 & 12: DEMO DATA GENERATOR CONTROL CARD ─────────────────── */}
      <div className="bg-[#0B1120] border border-[#00F5A0]/30 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#00F5A0]" />
              <span className="text-[11px] font-extrabold tracking-widest text-[#00F5A0] uppercase font-mono">
                Production Testing &amp; QA Engine
              </span>
            </div>
            <h2 className="text-xl font-black text-white">Merchant Demo Dataset &amp; AWS QA Action Panel</h2>
            <p className="text-xs text-slate-400 mt-1">
              Populate MongoDB with 2,500 realistic orders, 650 customers, 120 products, and trigger AWS EventBridge, Lambda, SNS, S3, and CloudWatch in end-to-end testing mode.
            </p>
          </div>

          {/* Quick Action Button Group */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerate30DayData}
              disabled={!!actionLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-[#00F5A0] to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-[#00F5A0]/20 hover:opacity-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === 'generate_data' ? 'animate-spin' : ''}`} />
              Generate 30-Day Demo Store
            </button>

            <button
              onClick={handleSimulateEvents}
              disabled={!!actionLoading}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-indigo-200" />
              Simulate 10 Events
            </button>

            <button
              onClick={handleRunWatchdogs}
              disabled={!!actionLoading}
              className="px-3.5 py-2.5 bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 text-amber-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              Run 7 Watchdogs
            </button>

            <button
              onClick={handleRunSchedulers}
              disabled={!!actionLoading}
              className="px-3.5 py-2.5 bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Clock className="w-4 h-4 text-purple-400" />
              Run Schedulers
            </button>

            <button
              onClick={handleRunLambdas}
              disabled={!!actionLoading}
              className="px-3.5 py-2.5 bg-cyan-600/20 border border-cyan-500/40 hover:bg-cyan-600/30 text-cyan-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Cpu className="w-4 h-4 text-cyan-400" />
              Run 5 Lambdas
            </button>

            <button
              onClick={handleRunReports}
              disabled={!!actionLoading}
              className="px-3.5 py-2.5 bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              Generate Reports
            </button>

            <button
              onClick={handleResetDemoData}
              disabled={!!actionLoading}
              className="px-3.5 py-2.5 bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-400 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              Reset DB
            </button>
          </div>
        </div>

        {/* Real-time Progress Indicator */}
        {actionLoading && (
          <div className="space-y-2 bg-[#050816] p-4 rounded-2xl border border-[#1E293B]">
            <div className="flex justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00F5A0]" />
                Executing Pipeline: <span className="text-[#00F5A0] uppercase font-mono">{actionLoading}</span>...
              </span>
              <span className="font-mono text-[#00F5A0]">{progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-[#00F5A0] to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Database Collections Live Counts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Orders', count: demoSummary?.orders ?? 2500, color: 'text-[#00F5A0]' },
            { label: 'Payments', count: demoSummary?.payments ?? 2500, color: 'text-emerald-400' },
            { label: 'Customers', count: demoSummary?.customers ?? 650, color: 'text-indigo-400' },
            { label: 'Products', count: demoSummary?.products ?? 120, color: 'text-cyan-400' },
            { label: 'Campaigns', count: demoSummary?.recovery_campaigns ?? 100, color: 'text-pink-400' },
            { label: 'Lambda Logs', count: demoSummary?.lambda_executions ?? 95, color: 'text-purple-400' },
            { label: 'S3 Reports', count: demoSummary?.reports ?? 30, color: 'text-amber-400' },
          ].map((item) => (
            <div key={item.label} className="bg-[#050816] p-3 rounded-2xl border border-[#1E293B]">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block font-bold truncate">
                {item.label}
              </span>
              <span className={`text-base font-black font-mono ${item.color}`}>
                {item.count.toLocaleString()} docs
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── NAVIGATION TABS ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-3 overflow-x-auto">
        {[
          { key: 'operations_console', label: 'Live Operations Console', icon: Server },
          { key: 'recovery_ai', label: 'Recovery AI', icon: Sparkles },
          { key: 'cloudwatch_metrics', label: 'CloudWatch 12 Metrics', icon: Activity },
          { key: 'watchdogs', label: 'Watchdog Health Board (7)', icon: ShieldCheck },
          { key: 'event_timeline', label: 'EventBridge Timeline', icon: Radio },
          { key: 'schedulers', label: 'Scheduler Feed (6)', icon: Clock },
          { key: 'lambdas', label: 'Lambda Invocations (5)', icon: Cpu },
          { key: 'reports', label: 'S3 Reports Center', icon: FileText },
          { key: 'recovery_campaigns', label: 'Recovery Campaigns (100)', icon: MessageSquare },
          { key: 'rules', label: `Automation Rules (${rules.length})`, icon: Zap },
          { key: 'test_generator', label: 'Developer Test Panel', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-[#00F5A0]/20 to-[#00F5A0]/5 text-[#00F5A0] border border-[#00F5A0]/40 shadow-lg shadow-[#00F5A0]/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00F5A0]' : 'text-slate-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>


      {/* ── TAB: RECOVERY AI (V4.1) ────────────────────────────────────────── */}
      {activeTab === 'recovery_ai' && (
        <div className="space-y-6">
          <div className="bg-[#0B1120] border border-[#00F5A0]/30 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#00F5A0]/10 rounded-full blur-3xl" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-4 relative z-10">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-[#00F5A0]" />
                  Recovery Intelligence Agent
                </h3>
                <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                  AI analyzes failed payments and predicts customers most likely to recover. It automatically generates optimized coupons and schedules personalized recovery campaigns for 18:00 IST.
                </p>
              </div>

              <button
                onClick={handleAnalyzeCustomers}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-[#00F5A0] text-slate-950 font-black text-sm rounded-xl shadow-[0_0_20px_rgba(0,245₹60,0.3)] hover:shadow-[0_0_30px_rgba(0,245₹60,0.5)] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing Customers...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Analyze Customers
                  </>
                )}
              </button>
            </div>

            {/* Analysis Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
              {[
                { label: 'Critical', val: analysisResult?.critical || '--', icon: AlertCircle, color: 'text-rose-400' },
                { label: 'High', val: analysisResult?.high || '--', icon: AlertTriangle, color: 'text-amber-400' },
                { label: 'Medium', val: analysisResult?.medium || '--', icon: Activity, color: 'text-emerald-400' },
                { label: 'Revenue Recoverable', val: analysisResult ? `₹${analysisResult.recoverable_revenue.toLocaleString()}` : '--', icon: Database, color: 'text-[#00F5A0]' },
                { label: 'Scheduled Campaign Time', val: analysisResult ? new Date(analysisResult.scheduled_send_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--', icon: Clock, color: 'text-purple-400' },
              ].map((m, i) => (
                <div key={i} className="bg-[#050816] p-4 rounded-2xl border border-[#1E293B] flex flex-col justify-between">
                  <span className={`text-[11px] text-slate-400 uppercase font-mono font-bold flex items-center gap-1.5`}>
                    <m.icon className={`w-3 h-3 ${m.color}`} /> {m.label}
                  </span>
                  <span className="text-xl font-black text-white mt-2">{m.val}</span>
                </div>
              ))}
            </div>

            {/* Candidate Table */}
            <div className="mt-8 relative z-10">
              <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" /> Scheduled Recovery Candidates
              </h4>
              <div className="overflow-x-auto rounded-xl border border-[#1E293B]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#111827] text-slate-400 border-b border-[#1E293B]">
                    <tr>
                      <th className="p-3 font-bold">Customer</th>
                      <th className="p-3 font-bold">Segment</th>
                      <th className="p-3 font-bold">Score</th>
                      <th className="p-3 font-bold">Coupon</th>
                      <th className="p-3 font-bold">Priority</th>
                      <th className="p-3 font-bold">Scheduled Time</th>
                      <th className="p-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#0B1120] divide-y divide-[#1E293B]">
                    {candidates.map((cand: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-white font-bold">{cand.customer_name}</td>
                        <td className="p-3">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{cand.segment}</span>
                        </td>
                        <td className="p-3 text-[#00F5A0] font-bold">{cand.recovery_score}%</td>
                        <td className="p-3">{cand.coupon_code}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded ${
                            cand.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                            cand.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {cand.priority}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {new Date(cand.scheduled_send_time).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">
                            {cand.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {candidates.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-sans italic">
                          No candidates scheduled. Click "Analyze Customers" to generate.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup Modal */}
      {showAnalysisSuccess && analysisResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B1120] border border-[#00F5A0]/40 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#00F5A0]" />
            <div className="mx-auto w-16 h-16 bg-[#00F5A0]/10 rounded-full flex items-center justify-center mb-2">
              <CheckCircle className="w-8 h-8 text-[#00F5A0]" />
            </div>
            <h3 className="text-2xl font-black text-white">Campaign Scheduled!</h3>
            <p className="text-sm text-slate-400">
              The Recovery AI has successfully analyzed all customers and scheduled a recovery campaign.
            </p>
            
            <div className="bg-[#050816] rounded-xl border border-[#1E293B] p-4 space-y-3 text-left">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Candidates Selected</span>
                <span className="font-mono text-white font-bold">{analysisResult.candidates_created}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Recoverable Revenue</span>
                <span className="font-mono text-[#00F5A0] font-bold">₹{analysisResult.recoverable_revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-[#1E293B] pt-3">
                <span className="text-slate-400 font-bold">Scheduled Time</span>
                <span className="font-mono text-white text-[11px]">
                  {new Date(analysisResult.scheduled_send_time).toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowAnalysisSuccess(false)}
              className="w-full py-3 bg-white text-slate-900 font-black rounded-xl hover:bg-slate-200 transition-all"
            >
              View Campaign Candidates
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: LIVE OPERATIONS CONSOLE (Unified Dashboard) ────────────────── */}
      {activeTab === 'operations_console' && (
        <div className="space-y-6">
          {/* Top Row: CloudWatch Quick Graph + 7 Watchdog Health Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CloudWatch Moving Graph Widget */}
            <div className="lg:col-span-7 bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#00F5A0]" />
                    CloudWatch Live Metrics Stream
                  </h3>
                  <p className="text-xs text-slate-400">Moving minute-by-minute metric stream from AWS namespace</p>
                </div>

                <select
                  value={selectedMetricKey}
                  onChange={(e) => setSelectedMetricKey(e.target.value)}
                  className="bg-[#050816] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-[#00F5A0] font-mono focus:outline-none focus:border-[#00F5A0]"
                >
                  {CLOUDWATCH_METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedMetricConfig.color} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={selectedMetricConfig.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="time_label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#111827',
                        border: '1px solid #1E293B',
                        borderRadius: 12,
                        fontSize: 12,
                        color: '#e2e8f0',
                      }}
                      formatter={(val: any) => [
                        `${Number(val).toLocaleString()} ${selectedMetricConfig.unit}`,
                        selectedMetricConfig.label,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey={selectedMetricKey}
                      stroke={selectedMetricConfig.color}
                      strokeWidth={2.5}
                      fill="url(#metricGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Watchdog Health Matrix */}
            <div className="lg:col-span-5 bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Watchdog Health Board
                </h3>
                <span className="text-[10px] font-mono text-[#00F5A0] bg-[#00F5A0]/10 px-2 py-0.5 rounded-full font-bold">
                  All 7 Active
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(feeds?.watchdogs_board || []).map((wd: any) => (
                  <div
                    key={wd.id}
                    className="p-2.5 bg-[#050816] rounded-xl border border-[#1E293B] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-200">{wd.name}</span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                            wd.status === 'Healthy'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {wd.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[240px]">{wd.description}</p>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <span className="text-slate-300 font-bold block">{wd.latency_ms}ms</span>
                      <span className="text-[9px] text-slate-500">{wd.items_scanned} scanned</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Row: Step Functions Event Timeline & Lambda Execution Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* EventBridge Step Functions Timeline */}
            <div className="lg:col-span-7 bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    AWS Step Functions Execution Timeline
                  </h3>
                  <p className="text-xs text-slate-400">Real-time traces with rule evaluations and Lambda dispatches</p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Total: {feeds?.timeline_feed?.length ?? 0} traces
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {(feeds?.timeline_feed || []).slice(0, 8).map((tl: any, i: number) => (
                  <div
                    key={tl.trace_id || i}
                    className="p-3.5 bg-[#050816] rounded-2xl border border-[#1E293B] hover:border-[#00F5A0]/30 transition-all space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="font-extrabold text-white font-mono">{tl.event_type}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          {tl.trace_id}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {tl.execution_result}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      <strong className="text-slate-400">Rule:</strong> {tl.rule_evaluated}
                    </div>

                    {/* Step Badges */}
                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono pt-1">
                      <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-purple-400" /> {tl.lambda_invoked}
                      </span>
                      {tl.sns_published && (
                        <span className="bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                          <Radio className="w-3 h-3 text-pink-400" /> SNS Sent
                        </span>
                      )}
                      {tl.cloudwatch_logged && (
                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                          <Activity className="w-3 h-3 text-amber-400" /> CloudWatch Logged
                        </span>
                      )}
                      <span className="ml-auto text-slate-500 text-[10px]">
                        {tl.duration_ms}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lambda Invocations Stream */}
            <div className="lg:col-span-5 bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    Lambda Invocation Feed
                  </h3>
                  <p className="text-xs text-slate-400">All 5 serverless handlers</p>
                </div>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full font-bold">
                  Boto3 / Cloud
                </span>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {(feeds?.lambda_feed || []).slice(0, 8).map((lam: any, i: number) => (
                  <div
                    key={lam.execution_id || i}
                    className="p-3 bg-[#050816] rounded-xl border border-[#1E293B] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-purple-300">{lam.function_name}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            lam.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {lam.status}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                        {lam.aws_request_id || lam.request_id || 'aws_req_local'}
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[#00F5A0] font-bold block">{lam.duration_ms} ms</span>
                      <span className="text-[9px] text-slate-500">
                        {lam.timestamp ? new Date(lam.timestamp).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CLOUDWATCH 12 METRICS FEED ─────────────────────────────────── */}
      {activeTab === 'cloudwatch_metrics' && (
        <div className="space-y-6">
          <div className="bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#00F5A0]" />
                  AWS CloudWatch 12-Metric Moving Graphs
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Live metrics populated per minute into namespace <strong className="text-white font-mono">RevenuePilot/AutoOps</strong>.
                </p>
              </div>

              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
                Frequency: 1 Min Intervals
              </span>
            </div>

            {/* Metric Switcher Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {CLOUDWATCH_METRICS.map((m) => {
                const isSelected = selectedMetricKey === m.key;
                const latestPoint = chartData[chartData.length - 1]?.[m.key] ?? 0;
                return (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMetricKey(m.key)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-800/80 border-[#00F5A0] shadow-lg shadow-[#00F5A0]/10'
                        : 'bg-[#050816] border-[#1E293B] hover:border-slate-700'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 font-bold block truncate">{m.label}</span>
                    <span className="text-base font-black font-mono text-white mt-1 block">
                      {typeof latestPoint === 'number' ? latestPoint.toLocaleString() : latestPoint}
                    </span>
                    <span className="text-[9px] font-mono text-[#00F5A0]">{m.unit}</span>
                  </button>
                );
              })}
            </div>

            {/* Main Interactive Moving AreaChart */}
            <div className="bg-[#050816] border border-[#1E293B] rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-slate-300 font-bold">
                  Live Time-Series: <strong className="text-white">{selectedMetricConfig.label}</strong>
                </span>
                <span className="text-xs font-mono text-slate-500">60 Data Points</span>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="fullMetricGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedMetricConfig.color} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={selectedMetricConfig.color} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="time_label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#111827',
                        border: '1px solid #1E293B',
                        borderRadius: 12,
                        fontSize: 12,
                        color: '#e2e8f0',
                      }}
                      formatter={(val: any) => [
                        `${Number(val).toLocaleString()} ${selectedMetricConfig.unit}`,
                        selectedMetricConfig.label,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey={selectedMetricKey}
                      stroke={selectedMetricConfig.color}
                      strokeWidth={3}
                      fill="url(#fullMetricGrad)"
                      dot={{ r: 3, fill: selectedMetricConfig.color }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: WATCHDOG HEALTH BOARD (7 Watchdogs) ────────────────────────── */}
      {activeTab === 'watchdogs' && (
        <div className="space-y-6">
          <div className="bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  All 7 Automated Business Watchdogs
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Autonomous monitors scanning revenue, inventory stockouts, payment gateway drops, webhooks, retention, recovery, and incidents.
                </p>
              </div>

              <button
                onClick={handleRunWatchdogs}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-[#00F5A0] text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-[#00F5A0]/20 hover:opacity-90 transition-all flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'watchdogs' ? 'animate-spin' : ''}`} />
                Run All 7 Watchdogs Now
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(feeds?.watchdogs_board || []).map((wd: any) => (
                <div
                  key={wd.id}
                  className="bg-[#050816] p-5 rounded-2xl border border-[#1E293B] hover:border-[#00F5A0]/30 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase font-mono font-extrabold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {wd.category}
                      </span>
                      <span
                        className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full ${
                          wd.status === 'Healthy'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {wd.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-white">{wd.name}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{wd.description}</p>
                  </div>

                  <div className="p-3 bg-[#0B1120] rounded-xl border border-[#1E293B] space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Items Scanned:</span>
                      <strong className="text-white">{wd.items_scanned}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Issues Detected:</span>
                      <strong className={wd.issues_found > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {wd.issues_found}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Execution Latency:</span>
                      <strong className="text-[#00F5A0]">{wd.latency_ms} ms</strong>
                    </div>
                  </div>

                  {wd.recommendation && (
                    <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300">
                      <strong>AI Action:</strong> {wd.recommendation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: EVENT TIMELINE (Step Functions style) ───────────────────────── */}
      {activeTab === 'event_timeline' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                AWS EventBridge &amp; Step Functions Execution Timeline
              </h3>
              <p className="text-xs text-slate-400 mt-1">Complete trace history for autonomous state transitions</p>
            </div>

            <button
              onClick={handleSimulateEvents}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2"
            >
              <Zap className="w-3.5 h-3.5" /> Emit Test Events
            </button>
          </div>

          <div className="space-y-3">
            {(feeds?.timeline_feed || []).map((tl: any, idx: number) => (
              <div
                key={tl.trace_id || idx}
                className="p-4 bg-[#050816] rounded-2xl border border-[#1E293B] hover:border-cyan-500/40 transition-all space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="font-extrabold text-white font-mono">{tl.event_type}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      Trace: {tl.trace_id}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(tl.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                    {tl.execution_result}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="text-slate-400 font-bold">Rule Evaluated:</span>
                  <span>{tl.rule_evaluated}</span>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono pt-1">
                  <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-purple-400" /> Lambda: {tl.lambda_invoked}
                  </span>
                  <span className="bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                    <Radio className="w-3 h-3 text-pink-400" /> SNS Notification Sent
                  </span>
                  <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                    <Activity className="w-3 h-3 text-amber-400" /> CloudWatch Metrics Logged
                  </span>
                  <span className="ml-auto text-slate-400 font-mono">
                    Latency: {tl.duration_ms} ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: SCHEDULERS FEED (6 Schedulers) ─────────────────────────────── */}
      {activeTab === 'schedulers' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Autonomous Automation Schedulers (Cron Engine)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Execution history for daily stock scans, payment recovery crons, revenue health scans, and reports.
              </p>
            </div>

            <button
              onClick={handleRunSchedulers}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5" /> Trigger All Schedulers
            </button>
          </div>

          <div className="space-y-3">
            {(feeds?.schedulers_feed || []).map((sc: any, idx: number) => (
              <div
                key={sc.execution_id || idx}
                className="p-4 bg-[#050816] rounded-2xl border border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm">{sc.schedule_name}</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                      {sc.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span>Source: {sc.trigger_source}</span>
                    <span>Lambda: {sc.lambda_executed}</span>
                    <span>Duration: {sc.duration_seconds}s</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded">
                    Start: {new Date(sc.start_time).toLocaleTimeString()}
                  </span>
                  <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded">
                    Finish: {new Date(sc.finish_time).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: LAMBDA INVOCATIONS (5 Serverless Handlers) ─────────────────── */}
      {activeTab === 'lambdas' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-400" />
                AWS Lambda Execution Logs &amp; Payloads
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Handlers: InventoryLambda, RecoveryLambda, ReportsLambda, IncidentLambda, CloudWatchLambda
              </p>
            </div>

            <button
              onClick={handleRunLambdas}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5" /> Execute 5 Handlers
            </button>
          </div>

          <div className="space-y-3">
            {(feeds?.lambda_feed || []).map((lam: any, idx: number) => (
              <div
                key={lam.execution_id || idx}
                className="p-4 bg-[#050816] rounded-2xl border border-[#1E293B] space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-purple-300 text-sm">{lam.function_name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        lam.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {lam.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-[#00F5A0] font-bold">{lam.duration_ms} ms</span>
                    <span className="text-slate-500">
                      {lam.timestamp ? new Date(lam.timestamp).toLocaleString() : 'Just now'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span>Request ID: {lam.aws_request_id || lam.request_id}</span>
                  <span>Trace ID: {lam.trace_id}</span>
                </div>

                {lam.payload && (
                  <pre className="p-2.5 bg-[#0B1120] rounded-xl border border-[#1E293B] text-[#00F5A0] font-mono text-[10px] overflow-x-auto">
                    {JSON.stringify(lam.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: S3 REPORTS CENTER ──────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Amazon S3 Generated Operational Reports
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                CSV, JSON, and PDF reports uploaded to bucket <strong className="text-white font-mono">revenuepilot-reports</strong>
              </p>
            </div>

            <button
              onClick={handleRunReports}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'reports' ? 'animate-spin' : ''}`} />
              Generate All 7 Reports
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(feeds?.reports_feed || []).map((rep: any, idx: number) => (
              <div
                key={rep.report_id || idx}
                className="p-5 bg-[#050816] rounded-2xl border border-[#1E293B] hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-3 text-xs"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase font-mono font-extrabold text-[#00F5A0] bg-[#00F5A0]/10 px-2 py-0.5 rounded">
                      {rep.format || rep.format_type || 'CSV'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      {rep.record_count || 120} records
                    </span>
                  </div>

                  <h4 className="text-sm font-extrabold text-white mt-2 truncate">{rep.filename}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    Type: <strong className="text-slate-200 capitalize">{rep.type || rep.report_type}</strong>
                  </p>
                </div>

                <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between font-mono text-[10px]">
                  <span className="text-slate-500">
                    {new Date(rep.created_at || rep.generated_at).toLocaleDateString()}
                  </span>
                  <a
                    href={rep.download_url || rep.s3_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Download className="w-3 h-3" /> Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: RECOVERY CAMPAIGNS (100 Campaigns + Previews) ──────────────── */}
      {activeTab === 'recovery_campaigns' && (
        <div className="space-y-6">
          <div className="bg-[#0B1120] border border-[#1E293B] rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1E293B] pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-pink-400" />
                  100 Autonomous Recovery Campaigns Feed
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Failed payment reminders, comeback discounts, cart abandonment alerts across WhatsApp, Email, and Push.
                </p>
              </div>

              <span className="text-xs font-mono text-pink-400 bg-pink-500/10 border border-pink-500/30 px-3 py-1 rounded-xl">
                100 Campaigns Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(feeds?.recovery_feed || []).map((camp: any, idx: number) => (
                <div
                  key={camp.campaign_id || idx}
                  onClick={() => setSelectedCampaign(camp)}
                  className="p-5 bg-[#050816] rounded-2xl border border-[#1E293B] hover:border-pink-500/40 cursor-pointer transition-all flex flex-col justify-between space-y-3 text-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase font-mono font-extrabold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {camp.type}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          camp.status === 'converted'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-indigo-500/10 text-indigo-400'
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-white truncate">{camp.title}</h4>
                    <p className="text-[11px] text-slate-400">
                      Customer: <strong className="text-slate-200">{camp.customer_name}</strong>
                    </p>
                  </div>

                  <div className="p-3 bg-[#0B1120] rounded-xl border border-[#1E293B] space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Discount Code:</span>
                      <strong className="text-[#00F5A0]">{camp.discount_code}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Order Value:</span>
                      <strong className="text-white">₹{Number(camp.amount || 0).toLocaleString()}</strong>
                    </div>
                  </div>

                  <button className="w-full py-1.5 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1 text-[11px]">
                    <Eye className="w-3 h-3" /> Preview WhatsApp / Email / Push
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: AUTOMATION RULES (Existing Rules List) ─────────────────────── */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rules.map((rule, idx) => (
              <div
                key={rule.id || idx}
                className={`p-5 rounded-2xl bg-[#0B1120] border transition-all flex flex-col justify-between ${
                  rule.enabled
                    ? 'border-[#00F5A0]/30 shadow-lg shadow-[#00F5A0]/5'
                    : 'border-[#1E293B] opacity-60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {rule.category || 'Payments'}
                      </span>
                      <h3 className="text-sm font-extrabold text-white mt-1.5 leading-snug">{rule.name}</h3>
                    </div>
                    <span className="text-[10px] font-mono text-[#00F5A0] bg-[#00F5A0]/10 px-2 py-0.5 rounded-full font-bold">
                      ACTIVE
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{rule.description}</p>

                  <div className="p-3 bg-[#050816] rounded-xl border border-[#1E293B] space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Trigger Event:</span>
                      <span className="font-mono text-[#00F5A0] font-bold">{rule.trigger}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Actions Configured:</span>
                      <span className="font-bold text-slate-200">
                        {rule.actions?.length || 0} Actions ({rule.actions?.map((a: any) => a.type).join(', ')})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1E293B] flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-[#00F5A0]" />
                    Executions: <strong className="text-white">{rule.execution_count || 0}</strong>
                  </span>
                  <span>Priority: {rule.priority || 5}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: DEVELOPER TEST GENERATOR PANEL ─────────────────────────────── */}
      {activeTab === 'test_generator' && (
        <div className="bg-[#0B1120] border border-[#00F5A0]/30 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-[#1E293B] pb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#00F5A0]" />
              Developer Test Event Generator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Emits simulated business events into the EventBus queue for instant AWS dispatch and rule validation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Select Event Type to Emit</label>
                <select
                  value={testEventType}
                  onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full bg-[#050816] border border-[#1E293B] rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-[#00F5A0]"
                >
                  <option value="PAYMENT_FAILED">PAYMENT_FAILED (Decline / Timeout)</option>
                  <option value="PAYMENT_SUCCESS">PAYMENT_SUCCESS (Paid Order)</option>
                  <option value="LOW_STOCK">LOW_STOCK (Stock &le; 5)</option>
                  <option value="OUT_OF_STOCK">OUT_OF_STOCK (Zero Stock)</option>
                  <option value="REVENUE_DROP">REVENUE_DROP (Anomaly 20%+)</option>
                  <option value="REVENUE_SPIKE">REVENUE_SPIKE (Surge 30%+)</option>
                  <option value="ABANDONED_CART">ABANDONED_CART (Checkout Drop-off)</option>
                  <option value="WEBHOOK_RETRY">WEBHOOK_RETRY (Signature / Delivery Retry)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Customer Name</label>
                <input
                  type="text"
                  value={testPayload.customer_name}
                  onChange={(e) => setTestPayload({ ...testPayload, customer_name: e.target.value })}
                  className="w-full bg-[#050816] border border-[#1E293B] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#00F5A0]"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={testPayload.amount}
                  onChange={(e) => setTestPayload({ ...testPayload, amount: Number(e.target.value) })}
                  className="w-full bg-[#050816] border border-[#1E293B] rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-[#00F5A0]"
                />
              </div>

              <button
                onClick={handleEmitTestEvent}
                className="w-full py-3 bg-[#00F5A0] text-slate-950 font-black rounded-xl hover:bg-[#00F5A0]/90 transition-all shadow-lg shadow-[#00F5A0]/20 flex items-center justify-center gap-2 text-xs"
              >
                <Send className="w-4 h-4" /> Emit Event to EventBus Queue
              </button>
            </div>

            <div className="bg-[#050816] border border-[#1E293B] rounded-2xl p-4 space-y-2 text-xs">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Event Dispatch Inspector Output
              </span>
              {testResult ? (
                <pre className="p-3 bg-[#111827] rounded-xl border border-[#00F5A0]/30 text-[#00F5A0] font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              ) : (
                <p className="text-slate-500 italic py-10 text-center">Click "Emit Event" to view live dispatch log</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL / DRAWER: RECOVERY CAMPAIGN MESSAGE PREVIEW ───────────────── */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B1120] border border-[#00F5A0]/30 rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl">
            <div className="flex justify-between items-start border-b border-[#1E293B] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#00F5A0] font-bold">
                  {selectedCampaign.type}
                </span>
                <h3 className="text-base font-black text-white">{selectedCampaign.title}</h3>
                <p className="text-xs text-slate-400">Target: {selectedCampaign.customer_name} ({selectedCampaign.customer_phone})</p>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Preview Channel Tabs */}
            <div className="flex gap-2 border-b border-[#1E293B] pb-2">
              {[
                { key: 'whatsapp', label: 'WhatsApp Preview', icon: MessageSquare },
                { key: 'email', label: 'Email Preview', icon: Mail },
                { key: 'push', label: 'Push Notification', icon: Bell },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = previewTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setPreviewTab(tab.key as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-slate-800 text-[#00F5A0] border border-[#00F5A0]/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Message Preview Body */}
            <div className="p-4 bg-[#050816] rounded-2xl border border-[#1E293B] text-xs font-sans text-slate-200 whitespace-pre-wrap leading-relaxed">
              {previewTab === 'whatsapp' && (
                <div className="space-y-2">
                  <div className="bg-[#0B1120] p-3 rounded-xl border border-emerald-500/20 text-emerald-300 font-mono text-[11px]">
                    🟢 WhatsApp Business API Template Preview:
                  </div>
                  <p>{selectedCampaign.whatsapp_preview}</p>
                </div>
              )}
              {previewTab === 'email' && (
                <div className="space-y-2">
                  <div className="bg-[#0B1120] p-3 rounded-xl border border-indigo-500/20 text-indigo-300 font-mono text-[11px]">
                    📬 Responsive Email HTML Preview:
                  </div>
                  <p>{selectedCampaign.email_preview}</p>
                </div>
              )}
              {previewTab === 'push' && (
                <div className="space-y-2">
                  <div className="bg-[#0B1120] p-3 rounded-xl border border-pink-500/20 text-pink-300 font-mono text-[11px]">
                    🔔 Mobile Push Notification Preview:
                  </div>
                  <p>{selectedCampaign.push_preview}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedCampaign(null)}
                className="px-5 py-2.5 bg-[#00F5A0] text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-[#00F5A0]/20"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
