import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#C5A059] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          {
            // Primary Elegant Dark Solid (Gold styled)
            'bg-[#C5A059] text-[#0A0A0B] hover:bg-[#D9B875] hover:shadow-lg hover:shadow-[#C5A059]/10 font-bold':
              variant === 'gold',
            // Default dark/grey slate button
            'bg-[#141416] text-[#E5E5E5] border border-[#262626] hover:bg-[#1A1A1D] hover:text-white':
              variant === 'primary',
            // Muted secondary action button
            'bg-[#1A1A1D] text-[#A1A1AA] hover:bg-[#262626] hover:text-[#E5E5E5]':
              variant === 'secondary',
            // Transparent border outline button
            'border border-[#262626] bg-transparent text-[#E5E5E5] hover:bg-[#141416] hover:border-[#C5A059]':
              variant === 'outline',
            // Completely transparent ghost button
            'text-[#71717A] hover:text-[#E5E5E5] hover:bg-[#141416]':
              variant === 'ghost',
            // Error/Destructive button
            'bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-900/20':
              variant === 'danger',
          },
          {
            'px-3 py-1.5 text-xs': size === 'sm',
            'px-4.5 py-2.5 text-xs': size === 'md',
            'px-6 py-3.5 text-sm': size === 'lg',
            'p-2': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
