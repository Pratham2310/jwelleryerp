import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'info' | 'error' | 'gold' | 'default';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', ...props }) => {
  return (
    <span
      className={cn(
        "px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-mono tracking-wider uppercase inline-flex items-center justify-center transition-all duration-150",
        {
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40': variant === 'success',
          'bg-amber-50 text-[#8C6D34] border-[#C5A059]/35 dark:bg-[#C5A059]/10 dark:text-[#C5A059] dark:border-[#C5A059]/20': variant === 'gold' || variant === 'warning',
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40': variant === 'info',
          'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40': variant === 'error',
          'bg-slate-50 text-slate-700 border-slate-200 dark:bg-[#1A1A1D] dark:text-[#A1A1AA] dark:border-[#262626]': variant === 'default',
        },
        className
      )}
      {...props}
    />
  );
};
