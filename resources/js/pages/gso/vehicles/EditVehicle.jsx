// src/pages/gso/vehicles/EditVehicle.jsx
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
  Car,
  Truck,
  Fuel,
  Building2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  Save,
  X,
  Zap,
  Shield,
  Gauge,
  Edit,
} from "lucide-react";
import { useVehicles, useUpdateVehicle, useDepartmentsForVehicles } from "../../../hooks/useVehicleManagement";
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

const EditVehicle = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const toastIdRef = useRef(null);
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: departments = [] } = useDepartmentsForVehicles();
  const updateVehicle = useUpdateVehicle();
  
  const [formData, setFormData] = useState({
    department_id: "",
    vehicle_model: "",
    plate_number: "",
    fuel_type: "diesel",
    status: "active",
    maintenance_flag: false,
    odometer_status: "functional",
    display_status: "Serviceable",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [originalData, setOriginalData] = useState(null);

  // ============ STATUS OPTIONS ============
  const statusOptions = [
    { value: "Serviceable", backendStatus: "active", maintenanceFlag: false },
    { value: "Under Maintenance", backendStatus: "active", maintenanceFlag: true },
    { value: "Unserviceable", backendStatus: "inactive", maintenanceFlag: false },
  ];

  const getDisplayStatus = (status, maintenanceFlag) => {
    if (status === "inactive") return "Unserviceable";
    if (maintenanceFlag) return "Under Maintenance";
    return "Serviceable";
  };

  // ============ LOAD VEHICLE DATA ============
  useEffect(() => {
    if (vehicles.length > 0 && id) {
      const vehicle = vehicles.find((v) => v.vehicle_id === parseInt(id));
      if (vehicle) {
        const displayStatus = getDisplayStatus(vehicle.status, vehicle.maintenance_flag);
        const data = {
          department_id: vehicle.department_id || "",
          vehicle_model: vehicle.vehicle_model || "",
          plate_number: vehicle.plate_number || "",
          fuel_type: vehicle.fuel_type || "diesel",
          status: vehicle.status || "active",
          maintenance_flag: vehicle.maintenance_flag || false,
         
          display_status: displayStatus,
        };
        setFormData(data);
        setOriginalData(data);
      } else {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        toastIdRef.current = toast.error("Vehicle not found");
        navigate("/admin/vehicles");
      }
    }
  }, [vehicles, id, navigate]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    
    if (!validate()) {
      return;
    }

    updateVehicle.mutate(
      {
        vehicleId: parseInt(id),
        vehicleData: {
          department_id: parseInt(formData.department_id),
          vehicle_model: formData.vehicle_model.trim(),
          plate_number: formData.plate_number.trim().toUpperCase(),
          fuel_type: formData.fuel_type,
          status: formData.status,
          maintenance_flag: formData.maintenance_flag,
          odometer_status: formData.odometer_status,
        },
      },
      {
        onSuccess: () => {
          if (toastIdRef.current) toast.dismiss(toastIdRef.current);
          toastIdRef.current = toast.success("✅ Vehicle updated successfully!");
          navigate("/admin/vehicles");
        },
        onError: (error) => {
          if (toastIdRef.current) toast.dismiss(toastIdRef.current);
          const message = error.response?.data?.message || "Failed to update vehicle";
          
          if (error.response?.data?.errors?.plate_number) {
            toastIdRef.current = toast.error(`Plate number "${formData.plate_number}" already exists. Please use a different plate number.`);
            setErrors(prev => ({ ...prev, plate_number: "This plate number is already registered" }));
            setTouched(prev => ({ ...prev, plate_number: true }));
            document.querySelector('[name="plate_number"]')?.focus();
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
                <Edit className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Edit Vehicle
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Update vehicle information
                </p>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
              <Shield className="h-3 w-3 mr-1" />
              {formData.plate_number || "Editing"}
            </Badge>
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
                <Car className="h-5 w-5 text-blue-500" />
                Vehicle Information
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Update the vehicle details below
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
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
                  disabled={updateVehicle.isPending || !hasChanges}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateVehicle.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Vehicle
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

              {!hasChanges && !updateVehicle.isPending && (
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

export default EditVehicle;