import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Bot, BarChart2, ShoppingBag, CreditCard, Package,
  Users, TrendingUp, AlertCircle, Webhook, Settings, LogOut,
  ChevronLeft, ChevronRight, Zap, FileText,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/automation', label: 'Automation Center', icon: Zap },
  { to: '/copilot',    label: 'AI Copilot',         icon: Bot },
  { to: '/reports',    label: 'Reports Center',     icon: FileText },
  { to: '/revenue',    label: 'Revenue',            icon: BarChart2 },
  { to: '/orders',     label: 'Orders',             icon: ShoppingBag },
  { to: '/payments',   label: 'Payments',           icon: CreditCard },
  { to: '/inventory',  label: 'Inventory',          icon: Package },
  { to: '/recovery',   label: 'Recovery',           icon: Zap },
  { to: '/customers',  label: 'Customers',          icon: Users },
  { to: '/forecast',   label: 'Forecasting',        icon: TrendingUp },
  { to: '/incidents',  label: 'Incidents',          icon: AlertCircle },
  { to: '/webhooks',   label: 'Webhooks',           icon: Webhook },
  { to: '/settings',   label: 'Settings',           icon: Settings },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="sticky top-0 h-screen flex flex-col bg-[#0F172A] border-r border-[#1E293B] flex-shrink-0 overflow-hidden z-30"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#1E293B] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden">
              <p className="text-sm font-bold text-white whitespace-nowrap">RevenuePilot</p>
              <p className="text-[10px] text-emerald-400 font-semibold tracking-widest uppercase whitespace-nowrap">Merchant</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium group relative ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebarActive"
                    className="absolute inset-0 bg-emerald-500/10 rounded-xl border border-emerald-500/20"
                    transition={{ duration: 0.15 }}
                  />
                )}
                <Icon className={`w-4 h-4 flex-shrink-0 relative z-10 ${isActive ? 'text-emerald-400' : ''}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="whitespace-nowrap relative z-10"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-14 bg-[#1E293B] text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity border border-[#334155]">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-[#1E293B] p-3 space-y-2 flex-shrink-0">
        {/* User info */}
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() ?? 'M'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.name ?? 'Merchant'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="sidebar-item flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="sidebar-item flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 flex-shrink-0" /> : <ChevronLeft className="w-4 h-4 flex-shrink-0" />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
};
