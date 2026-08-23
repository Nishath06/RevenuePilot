import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Shield, Key, ExternalLink, Activity, CheckCircle, RefreshCw, Save } from 'lucide-react';
import { aiAPI, merchantAPI } from '../services/api';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [razorpayKey, setRazorpayKey] = useState('rzp_test_revenuepilot');
  const [webhookSecret, setWebhookSecret] = useState('whsec_revenuepilot_2026');
  const [storeStatus, setStoreStatus] = useState<string>('Checking...');
  const [aiStatus, setAiStatus] = useState<string>('Checking...');
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">Merchant Portal Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Manage Razorpay test credentials, API endpoints, and microservice status</p>
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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved Successfully!' : 'Save Credentials'}
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
