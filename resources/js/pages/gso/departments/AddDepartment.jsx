// src/pages/mayor/departments/AddDepartment.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Mail,
  Phone,
  MapPin,
  Shield,
  Zap
} from "lucide-react";
import { useCreateDepartment } from "../../../hooks/useDepartmentManagement";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ============================================
// FORM FIELD COMPONENT
// ============================================

const FormField = ({ 
  label, 
  icon: Icon, 
  required, 
  error, 
  helper, 
  children,
  className 
}) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
      {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      {label}
      {required && <span className="text-red-500">*</span>}
    </Label>
    {children}
    {error && (
      <p className="text-red-500 text-xs flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
    {helper && !error && (
      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
        <Info className="h-3 w-3" />
        {helper}
      </p>
    )}
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const AddDepartment = () => {
  const navigate = useNavigate();
  const createDepartment = useCreateDepartment();
  const [formData, setFormData] = useState({
    department_name: "",
    department_code: "",
    head_of_office: "",
    email: "",
    phone: "",
    address: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // ============ VALIDATION ============
  const validate = () => {
    const newErrors = {};
    const newTouched = {};

    if (!formData.department_name.trim()) {
      newErrors.department_name = "Department name is required";
      newTouched.department_name = true;
    } else if (formData.department_name.trim().length < 3) {
      newErrors.department_name = "Department name must be at least 3 characters";
      newTouched.department_name = true;
    }

    if (!formData.department_code.trim()) {
      newErrors.department_code = "Department code is required";
      newTouched.department_code = true;
    } else if (formData.department_code.trim().length > 20) {
      newErrors.department_code = "Code must be 20 characters or less";
      newTouched.department_code = true;
    } else if (!/^[A-Z0-9_]+$/.test(formData.department_code.trim().toUpperCase())) {
      newErrors.department_code = "Code must contain only letters, numbers, and underscores";
      newTouched.department_code = true;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
      newTouched.email = true;
    }

    setErrors(newErrors);
    setTouched(newTouched);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const hasError = (field) => touched[field] && errors[field];

  // ============ HANDLERS ============
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix all errors before submitting");
      return;
    }

    createDepartment.mutate(
      {
        department_name: formData.department_name.trim(),
        department_code: formData.department_code.trim().toUpperCase(),
        head_of_office: formData.head_of_office.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Department created successfully!");
          navigate("/admin/departments");
        },
        onError: (error) => {
          const message = error.response?.data?.message || "Failed to create department";
          toast.error(message);
        },
      }
    );
  };

  // ============================================
  // RENDER
  // ============================================

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
                  Add New Department
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Create a new department in the system
                </p>
              </div>
            </div>
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
                  Fill in the details below to create a new department
                </CardDescription>
              </div>
              <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                <Zap className="h-3 w-3 mr-1" />
                New
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Department Code */}
              <FormField
                label="Department Code"
                icon={Code}
                required
                error={hasError("department_code") && errors.department_code}
                helper="Short, unique identifier (max 20 characters). Use letters, numbers, and underscores only."
              >
                <Input
                  placeholder="e.g., ENGR"
                  value={formData.department_code}
                  onChange={(e) => handleChange("department_code", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("department_code")}
                  className={cn(
                    "font-mono uppercase bg-white dark:bg-slate-900 dark:border-slate-700",
                    hasError("department_code") && "border-red-500 ring-red-500"
                  )}
                  maxLength={20}
                />
              </FormField>

              {/* Department Name */}
              <FormField
                label="Department Name"
                icon={Building2}
                required
                error={hasError("department_name") && errors.department_name}
                helper="Full, descriptive name of the department"
              >
                <Input
                  placeholder="e.g., Engineering Office"
                  value={formData.department_name}
                  onChange={(e) => handleChange("department_name", e.target.value)}
                  onBlur={() => handleBlur("department_name")}
                  className={cn(
                    "bg-white dark:bg-slate-900 dark:border-slate-700",
                    hasError("department_name") && "border-red-500 ring-red-500"
                  )}
                />
              </FormField>

              {/* Head of Office */}
              <FormField
                label="Head of Office"
                icon={User}
                helper="Full name of the department head (appears on trip tickets)"
              >
                <Input
                  placeholder="e.g., Dr. Zelyn Denampo"
                  value={formData.head_of_office}
                  onChange={(e) => handleChange("head_of_office", e.target.value)}
                  onBlur={() => handleBlur("head_of_office")}
                  className="bg-white dark:bg-slate-900 dark:border-slate-700"
                />
              </FormField>

              {/* Email */}
              <FormField
                label="Email Address"
                icon={Mail}
                helper="Official department email address"
                error={hasError("email") && errors.email}
              >
                <Input
                  type="email"
                  placeholder="e.g., engineering@laguindingan.gov.ph"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  className={cn(
                    "bg-white dark:bg-slate-900 dark:border-slate-700",
                    hasError("email") && "border-red-500 ring-red-500"
                  )}
                />
              </FormField>

              {/* Phone */}
              <FormField
                label="Phone Number"
                icon={Phone}
                helper="Department contact number"
              >
                <Input
                  type="tel"
                  placeholder="e.g., (088) 123-4567"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  onBlur={() => handleBlur("phone")}
                  className="bg-white dark:bg-slate-900 dark:border-slate-700"
                />
              </FormField>

              {/* Address */}
              <FormField
                label="Address"
                icon={MapPin}
                helper="Department physical address"
              >
                <Input
                  placeholder="e.g., Municipal Hall, Laguindingan"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  onBlur={() => handleBlur("address")}
                  className="bg-white dark:bg-slate-900 dark:border-slate-700"
                />
              </FormField>

              {/* Form Preview */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Preview
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-400">Code:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 ml-2">
                      {formData.department_code || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Name:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 ml-2">
                      {formData.department_name || "—"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Head:</span>
                    <span className="text-slate-700 dark:text-slate-300 ml-2">
                      {formData.head_of_office || "Not set"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                <Button
                  type="submit"
                  disabled={createDepartment.isPending}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {createDepartment.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Create Department
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/departments")}
                  className="flex-1 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddDepartment;