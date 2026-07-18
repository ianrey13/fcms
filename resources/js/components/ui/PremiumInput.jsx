// src/components/ui/PremiumInput.jsx
import React from 'react';
import { cn } from '../../lib/utils';

export const PremiumInput = ({ 
  className, 
  error, 
  icon: Icon,
  label,
  required,
  ...props 
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Icon size={18} className="text-slate-400" />
          </div>
        )}
        <input
          className={cn(
            "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900",
            "placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "transition-all duration-200",
            Icon && "pl-10",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};