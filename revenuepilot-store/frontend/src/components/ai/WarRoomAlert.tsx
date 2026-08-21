/**
 * WarRoomAlert — Priority alert card for the Revenue War Room
 */
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Zap } from 'lucide-react';

type Priority = 'critical' | 'high' | 'medium' | 'low';

interface Props {
  title: string;
  description: string;
  action?: string;
  priority: Priority;
  icon: LucideIcon;
  onAction?: () => void;
  index?: number;
}

const priorityConfig: Record<Priority, {
  border: string; badge: string; badgeText: string; pulse: string;
}> = {
  critical: { border: 'border-rose-300',   badge: 'bg-rose-100   text-rose-700   border-rose-300',   badgeText: '🔴 CRITICAL', pulse: 'bg-rose-400'   },
  high:     { border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700 border-orange-300', badgeText: '🟠 HIGH',     pulse: 'bg-orange-400' },
  medium:   { border: 'border-amber-300',  badge: 'bg-amber-100  text-amber-700  border-amber-300',  badgeText: '🟡 MEDIUM',   pulse: 'bg-amber-400'  },
  low:      { border: 'border-sky-300',    badge: 'bg-sky-100    text-sky-700    border-sky-300',    badgeText: '🔵 INFO',     pulse: 'bg-sky-400'    },
};

export const WarRoomAlert: React.FC<Props> = ({
  title, description, action, priority, icon: Icon, onAction, index = 0,
}) => {
  const cfg = priorityConfig[priority];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className={`bg-white rounded-2xl border-2 ${cfg.border} p-4 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start gap-3">
        {/* Pulse dot */}
        <div className="relative mt-1 flex-shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${cfg.pulse}`} />
          {(priority === 'critical' || priority === 'high') && (
            <div className={`absolute inset-0 rounded-full ${cfg.pulse} opacity-50 animate-ping`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Icon className="w-4 h-4 text-slate-600 flex-shrink-0" />
            <span className="font-bold text-sm text-slate-800">{title}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
              {cfg.badgeText}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>

          {action && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAction}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Zap className="w-3 h-3" />
              {action}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
