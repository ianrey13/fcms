// src/pages/gso/users/EditUser.jsx
// ============================================
// ENHANCED: Improved validation with field highlighting
// No duplicate toasts - single toast with all errors
// Auto-focus first error field
// ============================================

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Building2,
  Mail,
  Loader2,
  IdCard,
  Car,
  User,
  Shield,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Info,
  Save,
  X,
  Zap,
  Users,
} from "lucide-react";
import { useUsers, useUpdateUser, useDepartments } from "../../../hooks/useUserManagement";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ============================================
// ✅ GET AVAILABLE ROLES BASED ON DEPARTMENT
// ============================================

const getAvailableRoles = (departmentId, departments) => {
    const department = departments.find(d => d.department_id === parseInt(departmentId));
    
    if (!department) return [{ value: '', label: 'Select Role' }];
    
    const code = department.department_code?.toUpperCase() || '';
    
    if (code === 'GSO') {
        return [
            { value: '', label: 'Select Role' },
            { value: 'gso_office', label: 'GSO Staff' },
            { value: 'driver', label: 'Driver' },
        ];
    }
    
    if (code === 'MO') {
        return [
            { value: '', label: 'Select Role' },
            { value: 'mayors_office', label: 'Disbursing Officer' },
            { value: 'driver', label: 'Driver' },
        ];
    }
    
    return [
        { value: '', label: 'Select Role' },
        { value: 'driver', label: 'Driver' },
    ];
};

// ============================================
// ✅ ENHANCED: Form Field with error highlighting
// ============================================

const FormField = ({
  label,
  icon: Icon,
  required,
  error,
  touched,
  helper,
  children,
  className,
}) => {
  const hasError = touched && error;
  
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        {React.cloneElement(children, {
          className: cn(
            children.props.className,
            hasError && "border-red-500 ring-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/10"
          )
        })}
        {hasError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
          </div>
        )}
      </div>
      {hasError && (
        <p className="text-red-500 text-xs flex items-center gap-1 mt-1 animate-fadeIn">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
      {helper && !hasError && (
        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
          <Info className="h-3 w-3" />
          {helper}
        </p>
      )}
    </div>
  );
};

// ============================================
// ✅ ROLE SELECT COMPONENT WITH DYNAMIC OPTIONS
// ============================================

const RoleSelect = ({ value, onChange, onBlur, error, touched, departmentId, departments }) => {
    const roleOptions = getAvailableRoles(departmentId, departments);
    const hasError = touched && error;
    
    useEffect(() => {
        if (departmentId && roleOptions.length === 2 && roleOptions[1]?.value === 'driver') {
            if (!value || value === '') {
                onChange('driver');
            }
        }
    }, [departmentId, roleOptions, value, onChange]);
    
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                className={cn(
                    "w-full mt-1 px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:border-slate-700 appearance-none",
                    hasError && "border-red-500 ring-red-500 bg-red-50/50 dark:bg-red-950/10",
                    roleOptions.length === 2 && roleOptions[1]?.value === 'driver' && "cursor-not-allowed opacity-60"
                )}
                disabled={roleOptions.length === 2 && roleOptions[1]?.value === 'driver'}
            >
                {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {hasError && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
                </div>
            )}
        </div>
    );
};

// ============================================
// DEPARTMENT DATALIST COMPONENT
// ============================================

