/**
 * AICopilotCard — Hero AI chat assistant with conversation history,
 * prompt chips, loading animation, and auto-scroll.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Sparkles, Bot, User, RefreshCw, AlertTriangle } from 'lucide-react';
import { merchantAIService, ChatResponse, PromptChip } from '../../services/merchantAI.service';
import { SuggestedPromptChip } from './SuggestedPromptChip';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  metrics?: Record<string, number | string>;
  recommendations?: string[];
  timestamp: Date;
  isError?: boolean;
}

interface Props {
  prompts: PromptChip[];
  onSendMessage?: (query: string, response: ChatResponse) => void;
  className?: string;
}

const FALLBACK_PROMPTS: PromptChip[] = [
  { label: "Today's Revenue", query: "What is today's revenue?",      category: 'Revenue',   icon: '💰' },
  { label: 'Weekly Sales',    query: "Show this week's sales.",       category: 'Revenue',   icon: '📈' },
  { label: 'Failed Payments', query: "How many payments failed?",     category: 'Payments',  icon: '❌' },
  { label: 'Low Stock',       query: "Which products are low stock?", category: 'Inventory', icon: '⚠️' },
  { label: 'Top Customers',   query: "Who are my top customers?",     category: 'Customers', icon: '👑' },
  { label: 'Recovery',        query: "What are my recovery opportunities?", category: 'Recovery', icon: '🛒' },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const AICopilotCard: React.FC<Props> = ({ prompts, onSendMessage, className = '' }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayedPrompts = prompts.length > 0 ? prompts : FALLBACK_PROMPTS;

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    setError(null);
    const userMsg: Message = { id: uid(), role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await merchantAIService.askAI(text.trim());
      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: response.answer,
        agent: response.agent,
        metrics: response.metrics,
        recommendations: response.recommendations,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onSendMessage?.(text.trim(), response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI service unavailable';
      const errMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: `⚠️ Unable to reach RevenuePilot AI. Make sure the service is running on port 8001.\n\nError: ${msg}`,
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
      setError(msg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className={`bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-lg leading-tight">RevenuePilot AI</h2>
              <p className="text-emerald-100 text-xs">Your AI Business Analyst · Live MongoDB data</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-white text-xs font-semibold">Online</span>
          </div>
        </div>
      </div>

      {/* Prompt chips */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Quick Questions</p>
        <div className="flex flex-wrap gap-1.5">
          {displayedPrompts.slice(0, 8).map((chip) => (
            <SuggestedPromptChip
              key={chip.label}
              chip={chip}
              onClick={sendMessage}
              disabled={loading}
            />
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[320px] max-h-[440px] overflow-y-auto px-5 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full py-10 text-center space-y-3"
          >
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-bold text-slate-700">Ask me anything about your business</p>
            <p className="text-xs text-slate-400 max-w-xs">
              I have access to your live revenue, payments, inventory, and customer data.
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                msg.role === 'user'
                  ? 'bg-indigo-100 text-indigo-600'
                  : msg.isError
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Agent label */}
                {msg.agent && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    {msg.agent}
                  </span>
                )}

                {/* Bubble */}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : msg.isError
                    ? 'bg-rose-50 border border-rose-200 text-rose-800 rounded-tl-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>

                {/* Inline metrics */}
                {msg.metrics && Object.keys(msg.metrics).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Object.entries(msg.metrics).slice(0, 4).map(([k, v]) => (
                      <span key={k} className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-mono font-bold">
                        {k.replace(/_/g, ' ')}: {typeof v === 'number' ? v.toLocaleString('en-IN') : v}
                      </span>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="w-full mt-1 space-y-1">
                    {msg.recommendations.slice(0, 2).map((rec, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                        <span className="mt-0.5 flex-shrink-0">💡</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-slate-300 px-1">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-emerald-500"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 py-2 bg-rose-50 border-t border-rose-200 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">AI service unreachable. Start revenuepilot-ai on port 8001.</p>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-5 py-4 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask RevenuePilot AI…"
              disabled={loading}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all disabled:opacity-50"
            />
          </div>

          {/* Voice placeholder */}
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors flex-shrink-0"
            title="Voice input (coming soon)"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Send */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </motion.button>
        </div>

        <p className="text-[10px] text-slate-300 mt-2 text-center">
          Powered by RevenuePilot AI · Live MongoDB data · GPT-4o mini
        </p>
      </div>
    </div>
  );
};
