// src/components/ui/PremiumButton.jsx
import React from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = {
  primary: "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg",
  secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
  success: "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white",
  danger: "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white",
  warning: "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white",
  outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50",
  ghost: "hover:bg-slate-100 text-slate-600",
};

const buttonSizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
  xl: "px-8 py-4 text-lg rounded-2xl",
};

export const PremiumButton = ({ 
  children, 
  variant = "primary", 
  size = "md",
  className,
  loading,
  disabled,
  icon: Icon,
  iconPosition = "left",
  ...props 
}) => {
  return (
    <button
      className={cn(
        "font-semibold transition-all duration-200 btn-hover-effect",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      <div className="flex items-center justify-center gap-2">
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            {Icon && iconPosition === "left" && <Icon size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />}
            {children}
            {Icon && iconPosition === "right" && <Icon size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />}
          </>
        )}
      </div>
    </button>
  );
};