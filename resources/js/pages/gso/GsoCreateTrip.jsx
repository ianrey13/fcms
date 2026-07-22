// src/pages/gso/GsoCreateTrip.jsx
import React, { useState, useEffect } from "react";
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
  Clock,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { debounce } from "lodash";

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

  // ============ LOOKUP STATE ============
  const [lookupType, setLookupType] = useState("employee");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [showNotFound, setShowNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // ============ DISTANCE/ESTIMATE STATE ============
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [tripEstimate, setTripEstimate] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const originAddress = "Laguindingan Municipal Hall";

  // Fetch departments
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

  // Fetch vehicles
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const response = await vehicleAPI.getAll();
      const data = response.data?.data || response.data || [];
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      try {
        const response = await driverManagementAPI.getAll();
        let driversData = response.data?.data || response.data || [];
        const driversArray = Array.isArray(driversData) ? driversData : [];
        return driversArray;
      } catch (error) {
        console.error("Error fetching drivers:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // ============ DESTINATION SEARCH (AUTOCOMPLETE) ============
  const searchDestinations = debounce(async (query) => {
    if (query.length < 2) {
      setDestinationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await locationAPI.searchPlaces(query);
      console.log("🔍 Search results:", response.data);

      if (response.data.success && response.data.predictions) {
        // Filter out region-level results
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
  }, 300);

  // ============ CALCULATE DISTANCE & FUEL ============
  const calculateTripEstimate = async (destination) => {
    if (!destination || destination.length < 2) return;

    setIsCalculating(true);
    try {
      const response = await locationAPI.calculateDistance({
        origin: originAddress,
        destination: destination,
        vehicle_id: formData.vehicle_id || undefined,
      });

      console.log("📏 Distance result:", response.data);

      if (response.data.success) {
        const data = response.data;
        setTripEstimate(data);

        // Auto-fill form fields
        setFormData((prev) => ({
          ...prev,
          estimated_distance_km: data.distance_km,
          estimated_fuel_liters: data.estimated_liters,
          estimated_cost: data.estimated_cost,
        }));

        toast.success(`Trip estimate calculated: ${data.distance_km} km, ${data.estimated_liters} L fuel`);
      } else {
        toast.error(response.data.message || "Failed to calculate distance");
      }
    } catch (error) {
      console.error("Distance calculation error:", error);
      toast.error("Failed to calculate distance. Please enter manually.");
    } finally {
      setIsCalculating(false);
    }
  };

  // ============ HANDLE DESTINATION SELECTION ============
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
    searchDestinations(value);
  };

  const clearDestination = () => {
    setFormData((prev) => ({ ...prev, destination: "" }));
    setTripEstimate(null);
    setSelectedLocation(null);
    setDestinationSuggestions([]);
    setShowSuggestions(false);
  };

  // ============ AUTO-FILL FUNCTIONS ============
  const autoFillFormFromEmployee = (employee) => {
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

    let message = `Found: ${employee.full_name} (${employee.employee_number || employee.email})`;
    if (matchedDriver) {
      message += `\nDriver auto-assigned: ${matchedDriver.full_name || matchedDriver.user?.full_name || "Assigned"}`;
    } else {
      message += `\nNo driver record found. Please assign a driver manually.`;
    }
    if (firstVehicle) {
      message += `\nVehicle auto-selected: ${firstVehicle.plate_number}`;
    } else {
      message += `\nNo active vehicle found. Please select one manually.`;
    }

    setLookupResult({
      type: "employee",
      data: employee,
      message: message,
      matchedDriver: matchedDriver,
      matchedVehicle: firstVehicle,
    });
  };

  const autoFillFormFromVehicle = (vehicle) => {
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
      message: `Found: ${vehicle.plate_number} (${vehicle.vehicle_model})`,
    });
  };

  // ============ LOOKUP FUNCTION ============
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
        const response = await userAPI.getAll({
          search: lookupValue,
        });
        const users = response.data?.data || [];

        const filteredUsers = users.filter(
          (u) => u.role === "staff" || u.role === "driver" || u.role === "mayors_office" || u.role === "gso_office"
        );

        if (filteredUsers.length === 0) {
          setShowNotFound(true);
          setIsSearching(false);
          return;
        }

        const foundUser = filteredUsers[0];
        autoFillFormFromEmployee(foundUser);
        setShowNotFound(false);
      } else if (lookupType === "plate") {
        const response = await vehicleAPI.getAll({ search: lookupValue });
        const vehiclesData = response.data?.data || [];

        if (vehiclesData.length === 0) {
          setShowNotFound(true);
          setIsSearching(false);
          return;
        }

        const foundVehicle = vehiclesData[0];
        autoFillFormFromVehicle(foundVehicle);
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

  // Re-calculate estimate when vehicle changes (for fuel efficiency)
  useEffect(() => {
    if (formData.destination && formData.vehicle_id) {
      // Re-calculate with new vehicle efficiency
      calculateTripEstimate(formData.destination);
    }
  }, [formData.vehicle_id]);

  // ============ VALIDATION ============
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
    if (!formData.charge_to) {
      newErrors.charge_to = "Charge To is required";
      newTouched.charge_to = true;
    }

    setErrors(newErrors);
    setTouched(newTouched);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Create trip mutation
  const createTripMutation = useMutation({
    mutationFn: async (data) => {
      const response = await gsoAPI.createTrip(data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Trip ticket created successfully!");
      queryClient.invalidateQueries({ queryKey: ["gso"] });
      navigate("/gso/all-trips");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create trip");
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    createTripMutation.mutate(formData);
  };

  const isLoading = deptsLoading || vehiclesLoading || driversLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Create Trip Ticket
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          GSO creates trip ticket directly for staff or requestor
        </p>
      </div>

      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Trip Ticket Information
          </CardTitle>
          <CardDescription>
            All fields marked with <span className="text-red-500">*</span> are required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* LOOKUP SECTION */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Search className="h-4 w-4 text-blue-600" />
                Find Employee or Vehicle
              </h3>
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

              {lookupResult && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                        <CheckCircle className="h-4 w-4" />
                        <span className="whitespace-pre-line text-sm">
                          {lookupResult.message}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {lookupResult.type === "employee" && (
                          <>
                            <div>
                              <span className="font-medium">Department:</span>{" "}
                              {lookupResult.data.department_name || "N/A"}
                            </div>
                            {lookupResult.matchedDriver ? (
                              <div className="text-green-600 dark:text-green-400">
                                <span className="font-medium">Driver:</span>{" "}
                                {lookupResult.matchedDriver.full_name || 
                                 lookupResult.matchedDriver.user?.full_name || 
                                 "Auto-assigned"}
                              </div>
                            ) : (
                              <div className="text-yellow-600 dark:text-yellow-400">
                                No driver record found. Please assign manually.
                              </div>
                            )}
                            {lookupResult.matchedVehicle ? (
                              <div className="text-green-600 dark:text-green-400">
                                <span className="font-medium">Vehicle:</span>{" "}
                                {lookupResult.matchedVehicle.plate_number} - {lookupResult.matchedVehicle.vehicle_model}
                              </div>
                            ) : (
                              <div className="text-yellow-600 dark:text-yellow-400">
                                No active vehicle found. Please select manually.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearLookup}
                      className="text-gray-400 hover:text-gray-600 h-6 px-2 flex-shrink-0"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              {showNotFound && (
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
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
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-red-700 dark:text-red-300">{lookupError}</p>
                </div>
              )}
            </div>

            {/* ============ DESTINATION WITH AUTOCOMPLETE ============ */}
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
                  className={`pl-10 pr-10 ${hasError("destination") ? "border-red-500 ring-red-500" : ""}`}
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

              {/* Autocomplete Suggestions */}
              {showSuggestions && destinationSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {destinationSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSelectDestination(suggestion)}
                      className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer flex items-start gap-2"
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

              {hasError("destination") && (
                <p className="text-red-500 text-sm mt-1">{errors.destination}</p>
              )}
            </div>

            {/* ============ TRIP ESTIMATE DISPLAY ============ */}
            {tripEstimate && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <Fuel className="h-4 w-4" />
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
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
                    <p className="font-semibold text-blue-700 dark:text-blue-300 text-lg">
                      {tripEstimate.distance_km} km
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                    <p className="font-semibold text-blue-700 dark:text-blue-300 text-lg flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {tripEstimate.duration_minutes} mins
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Fuel</p>
                    <p className="font-semibold text-blue-700 dark:text-blue-300 text-lg flex items-center gap-1">
                      <Fuel className="h-3 w-3" />
                      {tripEstimate.estimated_liters} L
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Cost</p>
                    <p className="font-semibold text-green-600 dark:text-green-400 text-lg flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ₱{tripEstimate.estimated_cost}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Based on {tripEstimate.fuel_efficiency_km_per_liter} km/L @ ₱{tripEstimate.fuel_price_per_liter}/L
                </div>
              </div>
            )}

            {/* ============ HIDDEN FIELDS FOR ESTIMATES ============ */}
            <input
              type="hidden"
              name="estimated_distance_km"
              value={formData.estimated_distance_km || ""}
            />
            <input
              type="hidden"
              name="estimated_fuel_liters"
              value={formData.estimated_fuel_liters || ""}
            />
            <input
              type="hidden"
              name="estimated_cost"
              value={formData.estimated_cost || ""}
            />

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
                  className={hasError("department_id") ? "border-red-500 ring-red-500" : ""}
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
              {hasError("department_id") && (
                <p className="text-red-500 text-sm mt-1">{errors.department_id}</p>
              )}
            </div>

            {/* Vehicle & Driver */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className={hasError("vehicle_id") ? "border-red-500 ring-red-500" : ""}
                  >
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.length === 0 ? (
                      <SelectItem value="no-vehicle" disabled>
                        No vehicles available for this department
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
                {hasError("vehicle_id") && (
                  <p className="text-red-500 text-sm mt-1">{errors.vehicle_id}</p>
                )}
              </div>

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
                    className={hasError("driver_id") ? "border-red-500 ring-red-500" : ""}
                  >
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrivers.length === 0 ? (
                      <SelectItem value="no-driver" disabled>
                        No drivers available for this department
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
                {hasError("driver_id") && (
                  <p className="text-red-500 text-sm mt-1">{errors.driver_id}</p>
                )}
              </div>
            </div>

            {/* Selected Vehicle Details */}
            {selectedVehicle && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-800 dark:text-blue-300">
                  <Truck className="h-4 w-4" />
                  Selected Vehicle
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Plate Number</p>
                    <p className="font-medium">{selectedVehicle.plate_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Model</p>
                    <p className="font-medium">{selectedVehicle.vehicle_model}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Fuel Type</p>
                    <Badge variant="outline">{selectedVehicle.fuel_type}</Badge>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <Badge
                      className={
                        selectedVehicle.status === "active"
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }
                    >
                      {selectedVehicle.status}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Trip Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className={hasError("trip_date") ? "border-red-500 ring-red-500" : ""}
                />
                {hasError("trip_date") && (
                  <p className="text-red-500 text-sm mt-1">{errors.trip_date}</p>
                )}
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
            </div>

            {/* Purpose */}
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
                className={hasError("purpose") ? "border-red-500 ring-red-500" : ""}
              />
              {hasError("purpose") && (
                <p className="text-red-500 text-sm mt-1">{errors.purpose}</p>
              )}
            </div>

            {/* Charge To */}
            <div>
              <Label htmlFor="charge_to">
                Charge To <span className="text-red-500">*</span>
              </Label>
              <Input
                id="charge_to"
                value={formData.charge_to || ""}
                disabled
                className="bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                placeholder="Auto-filled from department"
              />
              <p className="text-xs text-gray-500 mt-1">
                Automatically set to the selected department's code
              </p>
              {hasError("charge_to") && (
                <p className="text-red-500 text-sm mt-1">{errors.charge_to}</p>
              )}
            </div>

            {/* Department Info */}
            {selectedDepartment && (
              <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <Building2 className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  Creating trip for <strong>{selectedDepartment.department_name}</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => navigate("/gso/dashboard")}
                type="button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTripMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
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