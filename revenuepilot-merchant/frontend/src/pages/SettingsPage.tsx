import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Shield, Key, ExternalLink, Activity, CheckCircle, RefreshCw, Save, Database, Zap, ToggleLeft, ToggleRight } from 'lucide-react';
import { aiAPI, merchantAPI, automationAPI } from '../services/api';
import { merchantIntelAPI } from '../services/api';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [razorpayKey, setRazorpayKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [storeStatus, setStoreStatus] = useState<string>('Checking...');
  const [aiStatus, setAiStatus] = useState<string>('Checking...');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [demoLoading, setDemoLoading] = useState<boolean>(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  // Load persisted settings on mount
  useEffect(() => {
    merchantIntelAPI.loadSettings().then((res) => {
      const s = res.data;
      if (s?.razorpay_key_id) setRazorpayKey(s.razorpay_key_id);
      if (s?.webhook_secret) setWebhookSecret(s.webhook_secret);
    }).catch(() => {});

    automationAPI.getDemoStatus().then((res) => {
      if (res.data?.demo_mode !== undefined) setDemoMode(res.data.demo_mode);
    }).catch(() => {});
  }, []);

  const handleToggleDemoMode = async () => {
    setDemoLoading(true);
    setDemoMessage(null);
    try {
      const nextState = !demoMode;
      const res = await automationAPI.toggleDemoMode(nextState);
      setDemoMode(nextState);
      setDemoMessage(res.data?.message || `Demo Mode is now ${nextState ? 'ENABLED' : 'DISABLED'}.`);
      setTimeout(() => setDemoMessage(null), 3000);
    } catch (err) {
      console.error('Failed to toggle demo mode', err);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleQuickSeed = async () => {
    setDemoLoading(true);
    try {
      await automationAPI.generateDemoData();
      setDemoMessage('Generated 30-day realistic merchant dataset successfully!');
      toast.success('Demo data seeded!');
      setTimeout(() => setDemoMessage(null), 3000);
    } catch (err) {
      toast.error('Failed to seed demo data');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleQuickReset = async () => {
    setDemoLoading(true);
    try {
      await automationAPI.resetDemoStore();
      setDemoMessage('Demo database reset successfully.');
      toast.success('Demo data reset!');
      setTimeout(() => setDemoMessage(null), 3000);
    } catch (err) {
      toast.error('Failed to reset demo data');
    } finally {
      setDemoLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setTesting(true);
    setStoreStatus('Testing connection...');
    setAiStatus('Testing connection...');
    try {
      await merchantAPI.summary();
      setStoreStatus('Connected (HTTP 200 OK)');
    } catch {
      setStoreStatus('Error connecting to Store microservice');
    }
    try {
      await aiAPI.health();
      setAiStatus('Connected (HTTP 200 OK)');
    } catch {
      setAiStatus('Error connecting to AI microservice');
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await merchantIntelAPI.saveSettings({
        merchant_id: 'merch_default',
        razorpay_key_id: razorpayKey,
        webhook_secret: webhookSecret,
        contact_email: user?.email || 'jpnishath@gmail.com',
      });
      setSaved(true);
      toast.success('Settings saved to database!');
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">Merchant Portal Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Manage Demo Mode, Razorpay test credentials, API endpoints, and microservice status</p>
      </div>

      {/* FEATURE 11 — DEMO MODE TOGGLE CARD */}
      <div className="bg-[#111827] rounded-3xl border border-[#00F5A0]/30 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00F5A0]/10 text-[#00F5A0] border border-[#00F5A0]/30 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Demo Mode Engine (v2.7)</h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    demoMode
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {demoMode ? 'DEMO MODE ACTIVE' : 'LIVE PRODUCTION'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Serve 30-day realistic merchant dataset while AWS EventBridge, Lambda, SNS, S3, and CloudWatch remain fully functional.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleDemoMode}
            disabled={demoLoading}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              demoMode
                ? 'bg-[#00F5A0] text-slate-950 shadow-lg shadow-[#00F5A0]/20'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {demoMode ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {demoMode ? 'Demo Mode ON' : 'Demo Mode OFF'}
          </button>
        </div>

        {demoMessage && (
          <div className="p-3 bg-[#050816] rounded-xl border border-[#00F5A0]/30 text-xs text-[#00F5A0] font-mono flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {demoMessage}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400">Quick Data Operations:</span>
          <div className="flex gap-2">
            <button
              onClick={handleQuickSeed}
              disabled={demoLoading}
              className="px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold rounded-xl transition-all"
            >
              Seed 30-Day Dataset
            </button>
            <button
              onClick={handleQuickReset}
              disabled={demoLoading}
              className="px-3 py-1.5 bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-rose-400 text-xs font-bold rounded-xl transition-all"
            >
              Reset Demo Collections
            </button>
          </div>
        </div>
      </div>


      {/* Account Info */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3 border-b border-[#1E293B] pb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Merchant Account Information</h3>
            <p className="text-xs text-slate-500">Authenticated profile details</p>
          </div>
        </div>

        {[
          { label: 'Merchant Name', value: user?.name ?? 'RevenuePilot Merchant' },
          { label: 'Email Address', value: user?.email ?? 'merchant@revenuepilot.io' },
          { label: 'Role Access', value: user?.role?.toUpperCase() ?? 'ADMINISTRATOR' },
          { label: 'Store Microservice URL', value: import.meta.env.VITE_STORE_API_URL || 'http://localhost:8000' },
          { label: 'AI Analytics URL', value: import.meta.env.VITE_AI_API_URL || 'http://localhost:8001' },
        ].map((f) => (
          <div key={f.label} className="flex items-center justify-between py-2 border-b border-[#1E293B] last:border-0">
            <span className="text-xs font-bold text-slate-400">{f.label}</span>
            <span className="text-xs text-slate-200 font-mono font-semibold">{f.value}</span>
          </div>
        ))}
      </div>

      {/* Razorpay API Configuration */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3 border-b border-[#1E293B] pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Razorpay Test Gateway Credentials</h3>
            <p className="text-xs text-slate-500">HMAC Webhook & API authorization keys</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Razorpay Key ID</label>
            <input
              type="text"
              value={razorpayKey}
              onChange={(e) => setRazorpayKey(e.target.value)}
              className="w-full bg-[#161F30] border border-[#1E293B] rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Webhook SHA-256 Secret Signature</label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="w-full bg-[#161F30] border border-[#1E293B] rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Credentials'}
          </button>
        </div>
      </div>

      {/* System Diagnostics & Storefront Shortcuts */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Microservice Connectivity & Storefront</h3>
              <p className="text-xs text-slate-500">Live backend service diagnostics</p>
            </div>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={testing}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            Run Diagnostics
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center p-3 bg-[#161F30] rounded-xl border border-[#1E293B]">
            <span className="font-bold text-slate-300">RevenuePilot Store Service (Port 8000)</span>
            <span className="font-mono text-emerald-400 font-bold">{storeStatus}</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-[#161F30] rounded-xl border border-[#1E293B]">
            <span className="font-bold text-slate-300">RevenuePilot AI Copilot Service (Port 8001)</span>
            <span className="font-mono text-emerald-400 font-bold">{aiStatus}</span>
          </div>

          <div className="pt-2">
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
            >
              <ExternalLink className="w-4 h-4" /> Open RevenuePilot Storefront (localhost:5173)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
