/**
 * AICopilotDashboard — AI Business Operations Center
 * Day 3: Extended with 7 new AI sections
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, ShoppingBag, CreditCard, TrendingUp, Clock, Package,
  Zap, AlertTriangle, Users, ShoppingCart, RefreshCw, Activity,
  ChevronDown, ChevronUp, Database, Wifi, WifiOff, Heart,
  BarChart2, Tag, Thermometer, AlertCircle, Clock3, LucideIcon,
} from 'lucide-react';

import {
  merchantAIService,
  TodayInsights, InventoryInsights, RecoveryData, PromptChip, ChatResponse,
} from '../services/merchantAI.service';
import { merchantService } from '../services/merchant.service';
import { RevenueSummary, WebhookEvent } from '../types';

import { AICopilotCard }        from '../components/ai/AICopilotCard';
import { BusinessHealthCard }    from '../components/ai/BusinessHealthCard';
import { WarRoomAlert }          from '../components/ai/WarRoomAlert';
import { AIRecommendationCard }  from '../components/ai/AIRecommendationCard';
import { RecoveryTable }         from '../components/ai/RecoveryTable';
import { InventoryIntelligence } from '../components/ai/InventoryIntelligence';
import { SuggestedPromptChip }   from '../components/ai/SuggestedPromptChip';
import { AIHealthScore }         from '../components/ai/AIHealthScore';
import { RevenueForecast }       from '../components/ai/RevenueForecast';
import { AIRecoveryCenter }      from '../components/ai/AIRecoveryCenter';
import { AIPriceOptimization }   from '../components/ai/AIPriceOptimization';
import { InventoryRiskHeatmap }  from '../components/ai/InventoryRiskHeatmap';
import { AIIncidentCenter }      from '../components/ai/AIIncidentCenter';
import { MerchantTimeline }      from '../components/ai/MerchantTimeline';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

// ─── Collapsible Section Wrapper ─────────────────────────────────────────────

const Section: React.FC<{
  id: string; title: string; icon: React.ReactNode; badge?: string;
  collapsible?: boolean; children: React.ReactNode; defaultOpen?: boolean;
}> = ({ id, title, icon, badge, collapsible = true, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.45 }}
      className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden"
    >
      <div
        className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 ${collapsible ? 'cursor-pointer select-none hover:bg-slate-50 transition-colors' : ''}`}
        onClick={() => collapsible && setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">{icon}</div>
          <h2 className="font-extrabold text-slate-900 text-base">{title}</h2>
          {badge && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        {collapsible && <span className="text-slate-400">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="p-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export const AICopilotDashboard: React.FC = () => {
  const [aiOnline, setAiOnline]             = useState<boolean | null>(null);
  const [prompts, setPrompts]               = useState<PromptChip[]>([]);
  const [insights, setInsights]             = useState<TodayInsights | null>(null);
  const [weeklyInsights, setWeeklyInsights] = useState<TodayInsights | null>(null);
  const [inventory, setInventory]           = useState<InventoryInsights | null>(null);
  const [recovery, setRecovery]             = useState<RecoveryData | null>(null);
  const [storeData, setStoreData]           = useState<{ summary: RevenueSummary | null; events: WebhookEvent[] }>({ summary: null, events: [] });
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading]               = useState({ insights: true, inventory: true, recovery: true, store: true, weekly: true });
  const [lastRefresh, setLastRefresh]       = useState(new Date());
  const [aiQuery, setAiQuery]               = useState('');

  const loadAll = useCallback(async () => {
    setLoading({ insights: true, inventory: true, recovery: true, store: true, weekly: true });

    try { await merchantAIService.getHealth(); setAiOnline(true); }
    catch { setAiOnline(false); }

    merchantAIService.getSuggestedPrompts().then(setPrompts).catch(() => {});

    merchantAIService.getTodayInsights()
      .then(d => { setInsights(d); setRecommendations(d.recommendations ?? []); })
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, insights: false })));

    merchantAIService.getWeeklyInsights()
      .then(setWeeklyInsights)
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, weekly: false })));

    merchantAIService.getInventoryInsights()
      .then(setInventory).catch(() => {})
      .finally(() => setLoading(p => ({ ...p, inventory: false })));

    merchantAIService.getRecoverySuggestions()
      .then(setRecovery).catch(() => {})
      .finally(() => setLoading(p => ({ ...p, recovery: false })));

    Promise.all([merchantService.getRevenueSummary(), merchantService.getEvents()])
      .then(([s, e]) => setStoreData({ summary: s, events: e }))
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, store: false })));

    setLastRefresh(new Date());
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAIResponse = (_: string, response: ChatResponse) => {
    if (response.recommendations?.length) {
      setRecommendations(prev => [...response.recommendations, ...prev].slice(0, 12));
    }
  };

  // War room alerts from live data
  const warRoomAlerts: Array<{ title: string; description: string; priority: 'critical'|'high'|'medium'|'low'; icon: LucideIcon; action?: string }> = [];
  if (insights) {
    const { revenue: rev, payments: pay, orders: ord } = insights;
    if ((rev.growth_percentage ?? 0) > 20)
      warRoomAlerts.push({ title: 'Revenue Spike 🚀', description: `Revenue grew ${pct(rev.growth_percentage ?? 0)} vs yesterday.`, priority: 'high', icon: TrendingUp, action: 'Analyze' });
    if ((rev.growth_percentage ?? 0) < -15)
      warRoomAlerts.push({ title: 'Revenue Drop Alert', description: `Revenue down ${Math.abs(rev.growth_percentage ?? 0).toFixed(1)}%. Consider a flash sale.`, priority: 'critical', icon: AlertTriangle, action: 'Act Now' });
    if ((pay.failed ?? 0) > 0)
      warRoomAlerts.push({ title: `${pay.failed} Failed Payments`, description: `Success rate: ${(pay.success_rate ?? 0).toFixed(1)}%. Check Razorpay logs.`, priority: (pay.failed ?? 0) > 5 ? 'critical' : 'high', icon: CreditCard, action: 'View Details' });
    if ((ord.pending ?? 0) > 0)
      warRoomAlerts.push({ title: `${ord.pending} Pending Orders`, description: 'Orders awaiting payment. Monitor for stuck checkouts.', priority: 'medium', icon: Clock, action: 'Check Orders' });
  }
  if (inventory && (inventory.out_of_stock_count > 0 || inventory.low_stock_count > 0))
    warRoomAlerts.push({ title: `${inventory.out_of_stock_count + inventory.low_stock_count} Stock Issues`, description: `${inventory.out_of_stock_count} out, ${inventory.low_stock_count} low. Act now.`, priority: inventory.out_of_stock_count > 0 ? 'high' : 'medium', icon: Package, action: 'View Inventory' });
  if (recovery && recovery.abandoned_carts.length > 0)
    warRoomAlerts.push({ title: `${recovery.abandoned_carts.length} Abandoned Carts`, description: `₹${recovery.total_recoverable_amount.toLocaleString('en-IN')} recoverable.`, priority: 'medium', icon: ShoppingCart, action: 'Recover' });
  if (warRoomAlerts.length === 0)
    warRoomAlerts.push({ title: 'All Systems Healthy', description: 'No critical alerts. Business running smoothly.', priority: 'low', icon: Activity });

  const rev = insights?.revenue ?? {};
  const ord = insights?.orders ?? {};
  const pay = insights?.payments ?? {};
  const stor = storeData.summary;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200 mb-2">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered · RevenuePilot Day 3
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">AI Business Operations Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time intelligence · 14 AI-powered sections · Live MongoDB data</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            aiOnline === true ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            aiOnline === false ? 'bg-rose-50 border-rose-200 text-rose-700' :
            'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            {aiOnline === true ? <Wifi className="w-3.5 h-3.5" /> : aiOnline === false ? <WifiOff className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {aiOnline === true ? 'AI Online' : aiOnline === false ? 'AI Offline · Using Mock Data' : 'Connecting…'}
          </div>
          <span className="text-xs text-slate-400">Updated {lastRefresh.toLocaleTimeString()}</span>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={loadAll}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </motion.button>
        </div>
      </div>

      {/* AI offline banner */}
      <AnimatePresence>
        {aiOnline === false && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-amber-800 text-sm">AI service offline — dashboard showing mock data</p>
              <p className="text-xs text-amber-600 mt-0.5">Start AI: <code className="font-mono bg-amber-100 px-1 rounded">cd revenuepilot-ai && uvicorn app.main:app --port 8001</code></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 1. AI Copilot Hero ── */}
      <Section id="copilot" title="AI Merchant Copilot" icon={<Zap className="w-5 h-5" />} badge="LIVE" collapsible={false}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <AICopilotCard prompts={prompts} onSendMessage={handleAIResponse} className="h-full" />
          </div>
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Snapshot</p>
              {[
                { label: 'Today Revenue',  value: fmt(rev.today ?? 0),                             color: 'text-emerald-400' },
                { label: 'Growth',         value: pct(rev.growth_percentage ?? 0),                  color: (rev.growth_percentage ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Payment Rate',   value: `${(pay.success_rate ?? 0).toFixed(1)}%`,        color: (pay.success_rate ?? 95) >= 90 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Paid Orders',    value: String(ord.paid ?? stor?.paid_orders ?? 0),      color: 'text-indigo-300' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">{row.label}</span>
                  <span className={`text-sm font-extrabold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Quick Ask</p>
              <div className="flex flex-wrap gap-1.5">
                {prompts.slice(0, 6).map(p => (
                  <SuggestedPromptChip key={p.label} chip={p} onClick={q => setAiQuery(q)} disabled={false} />
                ))}
              </div>
              {aiQuery && <p className="text-xs text-slate-400 pt-2 mt-1">💬 Ask in the copilot above</p>}
            </div>
          </div>
        </div>
      </Section>

      {/* ── 2. AI Business Health Score (NEW) ── */}
      <Section id="health-score" title="AI Business Health Score" icon={<Heart className="w-5 h-5" />} badge="Out of 100">
        <AIHealthScore insights={insights} inventory={inventory} loading={loading.insights && loading.inventory} />
      </Section>

      {/* ── 3. Business Health Cards ── */}
      <Section id="health" title="Business Health KPIs" icon={<Activity className="w-5 h-5" />} badge="Today">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <BusinessHealthCard label="Revenue Today"    value={fmt(rev.today ?? 0)}                       icon={DollarSign} color="emerald" loading={loading.insights} index={0} trend={rev.growth_percentage !== undefined ? (rev.growth_percentage >= 0 ? 'up' : 'down') : undefined} trendValue={rev.growth_percentage !== undefined ? `${Math.abs(rev.growth_percentage).toFixed(1)}%` : undefined} />
          <BusinessHealthCard label="Orders Today"     value={ord.today ?? 0}                            icon={ShoppingBag} color="indigo" loading={loading.insights} index={1} />
          <BusinessHealthCard label="Payment Success"  value={`${(pay.success_rate ?? 0).toFixed(1)}%`} icon={CreditCard} color={(pay.success_rate ?? 95) >= 90 ? 'emerald' : 'rose'} loading={loading.insights} index={2} />
          <BusinessHealthCard label="Avg Order Value"  value={fmt(rev.average_order_value ?? 0)}         icon={TrendingUp} color="sky" loading={loading.insights} index={3} />
          <BusinessHealthCard label="Pending Orders"   value={ord.pending ?? stor?.pending_orders ?? 0}  icon={Clock} color="amber" loading={loading.insights} index={4} />
          <BusinessHealthCard label="Stock Alerts"     value={(inventory?.out_of_stock_count ?? 0) + (inventory?.low_stock_count ?? 0)} icon={Package} color={(inventory?.out_of_stock_count ?? 0) > 0 ? 'rose' : 'emerald'} loading={loading.inventory} index={5} subtext="products" />
        </div>
      </Section>

      {/* ── 4. Revenue Forecast (NEW) ── */}
      <Section id="forecast" title="Revenue Forecast" icon={<BarChart2 className="w-5 h-5" />} badge="AI Projected">
        <RevenueForecast insights={insights} weeklyInsights={weeklyInsights} loading={loading.insights || loading.weekly} />
      </Section>

      {/* ── 5. Revenue War Room ── */}
      <Section id="warroom" title="Revenue War Room ⭐" icon={<AlertTriangle className="w-5 h-5" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warRoomAlerts.map((alert, i) => (
            <WarRoomAlert key={alert.title + i} title={alert.title} description={alert.description}
              action={alert.action} priority={alert.priority} icon={alert.icon} index={i}
              onAction={alert.action ? () => {} : undefined} />
          ))}
        </div>
      </Section>

      {/* ── 6. AI Recovery Center (NEW) ── */}
      <Section id="recovery-center" title="AI Recovery Center" icon={<ShoppingCart className="w-5 h-5" />}
        badge={recovery ? `₹${recovery.total_recoverable_amount.toLocaleString('en-IN')} recoverable` : 'Recovery Ops'}>
        <AIRecoveryCenter recovery={recovery} loading={loading.recovery} />
      </Section>

      {/* ── 7. AI Price Optimization (NEW) ── */}
      <Section id="pricing" title="AI Price Optimization" icon={<Tag className="w-5 h-5" />} badge="AI Suggested">
        <AIPriceOptimization inventory={inventory} loading={loading.inventory} />
      </Section>

      {/* ── 8. Inventory Risk Heatmap (NEW) ── */}
      <Section id="inventory-risk" title="Inventory Risk Heatmap" icon={<Thermometer className="w-5 h-5" />}>
        <InventoryRiskHeatmap inventory={inventory} loading={loading.inventory} />
      </Section>

      {/* ── 9. AI Incident Center (NEW) ── */}
      <Section id="incidents" title="AI Incident Center" icon={<AlertCircle className="w-5 h-5" />} defaultOpen={false}>
        <AIIncidentCenter insights={insights} loading={loading.insights} />
      </Section>

      {/* ── 10. AI Recommendations ── */}
      <Section id="recommendations" title="AI Recommendations" icon={<Zap className="w-5 h-5" />} badge={`${recommendations.length} insights`} defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(recommendations.length > 0 ? recommendations : [
            '[HIGH] Payment success rate needs attention. Review Razorpay webhook and retry logic.',
            '[MEDIUM] Monitor revenue trends daily and compare week-over-week.',
            'Business metrics are within normal range. Continue monitoring.',
          ]).map((rec, i) => (
            <AIRecommendationCard key={i} recommendation={rec} index={i}
              onApply={(r) => { document.getElementById('copilot')?.scrollIntoView({ behavior: 'smooth' }); setAiQuery(r); }} />
          ))}
        </div>
      </Section>

      {/* ── 11. Merchant Timeline (NEW) ── */}
      <Section id="timeline" title="Merchant Timeline" icon={<Clock3 className="w-5 h-5" />} badge="Live Events" defaultOpen={false}>
        <MerchantTimeline insights={insights} inventory={inventory} recovery={recovery} loading={loading.insights} />
      </Section>

      {/* ── 12. Inventory Intelligence (charts) ── */}
      <Section id="inventory" title="Inventory Intelligence" icon={<Package className="w-5 h-5" />} defaultOpen={false}>
        <InventoryIntelligence inventory={inventory} loading={loading.inventory} />
      </Section>

      {/* ── 13. Recovery Table (original) ── */}
      <Section id="recovery-table" title="Recovery Messages Table" icon={<ShoppingCart className="w-5 h-5" />} badge="Copy-to-Clipboard" defaultOpen={false}>
        <RecoveryTable recovery={recovery} loading={loading.recovery} />
      </Section>

      {/* ── 14. Webhook Event Log (preserved from Day 1) ── */}
      <Section id="webhooks" title="Webhook Event Log (Razorpay Audit)" icon={<Database className="w-5 h-5" />} badge="Store API" defaultOpen={false}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-mono text-slate-400">GET /merchant/events</span>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">{storeData.events.length} events</span>
          </div>
        </div>
        {storeData.events.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No webhook events yet. Trigger Razorpay checkout to test.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">Event ID</th>
                  <th className="py-3 px-4 font-bold">Type</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {storeData.events.map(evt => (
                  <tr key={evt.event_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{evt.event_id}</td>
                    <td className="py-3 px-4 font-semibold text-indigo-600">{evt.event_type}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-sans font-bold rounded">Processed</span></td>
                    <td className="py-3 px-4 text-slate-500">{new Date(evt.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

    </div>
  );
};
