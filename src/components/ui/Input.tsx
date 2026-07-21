import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, icon, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label className="block text-[10px] uppercase font-bold font-mono tracking-widest text-[#71717A]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-[#71717A] pointer-events-none select-none">
              {icon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              "w-full text-xs rounded-xl border border-[#262626] bg-[#141416] text-white placeholder-[#71717A] transition-all duration-200 focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]",
              icon ? "pl-10 pr-4" : "px-3.5",
              "py-2.5",
              error && "border-red-500 focus:border-red-500 focus:ring-red-500",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-[10px] text-red-400 font-mono font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
