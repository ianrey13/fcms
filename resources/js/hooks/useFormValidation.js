// src/hooks/useFormValidation.js
import { useState, useCallback } from 'react';
import { validateField, VALIDATION_RULES } from '../utils/validation';
import { showValidationErrors, showSuccess, showWarning } from '../utils/toastWithErrors';

export const useFormValidation = (formType, initialData = {}) => {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rules = VALIDATION_RULES[formType] || {};

  /**
   * Validate a single field
   */
  const validateSingleField = useCallback((field, value) => {
    if (!rules[field]) return [];

    const fieldRules = rules[field];
    const fieldErrors = validateField(field, value, fieldRules);
    
    setErrors(prev => ({
      ...prev,
      [field]: fieldErrors.length > 0 ? fieldErrors : undefined
    }));

    return fieldErrors;
  }, [rules]);

  /**
   * Validate all fields
   */
  const validateAll = useCallback((data = formData) => {
    const newErrors = {};
    let hasErrors = false;

    Object.keys(rules).forEach(field => {
      const fieldRules = rules[field];
      const value = data[field];
      const fieldErrors = validateField(field, value, fieldRules);
      
      if (fieldErrors.length > 0) {
        newErrors[field] = fieldErrors;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(rules).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    
    return { hasErrors, errors: newErrors };
  }, [rules, formData]);

  /**
   * Handle field change with validation
   */
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    setErrors(prev => ({ ...prev, [field]: undefined }));
    
    // Validate on change if field was touched
    if (touched[field]) {
      validateSingleField(field, value);
    }
  }, [touched, validateSingleField]);

  /**
   * Handle field blur (mark as touched and validate)
   */
  const handleBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    const value = formData[field];
    validateSingleField(field, value);
  }, [formData, validateSingleField]);

  /**
   * Submit form with validation
   */
  const handleSubmit = useCallback(async (onSubmit, data = formData) => {
    setIsSubmitting(true);

    try {
      const { hasErrors, errors: validationErrors } = validateAll(data);
      
      if (hasErrors) {
        const firstErrorField = showValidationErrors(validationErrors);
        setIsSubmitting(false);
        return { success: false, errors: validationErrors, firstErrorField };
      }

      // Clear errors before submission
      setErrors({});
      
      const result = await onSubmit(data);
      
      if (result?.success !== false) {
        showSuccess(result?.message || 'Operation completed successfully');
      }
      
      setIsSubmitting(false);
      return { success: true, data: result };
      
    } catch (error) {
      setIsSubmitting(false);
      
      if (error.response?.data?.errors) {
        const apiErrors = error.response.data.errors;
        const formattedErrors = {};
        
        Object.entries(apiErrors).forEach(([field, messages]) => {
          formattedErrors[field] = Array.isArray(messages) ? messages : [messages];
        });
        
        setErrors(formattedErrors);
        showValidationErrors(formattedErrors);
        return { success: false, errors: formattedErrors };
      }
      
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.');
      return { success: false, error: error.message };
    }
  }, [formData, validateAll]);

  /**
   * Reset form
   */
  const resetForm = useCallback((newData = initialData) => {
    setFormData(newData);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialData]);

  /**
   * Get error for a specific field
   */
  const getError = useCallback((field) => {
    return errors[field]?.[0] || null;
  }, [errors]);

  /**
   * Check if field has error
   */
  const hasError = useCallback((field) => {
    return touched[field] && !!errors[field];
  }, [touched, errors]);

  /**
   * Get field class based on error state
   */
  const getFieldClass = useCallback((field, baseClass = '') => {
    const hasErr = hasError(field);
    return `${baseClass} ${hasErr ? 'border-red-500 ring-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'}`;
  }, [hasError]);

  return {
    formData,
    setFormData,
    errors,
    touched,
    setTouched,
    isSubmitting,
    validateSingleField,
    validateAll,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    getError,
    hasError,
    getFieldClass
  };
};