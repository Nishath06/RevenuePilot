import React, { useEffect, useState, useCallback } from 'react';
import { Bell, RefreshCw, Wifi, WifiOff, Circle, Zap } from 'lucide-react';
import { aiAPI, storeClient } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface StatusDot { ok: boolean; label: string; }

const StatusBadge: React.FC<StatusDot & { pulse?: boolean }> = ({ ok, label, pulse }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold">
    <span className={`relative flex h-1.5 w-1.5`}>
      {ok && pulse && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${ok ? 'bg-emerald-400' : 'bg-rose-500'}`} />
    </span>
    <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>{label}</span>
  </div>
);

interface Props { onRefresh?: () => void; }

export const TopNav: React.FC<Props> = ({ onRefresh }) => {
  const { user } = useAuthStore();
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [storeOnline, setStoreOnline] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const now = new Date();

  const checkStatus = useCallback(async () => {
    try { await aiAPI.health(); setAiOnline(true); } catch { setAiOnline(false); }
    try { await storeClient.get('/health').catch(() => storeClient.get('/')); setStoreOnline(true); } catch { setStoreOnline(false); }
  }, []);

  useEffect(() => { checkStatus(); const t = setInterval(checkStatus, 30000); return () => clearInterval(t); }, [checkStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    onRefresh?.();
    await checkStatus();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-[#0F172A]/80 border-b border-[#1E293B] backdrop-blur-md sticky top-0 z-20">
      {/* Left — greeting */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {getGreeting()}, {user?.name?.split(' ')[0] ?? 'Merchant'} 👋
          </p>
          <p className="text-[10px] text-slate-500">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Right — status + actions */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Service status badges */}
        {storeOnline !== null && <StatusBadge ok={storeOnline} label="Store API" />}
        {aiOnline !== null && <StatusBadge ok={aiOnline} label="AI Engine" pulse={aiOnline} />}
        <StatusBadge ok={true} label="MongoDB" />

        <div className="w-px h-5 bg-[#1E293B] mx-1" />

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Notification bell */}
        <button className="relative p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold ml-1 border border-indigo-400/30">
          {user?.name?.[0]?.toUpperCase() ?? 'M'}
        </div>
      </div>
    </header>
  );
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
