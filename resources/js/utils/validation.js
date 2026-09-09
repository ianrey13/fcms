// src/utils/validation.js

/**
 * Validation rules and error messages
 */

export const VALIDATION_RULES = {
  // ============ TRIP TICKET ============
  trip: {
    driver_id: {
      required: true,
      message: 'Please select a valid driver'
    },
    vehicle_id: {
      required: true,
      message: 'Please select a valid vehicle'
    },
    department_id: {
      required: true,
      message: 'Department is required'
    },
    trip_date: {
      required: true,
      notPast: true,
      message: 'Trip date cannot be in the past'
    },
    destination: {
      required: true,
      min: 2,
      max: 255,
      message: 'Destination must be at least 2 characters'
    },
    purpose: {
      required: true,
      min: 5,
      max: 500,
      message: 'Purpose must be at least 5 characters'
    },
    passenger_name: {
      required: false,
      max: 100,
      message: 'Passenger name is too long'
    },
    estimated_distance_km: {
      required: true,
      min: 0.1,
      message: 'Please calculate the distance first'
    }
  },

  // ============ USER ============
  user: {
    email: {
      required: true,
      email: true,
      unique: true,
      message: 'Please enter a valid email address'
    },
    first_name: {
      required: true,
      min: 2,
      max: 50,
      lettersOnly: true,
      message: 'First name must be at least 2 characters'
    },
    last_name: {
      required: true,
      min: 2,
      max: 50,
      lettersOnly: true,
      message: 'Last name must be at least 2 characters'
    },
    middle_name: {
      required: false,
      max: 50,
      lettersOnly: true,
      message: 'Middle name is too long'
    },
    department_id: {
      required: true,
      message: 'Please select a department'
    },
    role: {
      required: true,
      message: 'Please select a role'
    },
    password: {
      required: true,
      min: 8,
      message: 'Password must be at least 8 characters'
    },
    password_confirmation: {
      required: true,
      matches: 'password',
      message: 'Passwords do not match'
    },
    employee_number: {
      required: false,
      unique: true,
      message: 'Employee number already exists'
    }
  },

  // ============ FISCAL YEAR ============
  fiscalYear: {
    year: {
      required: true,
      min: 2000,
      max: 2100,
      unique: true,
      message: 'Please enter a valid year between 2000-2100'
    }
  },

  // ============ BUDGET ============
  budget: {
    annual_amount: {
      required: true,
      min: 0.01,
      message: 'Annual budget must be greater than 0'
    },
    department_id: {
      required: true,
      message: 'Please select a department'
    },
    fiscal_year: {
      required: true,
      message: 'Please select an active fiscal year'
    }
  },

  // ============ FUEL RECEIPT ============
  fuelReceipt: {
    invoice_number: {
      required: true,
      message: 'Invoice number is required'
    },
    liters_availed: {
      required: true,
      min: 0.01,
      message: 'Liters must be greater than 0'
    },
    amount_on_receipt: {
      required: true,
      min: 0.01,
      message: 'Amount must be greater than 0'
    },
    receipt_photo: {
      required: true,
      image: true,
      maxSize: 2, // MB
      message: 'Please upload a valid receipt image (max 2MB)'
    }
  },

  // ============ RECONCILIATION ============
  reconciliation: {
    start_date: {
      required: true,
      message: 'Please select a start date'
    },
    end_date: {
      required: true,
      after: 'start_date',
      message: 'End date must be after start date'
    }
  }
};

/**
 * Validate a single field
 */
export const validateField = (field, value, rules) => {
  const errors = [];

  // Required
  if (rules.required) {
    if (value === undefined || value === null || value === '') {
      errors.push(rules.message || 'This field is required');
      return errors;
    }
    if (typeof value === 'string' && value.trim() === '') {
      errors.push(rules.message || 'This field is required');
      return errors;
    }
  }

  // Min length
  if (rules.min && value && String(value).length < rules.min) {
    errors.push(rules.message || `Must be at least ${rules.min} characters`);
  }

  // Max length
  if (rules.max && value && String(value).length > rules.max) {
    errors.push(rules.message || `Must be at most ${rules.max} characters`);
  }

  // Email
  if (rules.email && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push(rules.message || 'Please enter a valid email address');
    }
  }

  // Letters only
  if (rules.lettersOnly && value) {
    const lettersRegex = /^[A-Za-z\s\-']+$/;
    if (!lettersRegex.test(value)) {
      errors.push(rules.message || 'Only letters, spaces, hyphens, and apostrophes allowed');
    }
  }

  // Min value
  if (rules.minValue !== undefined && value !== undefined && value !== null && value !== '') {
    if (parseFloat(value) < rules.minValue) {
      errors.push(rules.message || `Must be at least ${rules.minValue}`);
    }
  }

  // Max value
  if (rules.maxValue !== undefined && value !== undefined && value !== null && value !== '') {
    if (parseFloat(value) > rules.maxValue) {
      errors.push(rules.message || `Must be at most ${rules.maxValue}`);
    }
  }

  // Not past date
  if (rules.notPast && value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(value);
    if (date < today) {
      errors.push(rules.message || 'Date cannot be in the past');
    }
  }

  // Match field
  if (rules.matches && value) {
    // matches expects a field name, value will be compared with formData
  }

  // Image validation
  if (rules.image && value) {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (value.type && !validTypes.includes(value.type)) {
      errors.push(rules.message || 'Please upload a JPEG or PNG image');
    }
    if (value.size && value.size > rules.maxSize * 1024 * 1024) {
      errors.push(rules.message || `File size must be under ${rules.maxSize}MB`);
    }
  }

  return errors;
};

/**
 * Get field label for error messages
 */
export const getFieldLabel = (field) => {
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