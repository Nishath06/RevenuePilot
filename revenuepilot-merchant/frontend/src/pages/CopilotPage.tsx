import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Send, Sparkles, User, Zap, BarChart2, CreditCard, Package, Users, TrendingUp } from 'lucide-react';
import { aiAPI } from '../services/api';

interface Message { id: string; role: 'user' | 'assistant'; content: string; ts: Date; }

const SUGGESTED = [
  { label: "Today's Revenue",    prompt: "What is today's total revenue?",       icon: BarChart2 },
  { label: 'Failed Payments',    prompt: 'Show me failed payments today',         icon: CreditCard },
  { label: 'Low Stock Alert',    prompt: 'Which products are running low on stock?', icon: Package },
  { label: 'Top Customers',      prompt: 'Who are my top customers this week?',   icon: Users },
  { label: 'Revenue Forecast',   prompt: 'Forecast my revenue for next week',     icon: TrendingUp },
  { label: 'Recovery Campaign',  prompt: 'Suggest a recovery campaign for abandoned carts', icon: Zap },
];

export const CopilotPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0', role: 'assistant', ts: new Date(),
    content: "# Hello! I'm RevenuePilot AI 🚀\n\nI'm your intelligent business analyst. I have real-time access to your revenue, payments, inventory, and customer data.\n\n**Ask me anything about your business:**\n- Revenue trends and forecasts\n- Payment failures and recovery\n- Inventory health\n- Customer insights\n\nHow can I help you today?",
  }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || thinking) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim(), ts: new Date() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setThinking(true);
    try {
      const res = await aiAPI.chat(text.trim());
      const data = res.data;
      const content = data.response ?? data.message ?? JSON.stringify(data);
      setMessages(m => [...m, { id: Date.now().toString() + 'ai', role: 'assistant', content, ts: new Date() }]);
    } catch (err: any) {
      setMessages(m => [...m, {
        id: Date.now().toString() + 'err', role: 'assistant', ts: new Date(),
        content: '⚠️ AI service is currently offline. Start it with:\n```\ncd revenuepilot-ai && uvicorn app.main:app --port 8001\n```',
      }]);
    } finally {
      setThinking(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-56px-48px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-white">AI Merchant Copilot</h1>
          <p className="text-xs text-slate-500">Connected to live MongoDB data · GPT-4o-mini</p>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400">AI Active</span>
        </div>
      </div>

      {/* Suggested prompts */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.role === 'assistant' ? 'bg-gradient-to-br from-emerald-500 to-indigo-600' : 'bg-indigo-500/20 border border-indigo-500/30'
              }`}>
                {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-indigo-400" />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600/20 border border-indigo-500/30 text-slate-200 ml-auto'
                  : 'bg-[#111827] border border-[#1E293B] text-slate-200'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:text-emerald-400 prose-code:bg-[#1E293B] prose-code:text-cyan-300 prose-code:px-1 prose-code:rounded">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
                <p className="text-[10px] text-slate-600 mt-1.5">
                  {msg.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-[#111827] border border-[#1E293B] rounded-2xl px-4 py-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400">Analyzing your business data</span>
              <div className="flex gap-1 ml-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        <div className="bg-[#111827] border border-[#1E293B] focus-within:border-emerald-500/40 rounded-2xl flex items-end gap-3 p-3 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your business..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none leading-relaxed"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || thinking}
            className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-700 mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
};
