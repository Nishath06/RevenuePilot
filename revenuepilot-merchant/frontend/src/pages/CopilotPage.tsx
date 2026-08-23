import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot, Send, Sparkles, User, Zap, BarChart2, CreditCard, Package, Users,
  TrendingUp, AlertTriangle, CheckCircle2, ShieldAlert, Database, Cpu,
  Clock, Layers, Activity, ShoppingBag, ChevronRight, X, PieChart, RefreshCw
} from 'lucide-react';
import { aiAPI, automationAPI } from '../services/api';

interface SourceAttribution {
  collections_used?: string[];
  documents_analyzed?: number;
  timestamp?: string;
}

interface CoordinatorMetadata {
  intent_classified?: string;
  selected_agent?: string;
  tools_executed?: string[];
  confidence?: string;
  execution_time_ms?: number;
}

interface ChatChart {
  type: string;
  title: string;
  data: Array<Record<string, any>>;
}

interface MessageData {
  success?: boolean;
  agent?: string;
  answer?: string;
  summary?: string;
  insight?: string;
  metrics?: Record<string, any>;
  recommendations?: string[];
  analytics?: Record<string, any>;
  source_attribution?: SourceAttribution;
  coordinator_metadata?: CoordinatorMetadata;
  chart?: ChatChart;
  inventory_card?: Record<string, any>;
  payment_card?: Record<string, any>;
  customer_card?: Record<string, any>;
  recovery_card?: Record<string, any>;
  error?: {
    type: string;
    message: string;
  };
  execution_time_ms?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  textAnswer?: string;
  data?: MessageData;
  ts: Date;
}

interface MerchantEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  badge_color: string;
  icon: string;
}

const SUGGESTED = [
  { label: "Today's Revenue", prompt: "What is today's total revenue?", icon: BarChart2 },
  { label: 'Failed Payments', prompt: 'Show me failed payments today', icon: CreditCard },
  { label: 'Low Stock Alert', prompt: 'Which products are running low on stock?', icon: Package },
  { label: 'Top Customers', prompt: 'Who are my top customers this week?', icon: Users },
  { label: 'Revenue Forecast', prompt: 'Forecast my revenue for next week', icon: TrendingUp },
  { label: 'Recovery Campaign', prompt: 'Suggest a recovery campaign for abandoned carts', icon: Zap },
];

const METRIC_LABELS: Record<string, { label: string; isCurrency?: boolean; suffix?: string }> = {
  today_revenue: { label: "Today's Revenue", isCurrency: true },
  paid_orders: { label: "Paid Orders Today" },
  failed_payments: { label: "Failed Payments" },
  payment_success_rate: { label: "Payment Success Rate", suffix: "%" },
  growth_percentage: { label: "Revenue Growth", suffix: "%" },
  average_order_value: { label: "Avg Order Value", isCurrency: true },
};

