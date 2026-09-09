// src/utils/toast.js
import toast from 'react-hot-toast';

/**
 * Show toast notification with various types
 */
export const showToast = (type, message, options = {}) => {
    const defaultOptions = {
        duration: 4000,
        position: 'top-right',
        style: {
            borderRadius: '12px',
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
            padding: '16px 20px',
        },
    };

    const opts = { ...defaultOptions, ...options };

    switch (type) {
        case 'success':
            toast.success(message, opts);
            break;
        case 'error':
            toast.error(message, opts);
            break;
        case 'warning':
            toast.warning(message, opts);
            break;
        case 'info':
            toast.info(message, opts);
            break;
        default:
            toast(message, opts);
    }
};

/**
 * Show validation error toast with field details
 */
export const showValidationErrors = (errors, formData = null) => {
    if (!errors || Object.keys(errors).length === 0) return;

    const errorMessages = Object.entries(errors).map(([field, messages]) => {
        const label = getFieldLabel(field);
        const msg = Array.isArray(messages) ? messages[0] : messages;
        return `• ${label}: ${msg}`;
    });

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

    return Object.keys(errors)[0];
};

/**
 * Get user-friendly field label
 */
const getFieldLabel = (field) => {
    const labels = {
        driver_id: 'Driver',
        vehicle_id: 'Vehicle',
        department_id: 'Department',
        trip_date: 'Trip Date',
        destination: 'Destination',
        purpose: 'Purpose',
        passenger_name: 'Passenger Name',
        estimated_distance_km: 'Estimated Distance',
        email: 'Email Address',
        first_name: 'First Name',
        last_name: 'Last Name',
        middle_name: 'Middle Name',
        role: 'Role',
        password: 'Password',
        password_confirmation: 'Confirm Password',
        employee_number: 'Employee Number',
        year: 'Year',
        annual_amount: 'Annual Budget',
        fiscal_year: 'Fiscal Year',
        invoice_number: 'Invoice Number',
        liters_availed: 'Liters Availed',
        amount_on_receipt: 'Amount on Receipt',
        receipt_photo: 'Receipt Photo',
        start_date: 'Start Date',
        end_date: 'End Date',
        charge_to: 'Charge To',
        default_weekly_allocation: 'Weekly Allocation'
    };
    return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Success toast with consistent styling
 */
export const showSuccess = (message, options = {}) => {
    showToast('success', message, options);
};

/**
 * Error toast with consistent styling
 */
export const showError = (message, options = {}) => {
    showToast('error', message, options);
};

/**
 * Warning toast with consistent styling
 */
export const showWarning = (message, options = {}) => {
    showToast('warning', message, options);
};

/**
 * Info toast with consistent styling
 */
export const showInfo = (message, options = {}) => {
    showToast('info', message, options);
};

/**
 * Loading toast (returns toast id for dismissal)
 */
export const showLoading = (message, options = {}) => {
    return toast.loading(message, {
        ...options,
        style: {
            borderRadius: '12px',
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
            padding: '16px 20px',
        },
    });
};

/**
 * Dismiss a loading toast
 */
export const dismissToast = (toastId) => {
    toast.dismiss(toastId);
};

/**
 * Dismiss all toasts
 */
export const dismissAllToasts = () => {
    toast.dismiss();
};

export default toast;