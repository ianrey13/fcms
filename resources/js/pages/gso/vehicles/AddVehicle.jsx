// src/pages/gso/vehicles/AddVehicle.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Wrench,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  Shield,
  Gauge,
  Calendar,
  Users,
  MapPin,
  Phone,
  Mail,
  Plus,
  X,
  Search,
} from "lucide-react";
import { useCreateVehicle, useDepartmentsForVehicles } from "../../../hooks/useVehicleManagement";
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
  className,
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
// DEPARTMENT DATALIST COMPONENT
// ============================================

const DepartmentDatalist = ({ value, onChange, onBlur, error, departments, loading }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const inputRef = useRef(null);

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
            error && "border-red-500 ring-red-500"
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
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const AddVehicle = () => {
  const navigate = useNavigate();
  const createVehicle = useCreateVehicle();
  const { data: departments = [], isLoading: loadingDepartments } = useDepartmentsForVehicles();
  const [formData, setFormData] = useState({
    department_id: "",
    vehicle_model: "",
    plate_number: "",
    fuel_type: "diesel",
    status: "active",      // Backend: active, maintenance_flag, inactive
    maintenance_flag: false,
    display_status: "Serviceable", // Frontend: Serviceable, Under Maintenance, Unserviceable
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // ============ STATUS OPTIONS ============
  const statusOptions = [
    { value: "Serviceable", backendStatus: "active", maintenanceFlag: false },
    { value: "Under Maintenance", backendStatus: "active", maintenanceFlag: true },
    { value: "Unserviceable", backendStatus: "inactive", maintenanceFlag: false },
  ];

  // ============ VALIDATION ============
  const validate = () => {
    const newErrors = {};
    const newTouched = {};

    if (!formData.department_id) {
      newErrors.department_id = "Department is required";
      newTouched.department_id = true;
    }

    if (!formData.vehicle_model.trim()) {
      newErrors.vehicle_model = "Vehicle model is required";
      newTouched.vehicle_model = true;
    } else if (formData.vehicle_model.trim().length < 2) {
      newErrors.vehicle_model = "Vehicle model must be at least 2 characters";
      newTouched.vehicle_model = true;
    }

    if (!formData.plate_number.trim()) {
      newErrors.plate_number = "Plate number is required";
      newTouched.plate_number = true;
    } else if (formData.plate_number.trim().length < 3) {
      newErrors.plate_number = "Plate number must be at least 3 characters";
      newTouched.plate_number = true;
    }

    setErrors(newErrors);
    setTouched(newTouched);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const hasError = (field) => touched[field] && errors[field];

  // ============ HANDLERS ============
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleStatusChange = (displayStatus) => {
    const option = statusOptions.find(s => s.value === displayStatus);
    if (option) {
      setFormData((prev) => ({
        ...prev,
        display_status: displayStatus,
        status: option.backendStatus,
        maintenance_flag: option.maintenanceFlag,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix all errors before submitting");
      return;
    }

    createVehicle.mutate(
      {
        department_id: parseInt(formData.department_id),
        vehicle_model: formData.vehicle_model.trim(),
        plate_number: formData.plate_number.trim().toUpperCase(),
        fuel_type: formData.fuel_type,
        status: formData.status,
        maintenance_flag: formData.maintenance_flag,
      },
      {
        onSuccess: () => {
          toast.success("Vehicle registered successfully!");
          navigate("/admin/vehicles");
        },
        onError: (error) => {
          console.error("Create vehicle error:", error);
          toast.error(error.response?.data?.message || "Failed to register vehicle");
        },
      }
    );
  };

  // Get current display status
  const currentDisplayStatus = formData.display_status || "Serviceable";

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
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Department - WITH DATALIST */}
              <FormField
                label="Department"
                icon={Building2}
                required
                error={hasError("department_id") && errors.department_id}
              >
                <DepartmentDatalist
                  value={formData.department_id}
                  onChange={(value) => handleChange("department_id", value)}
                  onBlur={() => handleBlur("department_id")}
                  error={hasError("department_id")}
                  departments={departments}
                  loading={loadingDepartments}
                />
              </FormField>

              {/* Vehicle Model */}
              <FormField
                label="Vehicle Model"
                icon={Car}
                required
                error={hasError("vehicle_model") && errors.vehicle_model}
                helper="e.g., Toyota Hilux, Mitsubishi L300"
              >
                <Input
                  placeholder="Enter vehicle model"
                  value={formData.vehicle_model}
                  onChange={(e) => handleChange("vehicle_model", e.target.value)}
                  onBlur={() => handleBlur("vehicle_model")}
                  className={cn(
                    "bg-white dark:bg-slate-900 dark:border-slate-700",
                    hasError("vehicle_model") && "border-red-500 ring-red-500"
                  )}
                />
              </FormField>

              {/* Plate Number */}
              <FormField
                label="Plate Number"
                icon={Truck}
                required
                error={hasError("plate_number") && errors.plate_number}
                helper="Unique identifier for the vehicle"
              >
                <Input
                  placeholder="e.g., ABC-1234"
                  value={formData.plate_number}
                  onChange={(e) => handleChange("plate_number", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("plate_number")}
                  className={cn(
                    "font-mono uppercase bg-white dark:bg-slate-900 dark:border-slate-700",
                    hasError("plate_number") && "border-red-500 ring-red-500"
                  )}
                />
              </FormField>

              {/* Fuel Type */}
              <FormField
                label="Fuel Type"
                icon={Fuel}
                required
                helper="Select the fuel type for this vehicle"
              >
                <select
                  value={formData.fuel_type}
                  onChange={(e) => handleChange("fuel_type", e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="diesel">Diesel</option>
                  <option value="premium">Premium</option>
                  <option value="regular">Regular</option>
                </select>
              </FormField>

              {/* Status - Frontend Display */}
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

              {/* Form Preview */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Preview
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-400">Model:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 ml-2">
                      {formData.vehicle_model || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Plate:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 ml-2">
                      {formData.plate_number || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Fuel:</span>
                    <span className="text-slate-700 dark:text-slate-300 ml-2 capitalize">
                      {formData.fuel_type || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>
                    <span className={cn(
                      "font-medium ml-2",
                      currentDisplayStatus === "Serviceable" 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : currentDisplayStatus === "Under Maintenance"
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    )}>
                      {currentDisplayStatus}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Department:</span>
                    <span className="text-slate-700 dark:text-slate-300 ml-2">
                      {departments.find(d => d.department_id === parseInt(formData.department_id))?.department_name || "—"}
                    </span>
                  </div>
                </div>
              </div>

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
    </div>
  );
};

export default AddVehicle;