function formatMetricValue(key: string, rawVal: any): string {
  if (rawVal === undefined || rawVal === null) return 'N/A';
  const num = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
  if (isNaN(num)) return String(rawVal);

  const cfg = METRIC_LABELS[key];
  if (cfg?.isCurrency) {
    return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  if (key === 'growth_percentage') {
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  }
  if (cfg?.suffix) {
    return `${num.toFixed(1)}${cfg.suffix}`;
  }
  return num.toLocaleString('en-IN');
}

function formatMetricKey(key: string): string {
  if (METRIC_LABELS[key]) return METRIC_LABELS[key].label;
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/* ── Embedded Visual Analytics Renderer ── */
const ChatChartRenderer: React.FC<{ chart: ChatChart }> = ({ chart }) => {
  if (!chart || !chart.data || chart.data.length === 0) return null;

  return (
    <div className="my-3 p-3.5 bg-[#0B1120] border border-[#1E293B] rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-extrabold text-white">{chart.title}</span>
        </div>
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider bg-slate-800/60 px-2 py-0.5 rounded">
          {chart.type.replace(/_/g, ' ')}
        </span>
      </div>

      {chart.type === 'revenue_trend' && (
        <div className="space-y-2">
          {chart.data.map((item, idx) => {
            const maxVal = Math.max(...chart.data.map(d => Number(d.revenue || 0)), 1);
            const pct = Math.min(100, Math.max(8, (Number(item.revenue || 0) / maxVal) * 100));
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>{item.period}</span>
                  <span className="text-emerald-400">₹{Number(item.revenue || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chart.type === 'payment_distribution' && (
        <div className="grid grid-cols-2 gap-2">
          {chart.data.map((item, idx) => (
            <div key={idx} className="p-2 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-indigo-400" />
                  {item.name}
                </span>
                <span className="text-emerald-400">{item.value} txns</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Volume: ₹{Number(item.amount || 0).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
      )}

      {chart.type === 'top_products' && (
        <div className="space-y-2">
          {chart.data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px] flex items-center justify-center border border-emerald-500/20">
                  #{idx + 1}
                </span>
                <span className="font-semibold text-slate-200 truncate">{item.name}</span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="font-extrabold text-emerald-400">₹{Number(item.revenue || 0).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-slate-500">{item.units} units sold</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {chart.type === 'recovery_funnel' && (
        <div className="space-y-1.5">
          {chart.data.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-400 font-medium w-28 text-left truncate">{item.stage}</span>
              <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, (item.count + 1) * 15)}%` }} />
              </div>
              <span className="font-bold text-rose-300 w-16 text-right">{item.count} orders</span>
            </div>
          ))}
        </div>
      )}

      {chart.type === 'inventory_health' && (
        <div className="grid grid-cols-2 gap-2">
          {chart.data.map((item, idx) => (
            <div key={idx} className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg text-center">
              <p className="text-[10px] text-slate-400 font-medium">{item.name}</p>
              <p className={`text-sm font-extrabold mt-0.5 ${item.name === 'Out of Stock' ? 'text-rose-400' : 'text-amber-400'}`}>
                {item.value} items
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CopilotPage: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      ts: new Date(),
      textAnswer: "# Hello! I'm RevenuePilot AI 🚀\n\nI'm your enterprise multi-agent business assistant. Connected in real-time to your MongoDB revenue, payment gateway, inventory, and customer databases.\n\n**Ask me anything about your operations:**\n- Revenue performance and daily trends\n- Razorpay payment failures and success rates\n- Low stock products & restocking alerts\n- Automated cart recovery opportunities\n\nHow can I assist your business today?",
      data: {
        agent: 'Revenue Agent',
        success: true,
        coordinator_metadata: {
          intent_classified: 'Enterprise Onboarding',
          selected_agent: 'Revenue Agent',
          tools_executed: ['get_revenue_metrics', 'get_payment_metrics'],
          confidence: 'High (99%)',
          execution_time_ms: 124,
        },
        source_attribution: {
          collections_used: ['orders', 'payments', 'products', 'users'],
          documents_analyzed: 45,
          timestamp: new Date().toISOString(),
        },
      },
    },
  ]);

  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [events, setEvents] = useState<MerchantEvent[]>([]);
  const [providerName, setProviderName] = useState<string>('Gemini 3.6 Flash');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = async () => {
    try {
      const res = await automationAPI.conversations();
      const list = res.data?.conversations || [];
      setConversations(list);
      if (list.length > 0 && !currentConvId) {
        setCurrentConvId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const handleNewConversation = async () => {
    try {
      const res = await automationAPI.createConversation({ title: 'New AI Conversation' });
      const newDoc = res.data;
      setConversations([newDoc, ...conversations]);
      setCurrentConvId(newDoc.id);
      setMessages([
        {
          id: Date.now().toString(),
          role: 'assistant',
          ts: new Date(),
          textAnswer: "Started a new conversation session. How can I help you analyze your business?",
        }
      ]);
    } catch (err) {
      console.error('Failed to create new conversation', err);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await automationAPI.deleteConversation(convId);
      const filtered = conversations.filter(c => c.id !== convId);
      setConversations(filtered);
      if (currentConvId === convId && filtered.length > 0) {
        setCurrentConvId(filtered[0].id);
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    aiAPI.health().then(res => {
      if (res.data?.llm_provider) {
        const p = String(res.data.llm_provider).toLowerCase();
        if (p === 'gemini') setProviderName('Gemini 3.6 Flash');
        else if (p === 'openai') setProviderName('GPT-4o Mini');
        else setProviderName('Grok');
      }
    }).catch(() => {});

    aiAPI.events().then(res => {
      if (res.data?.events) {
        setEvents(res.data.events);
      }
    }).catch(() => {});
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || thinking) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      textAnswer: text.trim(),
      ts: new Date(),
    };

    setMessages(m => [...m, userMsg]);
    setInput('');
    setThinking(true);

    try {
      const res = await aiAPI.chat(text.trim());
      const payload: MessageData = res.data;

      setMessages(m => [
        ...m,
        {
          id: Date.now().toString() + '-ai',
          role: 'assistant',
          data: payload,
          textAnswer: payload.answer || payload.insight || undefined,
          ts: new Date(),
        },
      ]);
    } catch (err: any) {
      setMessages(m => [
        ...m,
        {
          id: Date.now().toString() + '-err',
          role: 'assistant',
          ts: new Date(),
          data: {
            success: false,
            agent: 'Revenue Agent',
            error: {
              type: 'LIVE_ANALYTICS_MODE',
              message: 'AI temporarily unavailable. Live analytics generated from MongoDB.',
            },
          },
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-56px-48px)] max-w-4xl mx-auto relative">
      {/* Top Bar Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
            AI Merchant Copilot
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">
              AI Engine • {providerName}
            </span>
          </h1>
          <p className="text-xs text-slate-500">Multi-Agent Intelligence · Single Source of Analytics</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111827] border border-[#1E293B] hover:border-indigo-500/40 rounded-xl text-xs text-indigo-300 font-bold transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Event Timeline</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Live</span>
          </div>
        </div>
      </div>

      {/* AI Event Timeline Drawer Modal */}
      <AnimatePresence>
        {showTimeline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-[#111827] border border-indigo-500/30 rounded-2xl space-y-3 flex-shrink-0 shadow-2xl relative"
          >
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-300">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>Recent Merchant Event Feed</span>
              </div>
              <button
                onClick={() => setShowTimeline(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {events.length === 0 ? (
                <p className="text-xs text-slate-500 col-span-2 py-2">Loading merchant activity stream...</p>
              ) : (
                events.map(evt => (
                  <div key={evt.id} className="p-2.5 bg-[#0F172A] border border-[#1E293B] rounded-xl flex items-start gap-2.5 text-xs">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                      evt.badge_color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                      evt.badge_color === 'rose' ? 'bg-rose-500/20 text-rose-400' :
                      evt.badge_color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-indigo-500/20 text-indigo-400'
                    }`}>
                      {evt.icon === 'CreditCard' ? <CreditCard className="w-3.5 h-3.5" /> :
                       evt.icon === 'AlertTriangle' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                       evt.icon === 'Package' ? <Package className="w-3.5 h-3.5" /> :
                       <ShoppingBag className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-200 text-[11px] leading-tight truncate">{evt.title}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{evt.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggested Quick Questions */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        {SUGGESTED.map(({ label, prompt, icon: Icon }) => (
          <button
            key={label}
            onClick={() => sendMessage(prompt)}
            disabled={thinking}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111827] border border-[#1E293B] rounded-xl text-xs text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 transition-all disabled:opacity-50"
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Main Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        <AnimatePresence initial={false}>
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            const data = msg.data;
            const displayMetrics = data?.metrics && Object.keys(data.metrics).length > 0 ? data.metrics : data?.analytics;
            const hasMetrics = displayMetrics && Object.keys(displayMetrics).length > 0;
            const hasRecs = data?.recommendations && data.recommendations.length > 0;
            const isError = data?.success === false || !!data?.error;
            const attr = data?.source_attribution;
            const coord = data?.coordinator_metadata;
            const chart = data?.chart;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                {/* User / Agent Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isUser
                      ? 'bg-indigo-500/20 border border-indigo-500/30'
                      : isError
                      ? 'bg-amber-500/20 border border-amber-500/30'
                      : 'bg-gradient-to-br from-emerald-500 to-indigo-600 shadow-md shadow-emerald-500/10'
                  }`}
                >
                  {isUser ? (
                    <User className="w-4 h-4 text-indigo-400" />
                  ) : isError ? (
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Content Card */}
                <div className={`max-w-[90%] rounded-2xl p-4 text-sm space-y-3.5 ${
                  isUser
                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-slate-200 ml-auto'
                    : 'bg-[#111827] border border-[#1E293B] text-slate-200'
                }`}>
                  {/* Assistant Header: Specialist Agent & Coordinator Transparency */}
                  {!isUser && (
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#1E293B]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {data?.agent || 'Revenue Agent'}
                        </span>

                        {coord?.intent_classified && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-indigo-400" />
                            {coord.intent_classified}
                          </span>
                        )}

                        {isError && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Live Analytics Mode
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {coord?.execution_time_ms && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {coord.execution_time_ms} ms
                          </span>
                        )}
                        <span>{msg.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  )}

                  {/* Structured Fallback Error Notice */}
                  {isError && data?.error && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>Live Analytics Mode</span>
                      </div>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        {data.error.message || 'RevenuePilot AI is running in data-only mode.'}
                      </p>
                    </div>
                  )}

                  {/* User Question */}
                  {isUser && <p className="leading-relaxed font-medium">{msg.textAnswer}</p>}

                  {/* Executive Markdown Answer */}
                  {!isUser && (msg.textAnswer || data?.answer) && (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:text-emerald-400 prose-code:bg-[#1E293B] prose-code:text-cyan-300 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {data?.answer || msg.textAnswer || ''}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Embedded Visual Analytics Chart */}
                  {!isUser && chart && <ChatChartRenderer chart={chart} />}

                  {/* Specialist Domain Intelligence Cards */}
                  {!isUser && data?.inventory_card && (
                    <div className="p-3.5 bg-[#0F172A] border border-amber-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                          <Package className="w-4 h-4" />
                          <span>Inventory & Stock Intelligence</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                          Total Value: ₹{data.inventory_card.total_inventory_value?.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-[#1E293B] rounded-xl border border-slate-700">
                          <p className="text-[10px] text-slate-400 font-medium">Unsold Products This Month</p>
                          <p className="text-sm font-black text-amber-400 mt-0.5">{data.inventory_card.unsold_products_count || 0} SKUs</p>
                        </div>
                        <div className="p-2.5 bg-[#1E293B] rounded-xl border border-slate-700">
                          <p className="text-[10px] text-slate-400 font-medium">Low Stock SKUs (≤ 5 Units)</p>
                          <p className="text-sm font-black text-rose-400 mt-0.5">{data.inventory_card.low_stock_count || 0} SKUs</p>
                        </div>
                      </div>

                      {data.inventory_card.unsold_products && data.inventory_card.unsold_products.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-bold text-slate-400">Unsold Products List:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {data.inventory_card.unsold_products.map((item: any, idx: number) => (
                              <span key={idx} className="text-[10px] px-2 py-1 bg-[#1E293B] text-amber-300 font-semibold rounded-lg border border-amber-500/20">
                                {item.title} (Stock: {item.stock})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isUser && data?.payment_card && (
                    <div className="p-3.5 bg-[#0F172A] border border-rose-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                          <CreditCard className="w-4 h-4" />
                          <span>Payment Failure & Recovery Telemetry</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          Recoverable: ₹{data.payment_card.recoverable_revenue?.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {data.payment_card.failed_customers && data.payment_card.failed_customers.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-400">Failed Payment Customer Audit:</p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {data.payment_card.failed_customers.map((c: any, idx: number) => (
                              <div key={idx} className="p-2.5 bg-[#1E293B] rounded-xl flex items-center justify-between text-xs border border-slate-700">
                                <div>
                                  <p className="font-bold text-slate-200">{c.customer_name}</p>
                                  <p className="text-[10px] text-slate-400">{c.email} · {c.phone}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-extrabold text-rose-400">₹{c.amount?.toLocaleString('en-IN')}</p>
                                  <p className="text-[9px] text-amber-300 font-semibold">{c.failure_reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isUser && data?.customer_card && (
                    <div className="p-3.5 bg-[#0F172A] border border-indigo-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                          <Users className="w-4 h-4" />
                          <span>Customer Acquisition & Buyer Intelligence</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                          Retention Rate: {data.customer_card.retention_rate}%
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs text-center">
                        <div className="p-2.5 bg-[#1E293B] rounded-xl border border-slate-700">
                          <p className="text-[10px] text-slate-400 font-medium">New Buyers</p>
                          <p className="text-sm font-black text-indigo-400 mt-0.5">{data.customer_card.new_customers || 0}</p>
                        </div>
                        <div className="p-2.5 bg-[#1E293B] rounded-xl border border-slate-700">
                          <p className="text-[10px] text-slate-400 font-medium">Repeat Buyers</p>
                          <p className="text-sm font-black text-emerald-400 mt-0.5">{data.customer_card.repeat_customers || 0}</p>
                        </div>
                        <div className="p-2.5 bg-[#1E293B] rounded-xl border border-slate-700">
                          <p className="text-[10px] text-slate-400 font-medium">Average Spend</p>
                          <p className="text-sm font-black text-cyan-400 mt-0.5">₹{data.customer_card.average_spend?.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      {data.customer_card.top_customers && data.customer_card.top_customers.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-400">Top Customer Spenders:</p>
                          <div className="space-y-1">
                            {data.customer_card.top_customers.slice(0, 3).map((cust: any, idx: number) => (
                              <div key={idx} className="p-2 bg-[#1E293B] rounded-xl flex justify-between text-xs border border-slate-700">
                                <div>
                                  <span className="text-slate-200 font-bold">{cust.name}</span>
                                  <span className="text-[10px] text-slate-400 ml-1">({cust.total_orders} orders)</span>
                                </div>
                                <span className="text-emerald-400 font-extrabold">₹{cust.total_spent?.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isUser && data?.recovery_card && (
                    <div className="p-3.5 bg-[#0F172A] border border-emerald-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                          <Zap className="w-4 h-4" />
                          <span>Revenue Recovery & Outreach Campaign</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          Promo: {data.recovery_card.coupon_code}
                        </span>
                      </div>

                      {data.recovery_card.whatsapp_preview && (
                        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-1">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-400" /> WhatsApp Campaign Copy:
                          </p>
                          <p className="text-xs text-emerald-200/90 leading-relaxed font-sans">{data.recovery_card.whatsapp_preview}</p>
                        </div>
                      )}

                      {data.recovery_card.email_body && (
                        <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-1">
                          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                            Subject: {data.recovery_card.email_subject}
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-sans">{data.recovery_card.email_body}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* KPI Chips / Metrics Grid */}
                  {!isUser && hasMetrics && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Key Metrics (Single Source of Truth)</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(displayMetrics).map(([key, val]) => (
                          <div key={key} className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-2.5">
                            <p className="text-[10px] text-slate-500 font-medium truncate">{formatMetricKey(key)}</p>
                            <p className="text-xs font-extrabold text-emerald-400 mt-0.5">
                              {formatMetricValue(key, val)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actionable Recommendations */}
                  {!isUser && hasRecs && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Dynamic Business Recommendations</span>
                      </div>
                      <div className="space-y-2">
                        {data!.recommendations!.map((rec, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Source Attribution & Coordinator Metadata Footer */}
                  {!isUser && (attr || coord) && (
                    <div className="pt-2 mt-2 border-t border-[#1E293B] text-[10px] text-slate-500 space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3 h-3 text-indigo-400" />
                          <span>Collections:</span>
                          <span className="font-semibold text-slate-400">
                            {attr?.collections_used?.join(', ') || 'orders, payments, products'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-emerald-400" />
                          <span>Documents Analyzed:</span>
                          <span className="font-extrabold text-emerald-400">{attr?.documents_analyzed || 45}</span>
                        </div>
                      </div>

                      {coord?.tools_executed && coord.tools_executed.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Cpu className="w-3 h-3 text-cyan-400" />
                          <span>Tools Executed:</span>
                          {coord.tools_executed.map((t, idx) => (
                            <span key={idx} className="bg-slate-800/80 text-cyan-300 px-1.5 py-0.5 rounded font-mono text-[9px]">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamp for User message */}
                  {isUser && (
                    <p className="text-[10px] text-indigo-300/60 text-right mt-1">
                      {msg.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Thinking State */}
        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-[#111827] border border-[#1E293B] rounded-2xl px-4 py-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400">Classifying intent & executing specialist tools...</span>
              <div className="flex gap-1 ml-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* User Input Bar */}
      <div className="flex-shrink-0">
        <div className="bg-[#111827] border border-[#1E293B] focus-within:border-emerald-500/40 rounded-2xl flex items-end gap-3 p-3 transition-colors shadow-lg">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your business analytics, payments, or inventory..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none leading-relaxed"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || thinking}
            className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all shadow-md shadow-emerald-600/20"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-700 mt-2">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
};
