// src/utils/toastWithErrors.js
import { toast } from 'react-hot-toast';
import { getFieldLabel } from './validation';

/**
 * Show validation errors with field highlighting
 */
export const showValidationErrors = (errors, formData = null) => {
  if (!errors || Object.keys(errors).length === 0) return;

  // Build error message with field names
  const errorMessages = Object.entries(errors).map(([field, messages]) => {
    const label = getFieldLabel(field);
    const msg = Array.isArray(messages) ? messages[0] : messages;
    return `• ${label}: ${msg}`;
  });

  // Show toast with all errors
  toast.error(
    <div className="space-y-1">
      <div className="font-semibold text-red-600 dark:text-red-400">Please fix the following errors:</div>
      <div className="text-sm text-red-500 dark:text-red-300 space-y-0.5">
        {errorMessages.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </div>
    </div>,
    { duration: 5000 }
  );

  // Return first field with error for focusing
  return Object.keys(errors)[0];
};

/**
 * Show a single field error with toast
 */
export const showFieldError = (field, message) => {
  const label = getFieldLabel(field);
  toast.error(`${label}: ${message}`, { duration: 4000 });
};

/**
 * Show success toast
 */
export const showSuccess = (message) => {
  toast.success(message, { duration: 3000 });
};

/**
 * Show warning toast
 */
export const showWarning = (message) => {
  toast.warning(message, { duration: 4000 });
};

/**
 * Show loading toast
 */
export const showLoading = (message) => {
  return toast.loading(message);
};

/**
 * Dismiss toast
 */
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};