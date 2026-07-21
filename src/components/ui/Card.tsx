import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hoverable = false, ...props }) => {
  return (
    <div
      className={cn(
        "bg-[#141416] border border-[#262626] rounded-2xl p-5 shadow-md transition-all duration-200",
        hoverable && "hover:border-[#C5A059]/40 hover:shadow-lg hover:shadow-[#C5A059]/5 cursor-pointer",
        className
      )}
      {...props}
    />
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return <div className={cn("pb-4 border-b border-[#262626] flex items-center justify-between mb-4", className)} {...props} />;
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => {
  return <h3 className={cn("font-sans font-bold text-white text-sm tracking-tight", className)} {...props} />;
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => {
  return <p className={cn("text-[10px] text-[#71717A] font-mono uppercase tracking-wider", className)} {...props} />;
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return <div className={cn("space-y-4", className)} {...props} />;
};