const DepartmentDatalist = ({ value, onChange, onBlur, error, touched, departments }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const inputRef = useRef(null);
  const hasError = touched && error;

  useEffect(() => {
    if (value) {
      const found = departments.find(d => d.department_id === parseInt(value));
      if (found) {
        setSearchTerm(found.department_name);
        setSelectedDepartment(found);
      }
    } else {
      setSearchTerm("");
      setSelectedDepartment(null);
    }
  }, [value, departments]);

  const handleInputChange = (e) => {
    const input = e.target.value;
    setSearchTerm(input);
    
    const match = departments.find(d => 
      d.department_name.toLowerCase() === input.toLowerCase() ||
      d.department_code?.toLowerCase() === input.toLowerCase()
    );
    
    if (match) {
      setSelectedDepartment(match);
      onChange(match.department_id);
    } else if (input === "") {
      setSelectedDepartment(null);
      onChange("");
    }
  };

  const handleSelect = (dept) => {
    setSearchTerm(dept.department_name);
    setSelectedDepartment(dept);
    onChange(dept.department_id);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchTerm("");
    setSelectedDepartment(null);
    onChange("");
    inputRef.current?.focus();
  };

  const filteredDepartments = searchTerm.length > 0
    ? departments.filter(d => 
        d.department_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.department_code?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Building2 className="h-4 w-4" />
        </div>
        <Input
          ref={inputRef}
          type="text"
          placeholder="Type department name or code..."
          value={searchTerm}
          onChange={handleInputChange}
          onBlur={() => {
            if (searchTerm && !selectedDepartment) {
              const match = departments.find(d => 
                d.department_name.toLowerCase() === searchTerm.toLowerCase()
              );
              if (!match) {
                onChange("");
              }
            }
            if (onBlur) onBlur();
          }}
          className={cn(
            "pl-10 pr-10 bg-white dark:bg-slate-900 dark:border-slate-700",
            hasError && "border-red-500 ring-red-500 bg-red-50/50 dark:bg-red-950/10"
          )}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {hasError && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
          </div>
        )}
      </div>

      {searchTerm.length > 0 && filteredDepartments.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredDepartments.map((dept) => (
            <div
              key={dept.department_id}
              onClick={() => handleSelect(dept)}
              className={cn(
                "px-4 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-between",
                selectedDepartment?.department_id === dept.department_id && "bg-blue-50 dark:bg-blue-900/30"
              )}
            >
              <div>
                <span className="font-medium text-slate-800 dark:text-white">
                  {dept.department_name}
                </span>
                {dept.department_code && (
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                    ({dept.department_code})
                  </span>
                )}
              </div>
              {selectedDepartment?.department_id === dept.department_id && (
                <CheckCircle className="h-4 w-4 text-blue-600" />
              )}
            </div>
          ))}
        </div>
      )}

      {searchTerm.length > 0 && filteredDepartments.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No departments found</p>
        </div>
      )}

      {selectedDepartment && (
        <div className="mt-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-2.5 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Selected: <strong>{selectedDepartment.department_name}</strong>
            </span>
            <Badge variant="outline" className="ml-auto text-xs border-blue-300 dark:border-blue-700">
              {selectedDepartment.department_code}
            </Badge>
          </div>
        </div>
      )}
      {hasError && !selectedDepartment && (
        <p className="text-red-500 text-xs flex items-center gap-1 mt-2 animate-fadeIn">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};

// ============================================
// ROLE BADGE COMPONENT
// ============================================

const RoleBadge = ({ role }) => {
  const configs = {
    gso_office: {
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      label: "GSO Office",
    },
    mayors_office: {
      color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      label: "Disbursing Officer",
    },
    driver: {
      color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
      label: "Driver",
    },
  };
  const config = configs[role] || {
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    label: role || "Unknown",
  };
  return <Badge className={`${config.color} text-xs font-medium`}>{config.label}</Badge>;
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
  <div className="max-w-3xl mx-auto p-4 md:p-6">
    <div className="flex items-center gap-3 mb-6">
      <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      <div className="flex-1">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mt-1 animate-pulse" />
      </div>
    </div>
    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const EditUser = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: users = [], isLoading } = useUsers();
  const { data: departments = [] } = useDepartments();
  const updateUser = useUpdateUser();
  const toastIdRef = useRef(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    employee_number: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    department_id: "",
    role: "",
    can_drive: false,
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [originalData, setOriginalData] = useState(null);

  // ============ LOAD USER DATA ============
  useEffect(() => {
    if (users.length > 0 && id) {
      const user = users.find((u) => u.user_id === parseInt(id));
      if (user) {
        const data = {
          email: user.email || "",
          employee_number: user.employee_number || "",
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          middle_name: user.middle_name || "",
          department_id: user.department_id || "",
          role: user.role || "",
          can_drive: user.can_drive || false,
          password: "",
          password_confirmation: "",
        };
        setFormData(data);
        setOriginalData(data);
      } else {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        toastIdRef.current = toast.error("User not found");
        navigate("/admin/users");
      }
    }
  }, [users, id, navigate]);

  // ============ AUTO-SELECT ROLE WHEN DEPARTMENT CHANGES ============
  useEffect(() => {
    if (formData.department_id && departments.length > 0) {
      const available = getAvailableRoles(formData.department_id, departments);
      if (available.length === 2 && available[1]?.value === 'driver') {
        if (formData.role !== 'driver') {
          setFormData(prev => ({ ...prev, role: 'driver' }));
        }
      }
    }
  }, [formData.department_id, departments]);

  // ============================================
  // ✅ ENHANCED VALIDATION - Single toast with all errors
  // ============================================

   const validate = () => {
    const newErrors = {};
    const newTouched = {};
    const NAME_REGEX = /^[A-Za-z\s\.\-\'\,]+$/;

    // Email validation
    if (!formData.email?.trim()) {
      newErrors.email = "Email is required";
      newTouched.email = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
      newTouched.email = true;
    }

    // First Name validation
    const firstName = formData.first_name?.trim() || "";
    if (!firstName) {
      newErrors.first_name = "First name is required";
      newTouched.first_name = true;
    } else if (firstName.length < 2) {
      newErrors.first_name = "First name must be at least 2 characters";
      newTouched.first_name = true;
    } else if (firstName.length > 50) {
      newErrors.first_name = "First name must be 50 characters or less";
      newTouched.first_name = true;
    } else if (!NAME_REGEX.test(firstName)) {
      newErrors.first_name = "First name may only contain letters, spaces, and basic punctuation";
      newTouched.first_name = true;
    }

    // Last Name validation
    const lastName = formData.last_name?.trim() || "";
    if (!lastName) {
      newErrors.last_name = "Last name is required";
      newTouched.last_name = true;
    } else if (lastName.length < 2) {
      newErrors.last_name = "Last name must be at least 2 characters";
      newTouched.last_name = true;
    } else if (lastName.length > 50) {
      newErrors.last_name = "Last name must be 50 characters or less";
      newTouched.last_name = true;
    } else if (!NAME_REGEX.test(lastName)) {
      newErrors.last_name = "Last name may only contain letters, spaces, and basic punctuation";
      newTouched.last_name = true;
    }

    // Middle Name validation (optional)
    const middleName = formData.middle_name?.trim() || "";
    if (middleName && middleName.length > 50) {
      newErrors.middle_name = "Middle name must be 50 characters or less";
      newTouched.middle_name = true;
    } else if (middleName && !NAME_REGEX.test(middleName)) {
      newErrors.middle_name = "Middle name may only contain letters, spaces, and basic punctuation";
      newTouched.middle_name = true;
    }

    // Department validation
    if (!formData.department_id) {
      newErrors.department_id = "Department is required";
      newTouched.department_id = true;
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = "Role is required";
      newTouched.role = true;
    } else {
      const availableRoles = getAvailableRoles(formData.department_id, departments);
      const validRoles = availableRoles.map(r => r.value).filter(v => v !== '');
      if (!validRoles.includes(formData.role)) {
        newErrors.role = "Invalid role for selected department";
        newTouched.role = true;
      }
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
      newTouched.password = true;
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
      newTouched.password = true;
    }

    // Password confirmation validation
    if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = "Passwords do not match";
      newTouched.password_confirmation = true;
    }

    setErrors(newErrors);
    setTouched(prev => ({ ...prev, ...newTouched }));

    if (Object.keys(newErrors).length > 0) {
      const errorMessages = Object.entries(newErrors).map(([field, msg]) => {
        const labels = {
          email: 'Email',
          first_name: 'First Name',
          last_name: 'Last Name',
          middle_name: 'Middle Name',
          department_id: 'Department',
          role: 'Role',
          password: 'Password',
          password_confirmation: 'Confirm Password'
        };
        const label = labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `• ${label}: ${msg}`;
      });

      if (toastIdRef.current) toast.dismiss(toastIdRef.current);

      toastIdRef.current = toast.error(
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

      const firstField = Object.keys(newErrors)[0];
      if (firstField) {
        const element = document.querySelector(`[name="${firstField}"]`) || 
                        document.getElementById(firstField);
        if (element) {
          setTimeout(() => element.focus(), 100);
        }
      }

      return false;
    }

    return true;
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const hasError = (field) => touched[field] && errors[field];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

   const handleSubmit = (e) => {
    e.preventDefault();
    
    if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    
    if (!validate()) {
      return;
    }

    const payload = {
      ...formData,
      email: formData.email.trim().toLowerCase(),
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      middle_name: formData.middle_name?.trim() || null,
    };

    if (!payload.password) {
      delete payload.password;
      delete payload.password_confirmation;
    }

    updateUser.mutate(
      { userId: parseInt(id), userData: payload },
      {
        onSuccess: () => {
          if (toastIdRef.current) toast.dismiss(toastIdRef.current);
          toastIdRef.current = toast.success("✅ User updated successfully!");
          navigate("/admin/users");
        },
        onError: (error) => {
          if (toastIdRef.current) toast.dismiss(toastIdRef.current);
          const message = error.response?.data?.message || "Failed to update user";
          
          if (error.response?.data?.errors?.email) {
            toastIdRef.current = toast.error(`Email "${formData.email}" already exists. Please use a different email.`);
            setErrors(prev => ({ ...prev, email: "Email already exists" }));
            setTouched(prev => ({ ...prev, email: true }));
            document.querySelector('[name="email"]')?.focus();
          } else {
            toastIdRef.current = toast.error(message);
          }
        },
      }
    );
  };

  const showCanDrive = formData.role === "driver";
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/users")}
            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <Edit className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Edit User
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Update user information
                </p>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {formData.role && <RoleBadge role={formData.role} />}
            {hasChanges && (
              <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                <Info className="h-3 w-3 mr-1" />
                Unsaved
              </Badge>
            )}
          </div>
        </div>

        {/* Form Card */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <Users className="h-5 w-5 text-blue-500" />
                User Information
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Update the user's details below
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
               <FormField
                  label="Email Address"
                  icon={Mail}
                  required
                  error={errors.email}
                  touched={touched.email}
                  helper="User's login email address"
                >
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    className="bg-white dark:bg-slate-900 dark:border-slate-700"
                  />
                </FormField>
             

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="First Name"
                  icon={User}
                  required
                  error={errors.first_name}
                  touched={touched.first_name}
                >
                  <Input
                    id="first_name"
                    name="first_name"
                    placeholder="First name"
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    onBlur={() => handleBlur("first_name")}
                    className="bg-white dark:bg-slate-900 dark:border-slate-700"
                    maxLength={50}
                  />
                </FormField>

                <FormField
                  label="Last Name"
                  icon={User}
                  required
                  error={errors.last_name}
                  touched={touched.last_name}
                >
                  <Input
                    id="last_name"
                    name="last_name"
                    placeholder="Last name"
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    onBlur={() => handleBlur("last_name")}
                    className="bg-white dark:bg-slate-900 dark:border-slate-700"
                    maxLength={50}
                  />
                </FormField>
              </div>

              {/* Middle Name */}
              <FormField
                label="Middle Name"
                icon={User}
                error={errors.middle_name}
                touched={touched.middle_name}
                helper="Optional - user's middle name"
              >
                <Input
                  id="middle_name"
                  name="middle_name"
                  placeholder="Middle name (optional)"
                  value={formData.middle_name}
                  onChange={(e) => handleChange("middle_name", e.target.value)}
                  onBlur={() => handleBlur("middle_name")}
                  className="bg-white dark:bg-slate-900 dark:border-slate-700"
                  maxLength={50}
                />
              </FormField>

              {/* Department */}
              <FormField
                label="Department"
                icon={Building2}
                required
                error={errors.department_id}
                touched={touched.department_id}
              >
                <DepartmentDatalist
                  value={formData.department_id}
                  onChange={(value) => handleChange("department_id", value)}
                  onBlur={() => handleBlur("department_id")}
                  error={errors.department_id}
                  touched={touched.department_id}
                  departments={departments}
                />
              </FormField>

              {/* Role - Dynamic based on department */}
              <FormField
                label="User Role"
                icon={Shield}
                required
                error={errors.role}
                touched={touched.role}
                helper="Determines what the user can access"
              >
                <RoleSelect
                  value={formData.role}
                  onChange={(value) => handleChange("role", value)}
                  onBlur={() => handleBlur("role")}
                  error={errors.role}
                  touched={touched.role}
                  departmentId={formData.department_id}
                  departments={departments}
                />
              </FormField>

              {/* Can Drive Toggle - Only for Drivers */}
              {/* {showCanDrive && (
                <div className="bg-cyan-50/50 dark:bg-cyan-950/20 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center gap-4">
                    <Car className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    <div className="flex items-center gap-3">
                      <Label className="cursor-pointer font-medium text-cyan-800 dark:text-cyan-300">
                        Can Drive?
                      </Label>
                      <button
                        type="button"
                        onClick={() => handleChange("can_drive", !formData.can_drive)}
                        className={cn(
                          "relative w-12 h-7 rounded-full transition-colors",
                          formData.can_drive ? "bg-cyan-600" : "bg-slate-300 dark:bg-slate-600"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform",
                            formData.can_drive ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                      <span className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                        {formData.can_drive ? "Yes" : "No"}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-600/70 dark:text-cyan-400/70 ml-auto">
                      Allows user to be assigned as a driver
                    </p>
                  </div>
                </div>
              )} */}

              {/* Password Section */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Leave password blank to keep current password
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="New Password"
                  icon={Key}
                  helper="Minimum 8 characters (optional)"
                  error={errors.password}
                  touched={touched.password}
                >
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      onBlur={() => handleBlur("password")}
                      className={cn(
                        "bg-white dark:bg-slate-900 dark:border-slate-700 pr-10",
                        hasError("password") && "border-red-500 ring-red-500"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>

                <FormField
                  label="Confirm New Password"
                  icon={Key}
                  error={errors.password_confirmation}
                  touched={touched.password_confirmation}
                >
                  <div className="relative">
                    <Input
                      id="password_confirmation"
                      name="password_confirmation"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password_confirmation}
                      onChange={(e) => handleChange("password_confirmation", e.target.value)}
                      onBlur={() => handleBlur("password_confirmation")}
                      className={cn(
                        "bg-white dark:bg-slate-900 dark:border-slate-700 pr-10",
                        hasError("password_confirmation") && "border-red-500 ring-red-500"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>
              </div>

              {/* Password Strength Indicator */}
              {formData.password && formData.password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          formData.password.length < 4
                            ? "bg-red-500 w-1/4"
                            : formData.password.length < 8
                            ? "bg-yellow-500 w-1/2"
                            : formData.password.length < 12
                            ? "bg-blue-500 w-3/4"
                            : "bg-emerald-500 w-full"
                        )}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[60px]">
                      {formData.password.length < 4 ? "Weak" : formData.password.length < 8 ? "Fair" : formData.password.length < 12 ? "Good" : "Strong"}
                    </span>
                  </div>
                </div>
              )}

         

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                <Button
                  type="submit"
                  disabled={updateUser.isPending || !hasChanges}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateUser.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update User
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/users")}
                  className="flex-1 dark:border-slate-700 dark:text-slate-300"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>

              {!hasChanges && !updateUser.isPending && (
                <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                  No changes to save
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditUser;