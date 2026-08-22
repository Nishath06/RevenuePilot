import React from 'react';
import { useAuthStore } from '../store/authStore';
import { Zap, Shield, Settings as SettingsIcon } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-extrabold text-white">Settings</h1>
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Merchant Account</p>
            <p className="text-xs text-slate-500">Your account details</p>
          </div>
        </div>
        {[{ label: 'Name', value: user?.name ?? '—' }, { label: 'Email', value: user?.email ?? '—' }, { label: 'Role', value: user?.role?.toUpperCase() ?? 'MERCHANT' }, { label: 'Store API', value: import.meta.env.VITE_STORE_API_URL }, { label: 'AI API', value: import.meta.env.VITE_AI_API_URL }].map(f => (
          <div key={f.label} className="flex items-center justify-between py-3 border-b border-[#1E293B] last:border-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{f.label}</span>
            <span className="text-sm text-slate-300 font-mono">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
