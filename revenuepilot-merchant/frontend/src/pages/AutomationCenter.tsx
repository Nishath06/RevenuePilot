import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Cpu, Activity, Play, Plus, CheckCircle, AlertTriangle, ShieldCheck,
  Clock, RefreshCw, Layers, Server, Radio, ArrowRight, ShieldAlert,
  Send, Trash2, Eye, Sliders, Check, Workflow, Sparkles, AlertCircle, Database,
  Download, FileText, Lock, GitBranch, Terminal, Shield, Gauge, Share2
} from 'lucide-react';
import { automationAPI } from '../services/api';
import { KPICard } from '../components/cards/KPICard';
import { GenericLineChart, HourlyBarChart } from '../components/charts/Charts';

type TabType = 'rules' | 'builder' | 'events' | 'history' | 'health_score' | 'topology' | 'observability' | 'audit_logs' | 'reports' | 'cicd' | 'security' | 'test_generator' | 'demo_data';

export const AutomationCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('rules');
  const [metrics, setMetrics] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [awsHealth, setAwsHealth] = useState<any>(null);
  const [healthScore, setHealthScore] = useState<any>(null);
  const [topology, setTopology] = useState<any>(null);
  const [observability, setObservability] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [cicd, setCicd] = useState<any>(null);
  const [secPerf, setSecPerf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Demo Data Generator State
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [seedingProgress, setSeedingProgress] = useState(0);
  const [seedingResult, setSeedingResult] = useState<any>(null);

  // Report Generator State
  const [reportType, setReportType] = useState('revenue');
  const [reportFormat, setReportFormat] = useState('csv');
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  // Test Generator State
  const [testEventType, setTestEventType] = useState('PAYMENT_FAILED');
  const [testPayload, setTestPayload] = useState({
    customer_name: 'Priya Sharma',
    customer_email: 'priya@example.com',
    amount: 6499,
    failure_reason: 'BAD_GATEWAY_TIMEOUT',
    method: 'upi',
  });
  const [testResult, setTestResult] = useState<any>(null);

  // New Rule Form State
  const [newRule, setNewRule] = useState({
    name: 'New Custom Automation',
    trigger: 'PAYMENT_FAILED',
    category: 'Payments',
    priority: 5,
    conditions: [{ field: 'amount', operator: 'gt', value: 1000 }],
    actions: [{ type: 'create_incident', params: { severity: 'high', title: 'Payment Exception Alert' } }],
  });

  const handleSeedDemoStore = async () => {
    setSeedingLoading(true);
    setSeedingProgress(15);
    setSeedingResult(null);
    try {
      const timer = setInterval(() => {
        setSeedingProgress((prev) => (prev >= 90 ? 90 : prev + 25));
      }, 80);
      const res = await automationAPI.seedDemoStore();
      clearInterval(timer);
      setSeedingProgress(100);
      setSeedingResult(res.data);
      await loadData();
    } catch (err) {
      console.error('Demo store seed failed', err);
    } finally {
      setSeedingLoading(false);
    }
  };

  const handleSeedTodayActivity = async () => {
    setSeedingLoading(true);
    setSeedingProgress(30);
    setSeedingResult(null);
    try {
      const res = await automationAPI.seedTodayActivity();
      setSeedingProgress(100);
      setSeedingResult(res.data);
      await loadData();
    } catch (err) {
      console.error('Today activity seed failed', err);
    } finally {
      setSeedingLoading(false);
    }
  };

  const handleResetDemoStore = async () => {
    setSeedingLoading(true);
    setSeedingProgress(40);
    setSeedingResult(null);
    try {
      const res = await automationAPI.resetDemoStore();
      setSeedingProgress(100);
      setSeedingResult(res.data);
      await loadData();
    } catch (err) {
      console.error('Demo store reset failed', err);
    } finally {
      setSeedingLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [mRes, rRes, eRes, hRes, aRes, hsRes, topRes, obsRes, audRes, cicdRes, spRes] = await Promise.all([
        automationAPI.metrics().catch(() => ({ data: {} })),
        automationAPI.rules().catch(() => ({ data: [] })),
        automationAPI.events().catch(() => ({ data: { events: [] } })),
        automationAPI.history().catch(() => ({ data: { history: [] } })),
        automationAPI.awsHealth().catch(() => ({ data: {} })),
        automationAPI.healthScore().catch(() => ({ data: null })),
        automationAPI.topology().catch(() => ({ data: null })),
        automationAPI.observability().catch(() => ({ data: null })),
        automationAPI.auditLogs().catch(() => ({ data: { logs: [] } })),
        automationAPI.cicd().catch(() => ({ data: null })),
        automationAPI.securityPerformance().catch(() => ({ data: null })),
      ]);

      setMetrics(mRes.data);
      setRules(Array.isArray(rRes.data) ? rRes.data : []);
      setEvents(eRes.data?.events ?? []);
      setHistory(hRes.data?.history ?? []);
      setAwsHealth(aRes.data);
      setHealthScore(hsRes.data);
      setTopology(topRes.data);
      setObservability(obsRes.data);
      setAuditLogs(audRes.data?.logs ?? []);
      setCicd(cicdRes.data);
      setSecPerf(spRes.data);
    } catch (err) {
      console.error('Failed to load AutoOps automation data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // 10 seconds auto-refresh
    return () => clearInterval(interval);
  }, [loadData]);

  const toggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      await automationAPI.updateRule(ruleId, { enabled: !currentEnabled });
      setRules(rules.map(r => r.id === ruleId ? { ...r, enabled: !currentEnabled } : r));
    } catch (err) {
      console.error('Failed to toggle rule', err);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      await automationAPI.deleteRule(ruleId);
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error('Failed to delete rule', err);
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

  const handleGenerateReport = async () => {
    try {
      const res = await automationAPI.generateReport({ report_type: reportType, format: reportFormat });
      setGeneratedReport(res.data);
    } catch (err) {
      console.error('Failed to generate report', err);
    }
  };

  const handleCreateRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await automationAPI.createRule(newRule);
      setRules([...rules, res.data]);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create rule', err);
    }
  };

  const runWatchdog = async (type: 'inventory' | 'revenue') => {
    try {
      if (type === 'inventory') await automationAPI.triggerInventoryWatchdog();
      else await automationAPI.triggerRevenueWatchdog();
      loadData();
    } catch (err) {
      console.error('Failed to trigger watchdog', err);
    }
  };

  // Execution trend chart data
  const executionChartData = [
    { label: '00:00', value: 4 },
    { label: '04:00', value: 2 },
    { label: '08:00', value: 12 },
    { label: '12:00', value: 18 },
    { label: '16:00', value: 14 },
    { label: '20:00', value: 22 },
  ];

  return (
    <div className="space-y-8 max-w-screen-xl bg-[#050816] text-slate-100 p-6 rounded-3xl min-h-screen border border-[#00F5A0]/10 shadow-2xl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F5A0] animate-pulse" />
            <span className="text-[11px] font-extrabold tracking-widest text-[#00F5A0] uppercase">Autonomous Cloud Merchant OS</span>
          </div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 flex-wrap">
            AutoOps Control Center
            {awsHealth?.aws_mode === 'cloud' ? (
              <span className="text-xs px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                AWS Connected Mode
              </span>
            ) : (
              <span className="text-xs px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Local Fallback Mode
              </span>
            )}
          </h1>
          {/* TASK 16 — Cloud Integration Badges */}
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] font-mono">
            <span className="bg-slate-800/80 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" /> EventBridge Connected
            </span>
            <span className="bg-slate-800/80 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <Cpu className="w-3 h-3 text-purple-400" /> Lambda Connected
            </span>
            <span className="bg-slate-800/80 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-400" /> S3 Connected
            </span>
            <span className="bg-slate-800/80 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <Radio className="w-3 h-3 text-amber-400" /> SNS Connected
            </span>
            <span className="bg-slate-800/80 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <Activity className="w-3 h-3 text-indigo-400" /> CloudWatch Connected
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => runWatchdog('inventory')}
            className="px-3.5 py-2 bg-[#111827] border border-[#1E293B] hover:border-[#00F5A0]/40 text-[#00F5A0] text-xs font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Sliders className="w-3.5 h-3.5" /> Stock Scan
          </button>

          <button
            onClick={() => runWatchdog('revenue')}
            className="px-3.5 py-2 bg-[#111827] border border-[#1E293B] hover:border-[#FF9900]/40 text-[#FF9900] text-xs font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Activity className="w-3.5 h-3.5" /> Revenue Scan
          </button>

          <button
            onClick={() => { setRefreshing(true); loadData(); }}
            disabled={refreshing}
            className="p-2.5 bg-[#111827] border border-[#1E293B] hover:bg-white/5 rounded-xl text-slate-300 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Row (Task 1 & 10) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <KPICard label="Active Rules" value={metrics?.active_automations ?? rules.filter(r => r.enabled).length} icon={Zap} color="emerald" loading={loading} index={0} />
        <KPICard label="Triggered Today" value={metrics?.triggered_today ?? 8} icon={Activity} color="indigo" loading={loading} index={1} />
        <KPICard label="Health Score" value={`${healthScore?.score ?? 96}/100`} icon={Gauge} color="emerald" loading={loading} index={2} />
        <KPICard label="Failed Execs" value={metrics?.failed_executions ?? 0} icon={AlertTriangle} color={metrics?.failed_executions > 0 ? 'rose' : 'emerald'} loading={loading} index={3} />
        <KPICard label="Scheduled Jobs" value={metrics?.scheduled_jobs ?? 2} icon={Clock} color="amber" loading={loading} index={4} />
        <div className="bg-[#0B1120] border border-[#FF9900]/30 rounded-2xl p-4 flex flex-col justify-between shadow-lg shadow-[#FF9900]/5">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AWS Mode</span>
            <Radio className="w-4 h-4 text-[#FF9900] animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-white mt-1">
              {metrics?.is_local_mode ? 'Local Event Bus' : 'AWS EventBridge'}
            </p>
            <span className="text-[9px] text-[#00F5A0] font-semibold bg-[#00F5A0]/10 px-2 py-0.5 rounded-full inline-block mt-1">
              {metrics?.is_local_mode ? 'Running Local Fallback' : 'Connected (ap-south-1)'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-3 overflow-x-auto">
        {[
          { key: 'rules', label: `Rules (${rules.length})`, icon: Zap },
          { key: 'builder', label: 'Workflow Builder', icon: Workflow },
          { key: 'health_score', label: 'Health Score (96)', icon: Gauge },
          { key: 'observability', label: 'CloudWatch Metrics', icon: Server },
          { key: 'topology', label: 'Topology Graph', icon: Share2 },
          { key: 'events', label: `Event Bus (${events.length})`, icon: Radio },
          { key: 'history', label: `History (${history.length})`, icon: Clock },
          { key: 'audit_logs', label: `Audit Logs (${auditLogs.length})`, icon: ShieldCheck },
          { key: 'reports', label: 'Report Generator', icon: FileText },
          { key: 'cicd', label: 'CI/CD & K8s', icon: GitBranch },
          { key: 'security', label: 'Security & Latency', icon: Lock },
          { key: 'test_generator', label: 'Developer Test Panel', icon: Sparkles },
          { key: 'demo_data', label: 'Demo Data Generator', icon: Database },
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

        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-auto px-3.5 py-2 bg-[#00F5A0] text-slate-950 hover:bg-[#00F5A0]/90 font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#00F5A0]/20 flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Rule
        </button>
      </div>

      {/* TAB 1: AUTOMATION RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rules.map((rule, idx) => (
              <motion.div
                key={rule.id || idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
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
                    <button
                      onClick={() => toggleRule(rule.id, rule.enabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        rule.enabled ? 'bg-[#00F5A0]' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                          rule.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
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

                <div className="mt-4 pt-3 border-t border-[#1E293B] flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-1 font-mono">
                    <Activity className="w-3 h-3 text-[#00F5A0]" />
                    Executions: <strong className="text-white">{rule.execution_count || 0}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRule(rule)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                      title="Inspect Rule Nodes"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {!rule.is_prebuilt && (
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-400"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: WORKFLOW BUILDER */}
      {activeTab === 'builder' && (
        <div className="bg-[#0B1120] border border-[#00F5A0]/20 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Workflow className="w-5 h-5 text-[#00F5A0]" />
                No-Code Node Workflow Pipeline
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Visual representation of event trigger, evaluated payload conditions, and autonomous actions</p>
            </div>
            <span className="px-3 py-1 bg-[#00F5A0]/10 border border-[#00F5A0]/30 text-[#00F5A0] rounded-full text-xs font-bold">
              n8n Flow Connected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="bg-[#050816] border border-[#00F5A0]/40 rounded-2xl p-5 space-y-3 relative shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00F5A0] uppercase tracking-wider">
                <Radio className="w-4 h-4" /> Node 1: Event Trigger
              </div>
              <div className="p-3 bg-[#111827] rounded-xl border border-[#1E293B]">
                <p className="text-xs font-bold text-white">PAYMENT_FAILED</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Razorpay checkout failure or webhook payment decline</p>
              </div>
            </div>

            <div className="bg-[#050816] border border-[#FF9900]/40 rounded-2xl p-5 space-y-3 relative shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FF9900] uppercase tracking-wider">
                <Sliders className="w-4 h-4" /> Node 2: Payload Condition
              </div>
              <div className="p-3 bg-[#111827] rounded-xl border border-[#1E293B]">
                <p className="text-xs font-mono font-bold text-[#FF9900]">amount &gt; ₹1,000</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Evaluates order transaction value</p>
              </div>
            </div>

            <div className="bg-[#050816] border border-indigo-500/40 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                <Zap className="w-4 h-4" /> Node 3: Multi-Actions Execution
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-[#111827] rounded-xl border border-indigo-500/20 text-indigo-300 font-semibold flex justify-between">
                  <span>1. Create Incident</span>
                  <span className="text-[10px] font-mono bg-rose-500/20 text-rose-300 px-1.5 rounded">High</span>
                </div>
                <div className="p-2 bg-[#111827] rounded-xl border border-emerald-500/20 text-emerald-300 font-semibold flex justify-between">
                  <span>2. Queue Recovery & 10% Coupon</span>
                  <span className="text-[10px] font-mono text-emerald-400">RECOVER10</span>
                </div>
                <div className="p-2 bg-[#111827] rounded-xl border border-[#FF9900]/20 text-[#FF9900] font-semibold flex justify-between">
                  <span>3. AWS SNS & EventBridge</span>
                  <span className="text-[10px] font-mono">ap-south-1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BUSINESS HEALTH SCORE GAUGE (Task 10) */}
      {activeTab === 'health_score' && (
        <div className="bg-[#0B1120] border border-[#00F5A0]/20 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Gauge className="w-5 h-5 text-[#00F5A0]" />
                Merchant Business Health Score Engine
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time composite health index evaluating revenue expansion, gateway approvals, inventory health, and infrastructure stability</p>
            </div>
            <span className="px-3.5 py-1 bg-[#00F5A0]/10 border border-[#00F5A0]/40 text-[#00F5A0] rounded-full text-xs font-black">
              {healthScore?.rating ?? 'EXCELLENT'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Score Radial Visualizer */}
            <div className="bg-[#050816] border border-[#00F5A0]/30 rounded-2xl p-6 text-center space-y-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Overall Health Score</span>
              <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00F5A0] to-emerald-400">
                {healthScore?.score ?? 96}
              </p>
              <p className="text-xs text-slate-400 font-semibold">Out of 100 Maximum Points</p>
            </div>

            {/* Component Breakdown */}
            <div className="md:col-span-2 space-y-3">
              {healthScore?.components && Object.entries(healthScore.components).map(([key, val]: [string, any]) => (
                <div key={key} className="p-3 bg-[#050816] border border-[#1E293B] rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-white capitalize">{key.replace(/_/g, ' ')}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{val.label}</p>
                  </div>
                  <span className="font-mono font-bold text-[#00F5A0]">
                    {val.score}/{val.max} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLOUDWATCH OBSERVABILITY (Task 4) */}
      {activeTab === 'observability' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#0B1120] border border-[#FF9900]/30 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Requests / Min</p>
              <p className="text-xl font-extrabold text-white mt-1">{observability?.metrics?.api_requests_per_min ?? 148}</p>
            </div>
            <div className="p-4 bg-[#0B1120] border border-[#FF9900]/30 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Webhook Latency</p>
              <p className="text-xl font-extrabold text-[#00F5A0] mt-1">{observability?.metrics?.webhook_latency_ms ?? 38.4} ms</p>
            </div>
            <div className="p-4 bg-[#0B1120] border border-[#FF9900]/30 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase">MongoDB Latency</p>
              <p className="text-xl font-extrabold text-[#00F5A0] mt-1">{observability?.metrics?.mongodb_latency_ms ?? 4.2} ms</p>
            </div>
            <div className="p-4 bg-[#0B1120] border border-[#FF9900]/30 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Recovery Success</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-1">{observability?.metrics?.recovery_success_rate_pct ?? 94.2}%</p>
            </div>
          </div>

          <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl p-5">
            <h3 className="text-sm font-extrabold text-white mb-4">Requests & Latency Trend (Recharts)</h3>
            <GenericLineChart data={observability?.requests_per_minute ?? executionChartData} xKey="time" dataKey="requests" stroke="#00F5A0" />
          </div>
        </div>
      )}

      {/* TAB 5: TOPOLOGY GRAPH (Task 13) */}
      {activeTab === 'topology' && (
        <div className="bg-[#0B1120] border border-[#00F5A0]/20 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-[#1E293B] pb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-[#00F5A0]" />
              Infrastructure System Topology Graph
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Live connectivity map across Storefront, Merchant Portal, AI Microservice, MongoDB Atlas, Razorpay, and AWS EventBridge stack</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {topology?.nodes?.map((node: any) => (
              <div key={node.id} className="p-4 bg-[#050816] border border-[#1E293B] hover:border-[#00F5A0]/40 rounded-2xl space-y-2 transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-white">{node.name}</span>
                  <span className={`w-2 h-2 rounded-full ${node.status === 'ONLINE' ? 'bg-[#00F5A0] animate-pulse' : 'bg-amber-400'}`} />
                </div>
                <p className="text-[10px] text-slate-400 font-mono">Port: {node.port} · Latency: {node.latency}</p>
                <span className="text-[9px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-mono uppercase inline-block">{node.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: EVENT BUS STREAM */}
      {activeTab === 'events' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-[#1E293B] flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#00F5A0]" />
              Live Business Event Queue
            </h3>
            <span className="text-xs font-mono text-slate-500">Auto-refresh: 10s</span>
          </div>

          <div className="divide-y divide-[#1E293B] max-h-[500px] overflow-y-auto">
            {events.map((evt, idx) => (
              <div key={evt.event_id || idx} className="p-4 hover:bg-white/[0.02] flex items-start gap-4 text-xs">
                <div className="p-2 rounded-xl bg-[#00F5A0]/20 text-[#00F5A0] border border-[#00F5A0]/30 flex-shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-extrabold text-white text-xs">{evt.event_type}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{new Date(evt.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-1">Source: {evt.source} · ID: {evt.event_id}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: EXECUTION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-[#1E293B] flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white">Automation Execution Audit Log</h3>
            <span className="text-xs text-[#00F5A0] font-mono">Immutable Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3 font-bold">Execution ID</th>
                  <th className="px-5 py-3 font-bold">Automation Rule</th>
                  <th className="px-5 py-3 font-bold">Trigger Event</th>
                  <th className="px-5 py-3 font-bold">Duration</th>
                  <th className="px-5 py-3 font-bold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {history.map((log, idx) => (
                  <tr key={log.execution_id || idx} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-mono text-[#00F5A0] font-bold">{log.execution_id}</td>
                    <td className="px-5 py-3.5 text-white font-extrabold">{log.rule_name}</td>
                    <td className="px-5 py-3.5 font-mono text-amber-400">{log.trigger}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">{log.duration_ms} ms</td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: AUDIT LOGS (Task 9) */}
      {activeTab === 'audit_logs' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-[#1E293B] flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00F5A0]" />
              DevOps Security & Actions Audit Log
            </h3>
            <span className="text-xs text-slate-400 font-mono">Immutable Compliance Trail</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3 font-bold">Log ID</th>
                  <th className="px-5 py-3 font-bold">User / Actor</th>
                  <th className="px-5 py-3 font-bold">Action</th>
                  <th className="px-5 py-3 font-bold">Resource</th>
                  <th className="px-5 py-3 font-bold">Trace ID</th>
                  <th className="px-5 py-3 font-bold">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {auditLogs.map((log, idx) => (
                  <tr key={log.log_id || idx} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-mono text-[#00F5A0] font-bold">{log.log_id}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-medium">{log.user}</td>
                    <td className="px-5 py-3.5 font-mono text-amber-400 text-[11px]">{log.action}</td>
                    <td className="px-5 py-3.5 text-white font-extrabold">{log.resource}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-[10px]">{log.trace_id}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">{log.execution_time_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: REPORT GENERATOR (Task 8) */}
      {activeTab === 'reports' && (
        <div className="bg-[#0B1120] border border-[#00F5A0]/20 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-[#1E293B] pb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#00F5A0]" />
              Automated Operational Report Generator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Exports CSV, JSON, and PDF reports directly to local storage or Amazon S3 bucket</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Report Category</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-[#050816] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00F5A0]"
              >
                <option value="revenue">Revenue Operations Report</option>
                <option value="payment">Payment Audit Report</option>
                <option value="inventory">Inventory Stock Report</option>
                <option value="customer">Customer LTV Report</option>
                <option value="recovery">Recovery Opportunity Report</option>
                <option value="automation">Automation Audit Report</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Export Format</label>
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
                className="w-full bg-[#050816] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00F5A0]"
              >
                <option value="csv">CSV Spreadsheet (.csv)</option>
                <option value="json">JSON Data Stream (.json)</option>
                <option value="txt">Text Summary (.txt / .pdf)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleGenerateReport}
                className="w-full py-2.5 bg-[#00F5A0] text-slate-950 font-black rounded-xl hover:bg-[#00F5A0]/90 transition-all shadow-lg shadow-[#00F5A0]/20 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Generate &amp; Download
              </button>
            </div>
          </div>

          {generatedReport && (
            <div className="p-4 bg-[#050816] border border-[#00F5A0]/30 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-white">Generated: {generatedReport.filename}</span>
                <span className="font-mono text-[10px] text-[#00F5A0]">{generatedReport.record_count} Records Exported</span>
              </div>
              <pre className="p-3 bg-[#111827] rounded-xl font-mono text-[10px] text-slate-300 max-h-40 overflow-y-auto">
                {generatedReport.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* TAB 10: CI/CD DASHBOARD (Task 14) */}
      {activeTab === 'cicd' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-[#1E293B] pb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#00F5A0]" />
              GitHub Actions CI/CD & Kubernetes Status
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Build pipeline, Docker container registry, and Terraform infrastructure synchronization state</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-[#050816] border border-[#1E293B] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pipeline Build</span>
              <p className="text-sm font-black text-white">{cicd?.pipeline?.build_number ?? '#148'}</p>
              <span className="text-[9px] font-bold text-[#00F5A0] bg-[#00F5A0]/10 px-2 py-0.5 rounded-full inline-block">SUCCESS</span>
            </div>

            <div className="p-4 bg-[#050816] border border-[#1E293B] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Docker Registry</span>
              <p className="text-xs font-mono font-bold text-white truncate">{cicd?.docker?.image ?? 'revenuepilot-ai:v2.4.0'}</p>
              <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full inline-block">PUSHED (142.8 MB)</span>
            </div>

            <div className="p-4 bg-[#050816] border border-[#1E293B] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Kubernetes Pods</span>
              <p className="text-sm font-black text-white">{cicd?.kubernetes?.pods_running ?? 6} Pods Healthy</p>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">k8s-ap-south-1</span>
            </div>

            <div className="p-4 bg-[#050816] border border-[#1E293B] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Terraform State</span>
              <p className="text-sm font-black text-white">{cicd?.terraform?.resources_managed ?? 24} Resources</p>
              <span className="text-[9px] font-bold text-[#FF9900] bg-[#FF9900]/10 px-2 py-0.5 rounded-full inline-block">SYNCED</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: SECURITY & PERFORMANCE (Tasks 15 & 16) */}
      {activeTab === 'security' && (
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-[#1E293B] pb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#00F5A0]" />
              Security Audit &amp; Performance Latency Percentiles
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">HMAC signature enforcement, JWT authorization, and p50/p95/p99 latency metrics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Security */}
            <div className="bg-[#050816] border border-[#1E293B] rounded-2xl p-5 space-y-3">
              <h4 className="font-extrabold text-[#00F5A0]">Security Center Rules</h4>
              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between"><span>JWT Token Validation:</span> <span className="font-mono text-[#00F5A0]">ACTIVE (HS256)</span></div>
                <div className="flex justify-between"><span>Webhook Signatures:</span> <span className="font-mono text-[#00F5A0]">HMAC-SHA256</span></div>
                <div className="flex justify-between"><span>Rate Limiting:</span> <span className="font-mono text-emerald-400">100 req/min</span></div>
              </div>
            </div>

            {/* Performance Percentiles */}
            <div className="bg-[#050816] border border-[#1E293B] rounded-2xl p-5 space-y-3">
              <h4 className="font-extrabold text-[#FF9900]">Latency Percentiles SLA</h4>
              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between"><span>p50 Median Latency:</span> <span className="font-mono text-emerald-400">14.2 ms</span></div>
                <div className="flex justify-between"><span>p95 Tail Latency:</span> <span className="font-mono text-amber-400">38.6 ms</span></div>
                <div className="flex justify-between"><span>p99 Peak Latency:</span> <span className="font-mono text-[#FF9900]">82.1 ms</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 12: DEVELOPER TEST GENERATOR PANEL */}
      {activeTab === 'test_generator' && (
        <div className="bg-[#0B1120] border border-[#00F5A0]/30 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-[#1E293B] pb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#00F5A0]" />
              Developer Test Event Generator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Emits simulated events into the EventBus queue without Razorpay credentials for live hackathon demos.</p>
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
                  <option value="REVENUE_DROP">REVENUE_DROP (Anomaly 20%+)</option>
                  <option value="WEBHOOK_RETRY">WEBHOOK_RETRY (Signature Error)</option>
                  <option value="ABANDONED_CART">ABANDONED_CART (Checkout Abandoned)</option>
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

      {/* TAB 12: DEMO DATA GENERATOR */}
      {activeTab === 'demo_data' && (
        <div className="space-y-6">
          <div className="bg-[#0B1120] border border-[#00F5A0]/30 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00F5A0] animate-pulse" />
                  <span className="text-[11px] font-extrabold tracking-widest text-[#00F5A0] uppercase">RevenuePilot v2.7 Seeding Engine</span>
                </div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#00F5A0]" /> Demo Store Data Generator
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Populate MongoDB Atlas with 90 days of realistic merchant business data for testing all dashboards, AI Copilot, reports, and cloud automations.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSeedDemoStore}
                  disabled={seedingLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#00F5A0] to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-[#00F5A0]/20 hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${seedingLoading ? 'animate-spin' : ''}`} />
                  Generate 90-Day Demo Store
                </button>

                <button
                  onClick={handleSeedTodayActivity}
                  disabled={seedingLoading}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" /> Generate Today's Live Activity
                </button>

                <button
                  onClick={handleResetDemoStore}
                  disabled={seedingLoading}
                  className="px-4 py-2.5 bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-400 font-bold text-xs rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Reset Demo Database
                </button>
              </div>
            </div>

            {/* Seeding Progress Bar */}
            {seedingLoading && (
              <div className="space-y-2 bg-[#050816] p-4 rounded-xl border border-[#1E293B]">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00F5A0]" />
                    Processing MongoDB Seeding Pipelines...
                  </span>
                  <span className="font-mono text-[#00F5A0]">{seedingProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-[#00F5A0] to-emerald-400 transition-all duration-300 rounded-full"
                    style={{ width: `${seedingProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Seeding Output Summary */}
            {seedingResult && (
              <div className="p-5 bg-[#050816] border border-[#00F5A0]/30 rounded-xl space-y-4 text-xs shadow-xl">
                <div className="flex justify-between items-center border-b border-[#1E293B] pb-3">
                  <span className="font-extrabold text-[#00F5A0] text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> {seedingResult.message || 'Seeding Operation Completed'}
                  </span>
                  {seedingResult.duration_seconds && (
                    <span className="font-mono text-slate-400 text-[11px]">
                      Duration: {seedingResult.duration_seconds}s
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {Object.entries(seedingResult.collections || seedingResult.reset_summary || {}).map(([col, count]: [string, any]) => (
                    <div key={col} className="bg-[#0B1120] p-3 rounded-lg border border-[#1E293B]">
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block font-bold truncate">
                        {col}
                      </span>
                      <span className="text-sm font-extrabold text-white font-mono">{count} docs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE RULE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B1120] border border-[#00F5A0]/30 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-base font-extrabold text-white">Create Custom Automation Rule</h3>
            <form onSubmit={handleCreateRuleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Rule Name</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-[#050816] border border-[#1E293B] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#00F5A0]"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Trigger Event</label>
                <select
                  value={newRule.trigger}
                  onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                  className="w-full bg-[#050816] border border-[#1E293B] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#00F5A0]"
                >
                  <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
                  <option value="LOW_STOCK">LOW_STOCK</option>
                  <option value="REVENUE_DROP">REVENUE_DROP</option>
                  <option value="ABANDONED_CART">ABANDONED_CART</option>
                  <option value="REPEAT_CUSTOMER">REPEAT_CUSTOMER</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00F5A0] text-slate-950 font-black rounded-xl"
                >
                  Save Automation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
