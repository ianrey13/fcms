// src/components/ui/FormField.jsx
import React from 'react';
import { Label } from './label';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

export const FormField = ({
  label,
  icon: Icon,
  required,
  error,
  touched,
  children,
  className,
  helper,
  ...props
}) => {
  const hasError = touched && error;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          {Icon && <Icon className="h-4 w-4 text-slate-400" />}
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <div className="relative">
        {React.cloneElement(children, {
          className: cn(
            children.props.className,
            hasError && "border-red-500 ring-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/10"
          ),
          ...props
        })}
        
        {hasError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
          </div>
        )}
      </div>
      
      {hasError && (
        <p className="text-red-500 text-xs flex items-center gap-1.5 mt-1 animate-fadeIn">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
      
      {helper && !hasError && (
        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
          {helper}
        </p>
      )}
    </div>
  );
};