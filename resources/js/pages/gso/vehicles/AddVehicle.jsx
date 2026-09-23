// src/pages/gso/vehicles/AddVehicle.jsx
// ============================================
// ENHANCED: Improved validation with field highlighting
// No duplicate toasts - single toast with all errors
// Auto-focus first error field
// + AlertDialog confirmation before register
// ============================================

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Car,
  Truck,
  Fuel,
  Building2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  Shield,
  X,
} from "lucide-react";
import { useCreateVehicle, useDepartmentsForVehicles } from "../../../hooks/useVehicleManagement";
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
// DEPARTMENT DATALIST COMPONENT (with error highlighting)
// ============================================

const DepartmentDatalist = ({ value, onChange, onBlur, error, touched, departments, loading }) => {
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
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
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

      {searchTerm.length > 0 && filteredDepartments.length === 0 && !loading && (
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
// MAIN COMPONENT
// ============================================

const AddVehicle = () => {
  const navigate = useNavigate();
  const createVehicle = useCreateVehicle();
  const toastIdRef = useRef(null);
  const { data: departments = [], isLoading: loadingDepartments } = useDepartmentsForVehicles();

  const [formData, setFormData] = useState({
    department_id: "",
    vehicle_model: "",
    plate_number: "",
    fuel_type: "diesel",
    status: "active",
    maintenance_flag: false,
    display_status: "Serviceable",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  // ============ STATUS OPTIONS ============
  const statusOptions = [
    { value: "Serviceable", backendStatus: "active", maintenanceFlag: false },
    { value: "Under Maintenance", backendStatus: "active", maintenanceFlag: true },
    { value: "Unserviceable", backendStatus: "inactive", maintenanceFlag: false },
  ];

  // ============================================
  // ✅ ENHANCED VALIDATION - Single toast with all errors
  // ============================================

  const validate = () => {
    const newErrors = {};
    const newTouched = {};

    // Department validation
    if (!formData.department_id) {
      newErrors.department_id = "Department is required";
      newTouched.department_id = true;
    }

    // Vehicle Model validation
    if (!formData.vehicle_model.trim()) {
      newErrors.vehicle_model = "Vehicle model is required";
      newTouched.vehicle_model = true;
    } else if (formData.vehicle_model.trim().length < 2) {
      newErrors.vehicle_model = "Vehicle model must be at least 2 characters";
      newTouched.vehicle_model = true;
    } else if (formData.vehicle_model.trim().length > 120) {
      newErrors.vehicle_model = "Vehicle model must be 120 characters or less";
      newTouched.vehicle_model = true;
    }

    // Plate Number validation
    if (!formData.plate_number.trim()) {
      newErrors.plate_number = "Plate number is required";
      newTouched.plate_number = true;
    } else if (formData.plate_number.trim().length < 3) {
      newErrors.plate_number = "Plate number must be at least 3 characters";
      newTouched.plate_number = true;
    } else if (formData.plate_number.trim().length > 20) {
      newErrors.plate_number = "Plate number must be 20 characters or less";
      newTouched.plate_number = true;
    } else if (!/^[A-Z0-9-]+$/.test(formData.plate_number.trim().toUpperCase())) {
      newErrors.plate_number = "Plate number can only contain letters, numbers, and hyphens";
      newTouched.plate_number = true;
    }

    // Fuel Type validation
    if (!formData.fuel_type) {
      newErrors.fuel_type = "Fuel type is required";
      newTouched.fuel_type = true;
    }

    setErrors(newErrors);
    setTouched(prev => ({ ...prev, ...newTouched }));

    // ✅ Show single toast with all errors
    if (Object.keys(newErrors).length > 0) {
      const errorMessages = Object.entries(newErrors).map(([field, msg]) => {
        const labels = {
          department_id: 'Department',
          vehicle_model: 'Vehicle Model',
          plate_number: 'Plate Number',
          fuel_type: 'Fuel Type',
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

  const handleStatusChange = (displayStatus) => {
    const option = statusOptions.find(s => s.value === displayStatus);
    if (option) {
      setFormData(prev => ({
        ...prev,
        display_status: displayStatus,
        status: option.backendStatus,
        maintenance_flag: option.maintenanceFlag,
      }));
    }
  };

  // ============================================
  // ✅ SUBMIT — validate, build payload, then confirm
  // ============================================

  const handleSubmitClick = (e) => {
    e.preventDefault();

    if (toastIdRef.current) toast.dismiss(toastIdRef.current);

    if (!validate()) {
      return;
    }

    const payload = {
      department_id: parseInt(formData.department_id),
      vehicle_model: formData.vehicle_model.trim(),
      plate_number: formData.plate_number.trim().toUpperCase(),
      fuel_type: formData.fuel_type,
      status: formData.status,
      maintenance_flag: formData.maintenance_flag,
    };

    setPendingPayload(payload);
    setShowConfirm(true);
  };

  const handleConfirmCreate = () => {
    if (!pendingPayload) return;

    createVehicle.mutate(pendingPayload, {
      onSuccess: () => {
        setShowConfirm(false);
        setPendingPayload(null);
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        toastIdRef.current = toast.success("✅ Vehicle registered successfully!");
        navigate("/admin/vehicles");
      },
      onError: (error) => {
        setShowConfirm(false);
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        const message = error.response?.data?.message || "Failed to register vehicle";

        // Handle duplicate plate number
        if (error.response?.data?.errors?.plate_number) {
          toastIdRef.current = toast.error(`Plate number "${pendingPayload.plate_number}" already exists. Please use a different plate number.`);
          setErrors(prev => ({ ...prev, plate_number: "This plate number is already registered" }));
          setTouched(prev => ({ ...prev, plate_number: true }));
          document.querySelector('[name="plate_number"]')?.focus();
        } else {
          toastIdRef.current = toast.error(message);
        }
      },
    });
  };

  const currentDisplayStatus = formData.display_status || "Serviceable";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/vehicles")}
            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <Car className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Register New Vehicle
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Add a new vehicle to the fleet
                </p>
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
              <Zap className="h-3 w-3 mr-1" />
              New
            </Badge>
          </div>
        </div>

        {/* Form Card */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <Car className="h-5 w-5 text-blue-500" />
                Vehicle Information
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Fill in the details below to register a new vehicle
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmitClick} className="space-y-5">
              {/* Department */}
              <FormField
                label="Department"
                icon={Building2}
                required
                error={errors.department_id}
                touched={touched.department_id}
              >
                <DepartmentDatalist
                  id="department_id"
                  name="department_id"
                  value={formData.department_id}
                  onChange={(value) => handleChange("department_id", value)}
                  onBlur={() => handleBlur("department_id")}
                  error={errors.department_id}
                  touched={touched.department_id}
                  departments={departments}
                  loading={loadingDepartments}
                />
              </FormField>

              {/* Vehicle Model */}
              <FormField
                label="Vehicle Model"
                icon={Car}
                required
                error={errors.vehicle_model}
                touched={touched.vehicle_model}
                helper="e.g., Toyota Hilux, Mitsubishi L300 (max 120 characters)"
              >
                <Input
                  id="vehicle_model"
                  name="vehicle_model"
                  placeholder="Enter vehicle model"
                  value={formData.vehicle_model}
                  onChange={(e) => handleChange("vehicle_model", e.target.value)}
                  onBlur={() => handleBlur("vehicle_model")}
                  className="bg-white dark:bg-slate-900 dark:border-slate-700"
                  maxLength={120}
                />
              </FormField>

              {/* Plate Number */}
              <FormField
                label="Plate Number"
                icon={Truck}
                required
                error={errors.plate_number}
                touched={touched.plate_number}
                helper="Unique identifier for the vehicle (letters, numbers, hyphens only)"
              >
                <Input
                  id="plate_number"
                  name="plate_number"
                  placeholder="e.g., ABC-1234"
                  value={formData.plate_number}
                  onChange={(e) => handleChange("plate_number", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("plate_number")}
                  className="font-mono uppercase bg-white dark:bg-slate-900 dark:border-slate-700"
                  maxLength={20}
                />
              </FormField>

              {/* Fuel Type */}
              <FormField
                label="Fuel Type"
                icon={Fuel}
                required
                error={errors.fuel_type}
                touched={touched.fuel_type}
                helper="Select the fuel type for this vehicle"
              >
                <select
                  id="fuel_type"
                  name="fuel_type"
                  value={formData.fuel_type}
                  onChange={(e) => handleChange("fuel_type", e.target.value)}
                  className={cn(
                    "w-full mt-1 px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:border-slate-700",
                    hasError("fuel_type") && "border-red-500 ring-red-500 bg-red-50/50 dark:bg-red-950/10"
                  )}
                >
                  <option value="diesel">Diesel</option>
                  <option value="gasoline">Gasoline</option>
                  <option value="premium">Premium</option>
                </select>
              </FormField>

              {/* Status */}
              <FormField
                label="Vehicle Status"
                icon={Shield}
                required
                helper="Select the current status of the vehicle"
              >
                <select
                  value={currentDisplayStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:border-slate-700"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </FormField>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                <Button
                  type="submit"
                  disabled={createVehicle.isPending}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {createVehicle.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Register Vehicle
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/vehicles")}
                  className="flex-1 dark:border-slate-700 dark:text-slate-300"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Confirm Register Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Register this vehicle?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-slate-500">Model:</span>
                  <span className="col-span-2 font-medium text-slate-800 dark:text-slate-100">
                    {pendingPayload?.vehicle_model || "—"}
                  </span>

                  <span className="text-slate-500">Plate No.:</span>
                  <span className="col-span-2 font-mono font-medium text-slate-800 dark:text-slate-100">
                    {pendingPayload?.plate_number || "—"}
                  </span>

                  <span className="text-slate-500">Department:</span>
                  <span className="col-span-2 font-medium text-slate-800 dark:text-slate-100">
                    {departments.find(d => d.department_id === pendingPayload?.department_id)?.department_name || "—"}
                  </span>

                  <span className="text-slate-500">Fuel Type:</span>
                  <span className="col-span-2 font-medium text-slate-800 dark:text-slate-100 capitalize">
                    {pendingPayload?.fuel_type || "—"}
                  </span>

                  <span className="text-slate-500">Status:</span>
                  <span className="col-span-2 font-medium text-slate-800 dark:text-slate-100">
                    {currentDisplayStatus}
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createVehicle.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCreate}
              disabled={createVehicle.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createVehicle.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Registering...
                </>
              ) : (
                "Register Vehicle"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AddVehicle;