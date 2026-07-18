import React, { useState } from 'react';
import { cn } from '../../lib/utils';

const TooltipProvider = ({ children }) => {
  return <>{children}</>;
};

const Tooltip = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Find TooltipTrigger and TooltipContent among children
  let trigger = null;
  let content = null;
  
  React.Children.forEach(children, (child) => {
    if (child && child.type === TooltipTrigger) {
      trigger = child;
    }
    if (child && child.type === TooltipContent) {
      content = child;
    }
  });
  
  if (!trigger) return null;
  
  return (
    <div 
      className="relative inline-block" 
      onMouseEnter={() => setIsOpen(true)} 
      onMouseLeave={() => setIsOpen(false)}
    >
      {trigger}
      {isOpen && content}
    </div>
  );
};

const TooltipTrigger = ({ children, asChild, ...props }) => {
  if (asChild) {
    return React.cloneElement(children, props);
  }
  return <button {...props}>{children}</button>;
};

const TooltipContent = React.forwardRef(({ className, side = "right", children, ...props }, ref) => {
  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };
  
  return (
    <div
      ref={ref}
      className={cn(
        "z-50 absolute px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap",
        sideClasses[side],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TooltipContent.displayName = "TooltipContent";

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };