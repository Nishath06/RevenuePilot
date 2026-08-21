/**
 * SuggestedPromptChip — Clickable AI prompt button
 */
import React from 'react';
import { motion } from 'framer-motion';
import { PromptChip } from '../../services/merchantAI.service';

interface Props {
  chip: PromptChip;
  onClick: (query: string) => void;
  disabled?: boolean;
}

const categoryColors: Record<string, string> = {
  Revenue:   'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  Payments:  'bg-rose-50   border-rose-200   text-rose-700   hover:bg-rose-100',
  Inventory: 'bg-amber-50  border-amber-200  text-amber-700  hover:bg-amber-100',
  Recovery:  'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
  Customers: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
  Insights:  'bg-sky-50    border-sky-200    text-sky-700    hover:bg-sky-100',
};

export const SuggestedPromptChip: React.FC<Props> = ({ chip, onClick, disabled }) => {
  const colorClass = categoryColors[chip.category] ?? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.04 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      onClick={() => !disabled && onClick(chip.query)}
      disabled={disabled}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold
        transition-colors duration-150 cursor-pointer select-none whitespace-nowrap
        disabled:opacity-40 disabled:cursor-not-allowed
        ${colorClass}
      `}
    >
      <span>{chip.icon}</span>
      <span>{chip.label}</span>
    </motion.button>
  );
};
