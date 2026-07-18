// src/components/ui/PremiumCard.jsx
import React from 'react';
import { cn } from '../../lib/utils';

export const PremiumCard = ({ children, className, hover = true, gradient = false, ...props }) => {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300",
        hover && "hover:shadow-card-hover hover:border-slate-200",
        gradient && "gradient-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const PremiumCardHeader = ({ children, className, gradient = false }) => {
  return (
    <div
      className={cn(
        "px-6 py-4 border-b border-slate-100",
        gradient && "bg-gradient-to-r from-slate-50 to-white",
        className
      )}
    >
      {children}
    </div>
  );
};

export const PremiumCardContent = ({ children, className }) => {
  return (
    <div className={cn("px-6 py-4", className)}>
      {children}
    </div>
  );
};

export const PremiumCardFooter = ({ children, className }) => {
  return (
    <div className={cn("px-6 py-4 bg-slate-50/50 border-t border-slate-100", className)}>
      {children}
    </div>
  );
};