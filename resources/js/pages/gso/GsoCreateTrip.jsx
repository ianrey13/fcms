// src/pages/gso/GsoCreateTrip.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  gsoAPI,
  vehicleAPI,
  driverManagementAPI,
  adminDepartmentAPI,
  userAPI,
  locationAPI,
} from "../../services/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  User,
  MapPin,
  Calendar,
  Building2,
  Loader2,
  CheckCircle,
  Search,
  AlertTriangle,
  Car,
  Fuel,
  DollarSign,
  FileText,
  Clock,
  X,
  ArrowLeft,
  Navigation,
  Gauge,
  Zap,
  Shield,
  Users,
  Route,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { debounce } from "lodash";
import { cn } from "@/lib/utils";

// ============================================
// CONSTANTS
// ============================================

const ORIGIN_ADDRESS = "Laguindingan Municipal Hall";

// ============================================
// SUB-COMPONENTS
// ============================================

const FormSection = ({ title, icon: Icon, children, className }) => (
  <div className={cn(
    "bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-800/50 dark:to-slate-900 rounded-xl p-5 border border-slate-200/60 dark:border-slate-700/60",
    className
  )}>
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-blue-500/10">
        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
        {title}
      </h3>
    </div>
    {children}
  </div>
);

const FieldError = ({ error }) => {
  if (!error) return null;
  return (
    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />
      {error}
    </p>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const GsoCreateTrip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    department_id: "",
    driver_id: "",
    vehicle_id: "",
    trip_date: new Date().toISOString().split("T")[0],
    destination: "",
    purpose: "",
    charge_to: "",
    passenger_name: "",
    staff_id: "",
    estimated_distance_km: "",
    estimated_fuel_liters: "",
    estimated_cost: "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lookup State
  const [lookupType, setLookupType] = useState("employee");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [showNotFound, setShowNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Destination State
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [tripEstimate, setTripEstimate] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // ============================================
  // QUERIES
  // ============================================

  const { data: departments = [], isLoading: deptsLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      try {
        const response = await adminDepartmentAPI.getSelector();
        const data = response.data?.data || response.data || [];
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching departments:", error);
        toast.error("Failed to load departments");
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      try {
        const response = await vehicleAPI.getAll();
        const data = response.data?.data || response.data || [];
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        return [];
      }
    },
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      try {
        const response = await driverManagementAPI.getAll();
        let driversData = response.data?.data || response.data || [];
        return Array.isArray(driversData) ? driversData : [];
      } catch (error) {
        console.error("Error fetching drivers:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // ============================================
  // DESTINATION SEARCH
  // ============================================

  const searchDestinations = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setDestinationSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const response = await locationAPI.searchPlaces(query);
        if (response.data.success && response.data.predictions) {
          const filtered = response.data.predictions.filter((item) => {
            const description = item.description.toLowerCase();
            return (
              !description.includes("region") &&
              !description.includes("province") &&
              item.lat !== null &&
              item.lng !== null
            );
          });
          setDestinationSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
        } else {
          setDestinationSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error("Search error:", error);
        setDestinationSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300),
    []
  );

  // ============================================
  // TRIP ESTIMATE CALCULATION
  // ============================================

  const calculateTripEstimate = useCallback(async (destination, vehicleId) => {
    if (!destination || destination.length < 2) return;

    setIsCalculating(true);
    try {
      const response = await locationAPI.calculateDistance({
        origin: ORIGIN_ADDRESS,
        destination: destination,
        vehicle_id: vehicleId || formData.vehicle_id || undefined,
      });

      if (response.data.success) {
        const data = response.data;
        setTripEstimate(data);
        setFormData((prev) => ({
          ...prev,
          estimated_distance_km: data.distance_km,
          estimated_fuel_liters: data.estimated_liters,
          estimated_cost: data.estimated_cost,
        }));
        toast.success(`Trip estimate calculated: ${data.distance_km} km`);
      } else {
        toast.error(response.data.message || "Failed to calculate distance");
      }
    } catch (error) {
      console.error("Distance calculation error:", error);
      toast.error("Failed to calculate distance. Please enter manually.");
    } finally {
      setIsCalculating(false);
    }
  }, [formData.vehicle_id]);

  // ============================================
  // HANDLE DESTINATION
  // ============================================

  const handleSelectDestination = (suggestion) => {
    setFormData((prev) => ({ ...prev, destination: suggestion.description }));
    setSelectedLocation(suggestion);
    setShowSuggestions(false);
    calculateTripEstimate(suggestion.description);
  };

  const handleDestinationChange = (value) => {
    setFormData((prev) => ({ ...prev, destination: value }));
    setTripEstimate(null);
    setSelectedLocation(null);
    if (value.length > 1) {
      searchDestinations(value);
    } else {
      setDestinationSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const clearDestination = () => {
    setFormData((prev) => ({ ...prev, destination: "" }));
    setTripEstimate(null);
    setSelectedLocation(null);
    setDestinationSuggestions([]);
    setShowSuggestions(false);
  };

  // ============================================
  // AUTO-FILL FUNCTIONS
  // ============================================

  const autoFillFormFromEmployee = useCallback((employee) => {
    const departmentId = employee.department_id?.toString() || "";

    const matchedDriver = drivers.find(
      (d) => d.user_id === employee.user_id || d.user?.user_id === employee.user_id
    );

    const deptVehicles = vehicles.filter(
      (v) => v.department_id === parseInt(departmentId) && v.status === "active"
    );
    const firstVehicle = deptVehicles.length > 0 ? deptVehicles[0] : null;

    setFormData((prev) => ({
      ...prev,
      department_id: departmentId,
      staff_id: employee.user_id,
      passenger_name: employee.full_name,
      driver_id: matchedDriver
        ? (matchedDriver.driver_id || matchedDriver.id)?.toString()
        : "",
      vehicle_id: firstVehicle
        ? firstVehicle.vehicle_id?.toString()
        : "",
    }));

    setErrors((prev) => ({
      ...prev,
      department_id: "",
      staff_id: "",
      driver_id: "",
      vehicle_id: "",
    }));

    let message = `✅ Found: ${employee.full_name} (${employee.employee_number || employee.email})`;
    if (matchedDriver) {
      message += `\n🚗 Driver auto-assigned: ${matchedDriver.full_name || matchedDriver.user?.full_name || "Assigned"}`;
    } else {
      message += `\n⚠️ No driver record found. Please assign a driver manually.`;
    }
    if (firstVehicle) {
      message += `\n🚙 Vehicle auto-selected: ${firstVehicle.plate_number}`;
    } else {
      message += `\n⚠️ No active vehicle found. Please select one manually.`;
    }

    setLookupResult({
      type: "employee",
      data: employee,
      message: message,
      matchedDriver: matchedDriver,
      matchedVehicle: firstVehicle,
    });
  }, [drivers, vehicles]);

  const autoFillFormFromVehicle = useCallback((vehicle) => {
    const departmentId = vehicle.department_id?.toString() || "";

    setFormData((prev) => ({
      ...prev,
      vehicle_id: vehicle.vehicle_id?.toString() || "",
      department_id: departmentId,
    }));

    setErrors((prev) => ({
      ...prev,
      vehicle_id: "",
      department_id: "",
    }));

    setLookupResult({
      type: "plate",
      data: vehicle,
      message: `✅ Found: ${vehicle.plate_number} (${vehicle.vehicle_model})`,
    });
  }, []);

  // ============================================
  // LOOKUP FUNCTION
  // ============================================

  const handleLookup = async () => {
    setLookupError(null);
    setLookupResult(null);
    setShowNotFound(false);

    if (!lookupValue.trim()) {
      setLookupError("Please enter a value to search");
      return;
    }

    setIsSearching(true);

    try {
      if (lookupType === "employee") {
        const response = await userAPI.getAll({ search: lookupValue });
        const users = response.data?.data || [];

        const filteredUsers = users.filter(
          (u) => u.role === "staff" || u.role === "driver" || 
                 u.role === "mayors_office" || u.role === "gso_office"
        );

        if (filteredUsers.length === 0) {
          setShowNotFound(true);
          setIsSearching(false);
          return;
        }

        autoFillFormFromEmployee(filteredUsers[0]);
        setShowNotFound(false);
      } else if (lookupType === "plate") {
        const response = await vehicleAPI.getAll({ search: lookupValue });
        const vehiclesData = response.data?.data || [];

        if (vehiclesData.length === 0) {
          setShowNotFound(true);
          setIsSearching(false);
          return;
        }

        autoFillFormFromVehicle(vehiclesData[0]);
        setShowNotFound(false);
      }
    } catch (error) {
      setLookupError("Search failed. Please try again.");
      console.error("Lookup error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearLookup = () => {
    setLookupValue("");
    setLookupResult(null);
    setShowNotFound(false);
    setLookupError(null);
  };

  // ============================================
  // EFFECTS
  // ============================================

  // Auto-fill charge_to when department changes
  useEffect(() => {
    if (formData.department_id) {
      const selectedDept = departments.find(
        (d) => d.department_id === parseInt(formData.department_id)
      );
      if (selectedDept) {
        setFormData((prev) => ({
          ...prev,
          charge_to: selectedDept.department_code,
        }));
        if (errors.charge_to) {
          setErrors((prev) => ({ ...prev, charge_to: "" }));
        }
      }
    }
  }, [formData.department_id, departments]);

  // Re-calculate estimate when vehicle changes
  useEffect(() => {
    if (formData.destination && formData.vehicle_id && formData.destination.length > 2) {
      calculateTripEstimate(formData.destination, formData.vehicle_id);
    }
  }, [formData.vehicle_id]);

  // ============================================
  // VALIDATION
  // ============================================

  const validateForm = () => {
    const newErrors = {};
    const newTouched = {};

    if (!formData.department_id) {
      newErrors.department_id = "Department is required";
      newTouched.department_id = true;
    }
    if (!formData.driver_id) {
      newErrors.driver_id = "Driver is required";
      newTouched.driver_id = true;
    }
    if (!formData.vehicle_id) {
      newErrors.vehicle_id = "Vehicle is required";
      newTouched.vehicle_id = true;
    }
    if (!formData.trip_date) {
      newErrors.trip_date = "Trip date is required";
      newTouched.trip_date = true;
    }
    if (!formData.destination || formData.destination.trim().length < 2) {
      newErrors.destination = "Destination must be at least 2 characters";
      newTouched.destination = true;
    }
    if (!formData.purpose || formData.purpose.trim().length < 5) {
      newErrors.purpose = "Purpose must be at least 5 characters";
      newTouched.purpose = true;
    }

    setErrors(newErrors);
    setTouched((prev) => ({ ...prev, ...newTouched }));
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // ============================================
  // MUTATIONS
  // ============================================

  const createTripMutation = useMutation({
    mutationFn: async (data) => {
      const response = await gsoAPI.createTrip(data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("✅ Trip ticket created successfully!");
      queryClient.invalidateQueries({ queryKey: ["gso"] });
      navigate("/gso/all-trips");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create trip");
    },
  });

  // ============================================
  // HANDLERS
  // ============================================

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix all errors before submitting");
      return;
    }
    createTripMutation.mutate(formData);
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const isLoading = deptsLoading || vehiclesLoading || driversLoading;

  const selectedVehicle = vehicles.find(
    (v) => v.vehicle_id === parseInt(formData.vehicle_id)
  );
  const selectedDepartment = departments.find(
    (d) => d.department_id === parseInt(formData.department_id)
  );

  const getDepartmentVehicles = () => {
    if (!formData.department_id) return vehicles;
    return vehicles.filter(
      (v) => v.department_id === parseInt(formData.department_id)
    );
  };

  const getDepartmentDrivers = () => {
    if (!formData.department_id) return drivers;
    return drivers.filter(
      (d) => d.department_id === parseInt(formData.department_id)
    );
  };

  const availableVehicles = getDepartmentVehicles();
  const availableDrivers = getDepartmentDrivers();
  const hasError = (field) => touched[field] && errors[field];

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Loading form data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/gso/dashboard")}
          className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Create Trip Ticket
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            GSO creates trip ticket directly for staff or requestor
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
            <Shield className="h-3 w-3 mr-1" />
            GSO
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <Zap className="h-3 w-3 mr-1" />
            New
          </Badge>
        </div>
      </div>

      <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-slate-800 dark:text-white">
                Trip Ticket Information
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                All fields marked with <span className="text-red-500">*</span> are required
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Lookup Section */}
            <FormSection title="Find Employee or Vehicle" icon={Search}>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select
                      value={lookupType}
                      onValueChange={(value) => {
                        setLookupType(value);
                        clearLookup();
                      }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Search by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">
                          <User className="h-4 w-4 inline mr-2" />
                          Employee
                        </SelectItem>
                        <SelectItem value="plate">
                          <Car className="h-4 w-4 inline mr-2" />
                          Plate Number
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={
                        lookupType === "employee"
                          ? "Enter Employee ID, Name, or Email"
                          : "Enter Plate Number"
                      }
                      value={lookupValue}
                      onChange={(e) => setLookupValue(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleLookup();
                        }
                      }}
                    />
                    <Button
                      onClick={handleLookup}
                      variant="outline"
                      disabled={isSearching}
                      className="min-w-[100px]"
                    >
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Search
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lookup Result */}
              {lookupResult && (
                <div className="mt-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="whitespace-pre-line text-sm">
                          {lookupResult.message}
                        </div>
                      </div>
                      {lookupResult.type === "employee" && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            <span className="font-medium">Department:</span>
                            <span>{lookupResult.data.department_name || "N/A"}</span>
                          </div>
                          {lookupResult.matchedDriver ? (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                              <User className="h-3 w-3" />
                              <span className="font-medium">Driver:</span>
                              <span>
                                {lookupResult.matchedDriver.full_name ||
                                 lookupResult.matchedDriver.user?.full_name ||
                                 "Auto-assigned"}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                              <AlertTriangle className="h-3 w-3" />
                              No driver record found. Please assign manually.
                            </div>
                          )}
                          {lookupResult.matchedVehicle ? (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                              <Truck className="h-3 w-3" />
                              <span className="font-medium">Vehicle:</span>
                              <span>
                                {lookupResult.matchedVehicle.plate_number} - {lookupResult.matchedVehicle.vehicle_model}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                              <AlertTriangle className="h-3 w-3" />
                              No active vehicle found. Please select manually.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearLookup}
                      className="text-gray-400 hover:text-gray-600 h-7 px-2 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Not Found */}
              {showNotFound && (
                <div className="mt-3 p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-xl border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-3 text-yellow-700 dark:text-yellow-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      No results found for "{lookupValue}"
                    </span>
                    <Button
                      variant="link"
                      className="text-yellow-600 p-0 h-auto ml-2"
                      onClick={() => {
                        if (lookupType === "employee") {
                          navigate("/admin/users/add");
                        } else {
                          navigate("/admin/vehicles/add");
                        }
                      }}
                    >
                      Create New?
                    </Button>
                  </div>
                </div>
              )}

              {lookupError && (
                <div className="mt-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
                  <p className="text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {lookupError}
                  </p>
                </div>
              )}
            </FormSection>

            {/* Destination Section */}
            <FormSection title="Trip Details" icon={MapPin}>
              <div className="space-y-4">
                {/* Destination */}
                <div className="relative">
                  <Label htmlFor="destination">
                    Destination <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      id="destination"
                      placeholder="Type destination (e.g., Cagayan de Oro)"
                      value={formData.destination}
                      onChange={(e) => handleDestinationChange(e.target.value)}
                      onBlur={() => handleFieldBlur("destination")}
                      className={cn(
                        "pl-10 pr-10",
                        hasError("destination") && "border-red-500 ring-red-500"
                      )}
                    />
                    {formData.destination && (
                      <button
                        type="button"
                        onClick={clearDestination}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                    {isCalculating && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      </div>
                    )}
                  </div>

                  {/* Suggestions */}
                  {showSuggestions && destinationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-auto">
                      {destinationSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => handleSelectDestination(suggestion)}
                          className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer flex items-start gap-3 transition-colors"
                        >
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {suggestion.description}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {suggestion.lat && suggestion.lng 
                                ? `${suggestion.lat.toFixed(4)}, ${suggestion.lng.toFixed(4)}`
                                : "Click to calculate distance"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <FieldError error={errors.destination} />
                </div>

                {/* Trip Estimate */}
                {tripEstimate && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <Navigation className="h-4 w-4" />
                        Trip Estimate
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTripEstimate(null);
                          setFormData((prev) => ({
                            ...prev,
                            estimated_distance_km: "",
                            estimated_fuel_liters: "",
                            estimated_cost: "",
                          }));
                        }}
                        className="h-6 px-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
                        <p className="font-bold text-blue-700 dark:text-blue-300 text-lg">
                          {tripEstimate.distance_km} km
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                        <p className="font-bold text-blue-700 dark:text-blue-300 text-lg flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {tripEstimate.duration_minutes} mins
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Fuel</p>
                        <p className="font-bold text-blue-700 dark:text-blue-300 text-lg flex items-center gap-1">
                          <Fuel className="h-3 w-3" />
                          {tripEstimate.estimated_liters} L
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Cost</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 text-lg flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ₱{tripEstimate.estimated_cost}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-3 flex items-center gap-2">
                      <Gauge className="h-3 w-3" />
                      Based on {tripEstimate.fuel_efficiency_km_per_liter} km/L @ ₱{tripEstimate.fuel_price_per_liter}/L
                    </div>
                  </div>
                )}
              </div>
            </FormSection>

            {/* Department & Assignment Section */}
            <FormSection title="Assignment" icon={Building2}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department */}
                <div>
                  <Label htmlFor="department_id">
                    Department <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.department_id?.toString() || undefined}
                    onValueChange={(value) => handleChange("department_id", value)}
                  >
                    <SelectTrigger
                      className={cn(
                        hasError("department_id") && "border-red-500 ring-red-500"
                      )}
                    >
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem
                          key={dept.department_id}
                          value={dept.department_id.toString()}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {dept.department_name} ({dept.department_code})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.department_id} />
                </div>

                {/* Vehicle */}
                <div>
                  <Label htmlFor="vehicle_id">
                    Vehicle <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.vehicle_id?.toString() || undefined}
                    onValueChange={(value) => handleChange("vehicle_id", value)}
                    onOpenChange={() => handleFieldBlur("vehicle_id")}
                  >
                    <SelectTrigger
                      className={cn(
                        hasError("vehicle_id") && "border-red-500 ring-red-500"
                      )}
                    >
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehicles.length === 0 ? (
                        <SelectItem value="no-vehicle" disabled>
                          No vehicles available
                        </SelectItem>
                      ) : (
                        availableVehicles.map((vehicle) => (
                          <SelectItem
                            key={vehicle.vehicle_id}
                            value={vehicle.vehicle_id.toString()}
                          >
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              {vehicle.plate_number} - {vehicle.vehicle_model}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.vehicle_id} />
                </div>

                {/* Driver */}
                <div>
                  <Label htmlFor="driver_id">
                    Driver <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.driver_id?.toString() || undefined}
                    onValueChange={(value) => handleChange("driver_id", value)}
                    onOpenChange={() => handleFieldBlur("driver_id")}
                  >
                    <SelectTrigger
                      className={cn(
                        hasError("driver_id") && "border-red-500 ring-red-500"
                      )}
                    >
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDrivers.length === 0 ? (
                        <SelectItem value="no-driver" disabled>
                          No drivers available
                        </SelectItem>
                      ) : (
                        availableDrivers.map((driver) => (
                          <SelectItem
                            key={driver.driver_id || driver.id || driver.user_id}
                            value={(
                              driver.driver_id ||
                              driver.id ||
                              driver.user_id
                            ).toString()}
                          >
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {driver.full_name ||
                                driver.user?.full_name ||
                                driver.name ||
                                "Unnamed Driver"}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.driver_id} />
                </div>

                {/* Trip Date */}
                <div>
                  <Label htmlFor="trip_date">
                    Trip Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="trip_date"
                    type="date"
                    value={formData.trip_date}
                    onChange={(e) => handleChange("trip_date", e.target.value)}
                    onBlur={() => handleFieldBlur("trip_date")}
                    className={cn(
                      hasError("trip_date") && "border-red-500 ring-red-500"
                    )}
                  />
                  <FieldError error={errors.trip_date} />
                </div>
              </div>
            </FormSection>

            {/* Vehicle Details Preview */}
            {selectedVehicle && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-300">
                  <Truck className="h-4 w-4" />
                  Selected Vehicle
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Plate Number</p>
                    <p className="font-medium text-blue-700 dark:text-blue-300">
                      {selectedVehicle.plate_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Model</p>
                    <p className="font-medium text-blue-700 dark:text-blue-300">
                      {selectedVehicle.vehicle_model}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Fuel Type</p>
                    <Badge variant="outline" className="border-blue-300 dark:border-blue-700">
                      {selectedVehicle.fuel_type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <Badge
                      className={
                        selectedVehicle.status === "active"
                          ? "bg-emerald-500"
                          : "bg-yellow-500"
                      }
                    >
                      {selectedVehicle.status}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Purpose & Passenger */}
            <FormSection title="Additional Details" icon={FileText}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="purpose">
                    Purpose <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="purpose"
                    placeholder="Describe the purpose of this trip..."
                    value={formData.purpose}
                    onChange={(e) => handleChange("purpose", e.target.value)}
                    onBlur={() => handleFieldBlur("purpose")}
                    rows={3}
                    className={cn(
                      hasError("purpose") && "border-red-500 ring-red-500"
                    )}
                  />
                  <FieldError error={errors.purpose} />
                </div>

                <div>
                  <Label htmlFor="passenger_name">Passenger Name (Optional)</Label>
                  <Input
                    id="passenger_name"
                    placeholder="Name of passenger"
                    value={formData.passenger_name}
                    onChange={(e) => handleChange("passenger_name", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="charge_to">Charge To</Label>
                  <Input
                    id="charge_to"
                    value={formData.charge_to || ""}
                    disabled
                    className="bg-gray-100 dark:bg-gray-700 cursor-not-allowed font-mono"
                    placeholder="Auto-filled from department"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Automatically set to the selected department's code
                  </p>
                </div>
              </div>
            </FormSection>

            {/* Department Info Alert */}
            {selectedDepartment && (
              <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription>
                  Creating trip for <strong>{selectedDepartment.department_name}</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Submit */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
              <Button
                variant="outline"
                onClick={() => navigate("/gso/dashboard")}
                type="button"
                className="dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTripMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                {createTripMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create Trip Ticket
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default GsoCreateTrip;