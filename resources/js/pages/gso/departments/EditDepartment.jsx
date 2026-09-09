// src/pages/mayor/departments/EditDepartment.jsx
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
  Building2, 
  Code, 
  User, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  Save,
  X
} from "lucide-react";
import { useDepartments, useUpdateDepartment } from "../../../hooks/useDepartmentManagement";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

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
  className 
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
      </div>
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const EditDepartment = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: departments = [], isLoading } = useDepartments();
  const updateDepartment = useUpdateDepartment();
  const toastIdRef = useRef(null);
  
  const [formData, setFormData] = useState({ 
    department_name: "", 
    department_code: "",
    head_of_office: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [originalData, setOriginalData] = useState(null);

  // ============ LOAD DEPARTMENT DATA ============
  useEffect(() => {
    if (departments.length > 0 && id) {
      const dept = departments.find((d) => d.department_id === parseInt(id));
      if (dept) {
        const data = {
          department_name: dept.department_name || "",
          department_code: dept.department_code || "",
          head_of_office: dept.head_of_office || "",
        };
        setFormData(data);
        setOriginalData(data);
      } else {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        toastIdRef.current = toast.error("Department not found");
        navigate("/admin/departments");
      }
    }
  }, [departments, id, navigate]);

  // ============================================
  // ✅ ENHANCED VALIDATION - Single toast with all errors
  // ============================================

  const validate = () => {
    const newErrors = {};
    const newTouched = {};

    // Department Name validation
    if (!formData.department_name.trim()) {
      newErrors.department_name = "Department name is required";
      newTouched.department_name = true;
    } else if (formData.department_name.trim().length < 3) {
      newErrors.department_name = "Department name must be at least 3 characters";
      newTouched.department_name = true;
    } else if (formData.department_name.trim().length > 150) {
      newErrors.department_name = "Department name must be 150 characters or less";
      newTouched.department_name = true;
    }

    // Department Code validation
    if (!formData.department_code.trim()) {
      newErrors.department_code = "Department code is required";
      newTouched.department_code = true;
    } else if (formData.department_code.trim().length > 20) {
      newErrors.department_code = "Code must be 20 characters or less";
      newTouched.department_code = true;
    } else if (formData.department_code.trim().length < 2) {
      newErrors.department_code = "Code must be at least 2 characters";
      newTouched.department_code = true;
    } else if (!/^[A-Z0-9_]+$/.test(formData.department_code.trim().toUpperCase())) {
      newErrors.department_code = "Code must contain only letters, numbers, and underscores";
      newTouched.department_code = true;
    }

    // Head of Office validation
    if (formData.head_of_office && formData.head_of_office.trim().length > 150) {
      newErrors.head_of_office = "Head of office name is too long (max 150 characters)";
      newTouched.head_of_office = true;
    }

    setErrors(newErrors);
    setTouched(prev => ({ ...prev, ...newTouched }));

    // ✅ Show single toast with all errors
    if (Object.keys(newErrors).length > 0) {
      const errorMessages = Object.entries(newErrors).map(([field, msg]) => {
        const labels = {
          department_name: 'Department Name',
          department_code: 'Department Code',
          head_of_office: 'Head of Office'
        };
        const label = labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `• ${label}: ${msg}`;
      });

      // ✅ Dismiss any existing toast
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

      // ✅ Auto-focus first error field
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
    
    // ✅ Dismiss any existing toast before validation
    if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    
    if (!validate()) {
      return;
    }

    updateDepartment.mutate(
      {
        departmentId: parseInt(id),
        departmentData: {
          department_name: formData.department_name.trim(),
          department_code: formData.department_code.trim().toUpperCase(),
          head_of_office: formData.head_of_office.trim() || null,
        },
      },
      {
        onSuccess: () => {
          if (toastIdRef.current) toast.dismiss(toastIdRef.current);
          toastIdRef.current = toast.success("✅ Department updated successfully!");
          navigate("/admin/departments");
        },
        onError: (error) => {
          if (toastIdRef.current) toast.dismiss(toastIdRef.current);
          const message = error.response?.data?.message || "Failed to update department";
          
          // Check for duplicate code error
          if (error.response?.data?.errors?.department_code) {
            toastIdRef.current = toast.error(`Department code "${formData.department_code}" already exists. Please use a different code.`);
            setErrors(prev => ({ ...prev, department_code: "This code is already in use" }));
            setTouched(prev => ({ ...prev, department_code: true }));
            document.querySelector('[name="department_code"]')?.focus();
          } else {
            toastIdRef.current = toast.error(message);
          }
        },
      }
    );
  };

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
            onClick={() => navigate("/admin/departments")}
            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Edit Department
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Update department information
                </p>
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
              <Code className="h-3 w-3 mr-1" />
              {formData.department_code || "Editing"}
            </Badge>
          </div>
        </div>

        {/* Form Card */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  Department Information
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  Update the department details below
                </CardDescription>
              </div>
              {hasChanges && (
                <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                  <Info className="h-3 w-3 mr-1" />
                  Unsaved changes
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Department Code */}
              <FormField
                label="Department Code"
                icon={Code}
                required
                error={errors.department_code}
                touched={touched.department_code}
                helper="Short, unique identifier (2-20 characters). Use letters, numbers, and underscores only."
              >
                <Input
                  id="department_code"
                  name="department_code"
                  placeholder="e.g., ENGR"
                  value={formData.department_code}
                  onChange={(e) => handleChange("department_code", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("department_code")}
                  className="font-mono uppercase bg-white dark:bg-slate-900 dark:border-slate-700"
                  maxLength={20}
                />
              </FormField>

              {/* Department Name */}
              <FormField
                label="Department Name"
                icon={Building2}
                required
                error={errors.department_name}
                touched={touched.department_name}
                helper="Full, descriptive name of the department (3-150 characters)"
              >
                <Input
                  id="department_name"
                  name="department_name"
                  placeholder="e.g., Engineering Office"
                  value={formData.department_name}
                  onChange={(e) => handleChange("department_name", e.target.value)}
                  onBlur={() => handleBlur("department_name")}
                  className="bg-white dark:bg-slate-900 dark:border-slate-700"
                  maxLength={150}
                />
              </FormField>

              {/* Head of Office */}
              <FormField
                label="Head of Office"
                icon={User}
                error={errors.head_of_office}
                touched={touched.head_of_office}
                helper="Full name of the department head (appears on trip tickets)"
              >
                <Input
                  id="head_of_office"
                  name="head_of_office"
                  placeholder="e.g., Engr. Karl John G. Madridano"
                  value={formData.head_of_office}
                  onChange={(e) => handleChange("head_of_office", e.target.value)}
                  onBlur={() => handleBlur("head_of_office")}
                  className="bg-white dark:bg-slate-900 dark:border-slate-700"
                  maxLength={150}
                />
              </FormField>

            

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                <Button
                  type="submit"
                  disabled={updateDepartment.isPending || !hasChanges}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateDepartment.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Department
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/departments")}
                  className="flex-1 dark:border-slate-700 dark:text-slate-300"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>

              {!hasChanges && !updateDepartment.isPending && (
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

export default EditDepartment;