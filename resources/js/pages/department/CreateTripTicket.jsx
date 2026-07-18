// src/pages/department/CreateTripTicket.jsx - TanStack Query Version (FULL CODE)
import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useDrivers,
  useAvailableVehicles,
  useDepartmentBudgetForForm,
  useFuelPrices,
  useLocationSearch,
  useCalculateDistance,
  useSubmitTripTicket,
  useResubmitTripTicket,
  useSaveDraft,
  useCheckBudgetAndRequestMO,
  isWithinCurrentWeek,
  isPastDate,
  getFuelPriceByType,
} from "../../hooks/useTripTicket";
import { useEditTicketData } from "../../hooks/useEditTicketData";
import { debounce } from "lodash";
import {
  FileText,
  Save,
  Send,
  Truck,
  User,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Fuel,
  Route,
  Building2,
  Loader2,
  X,
  Phone,
  Info,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "react-hot-toast";

const CreateTripTicket = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're in edit/resubmit mode
  const searchParams = new URLSearchParams(location.search);
  const isEditMode = searchParams.get("mode") === "edit";
  const editTicketId = searchParams.get("id");

  // Get department ID and name
  const departmentId = user?.department_id || user?.department?.department_id;
  const departmentName = user?.department_name || user?.department?.department_name || "";

  // ✅ TanStack Query hooks
  const { data: drivers = [], isLoading: driversLoading } = useDrivers(departmentId);
  const { data: vehicles = [], isLoading: vehiclesLoading } = useAvailableVehicles(departmentId);
  const { data: departmentBudget, isLoading: budgetLoading } = useDepartmentBudgetForForm();
  const { data: fuelPrices, isLoading: fuelPricesLoading } = useFuelPrices();
  
  // Mutations
  const submitTrip = useSubmitTripTicket();
  const resubmitTrip = useResubmitTripTicket();
  const saveDraft = useSaveDraft();
  const checkBudget = useCheckBudgetAndRequestMO();
  const calculateDistanceMutation = useCalculateDistance();

  // Use edit ticket data hook
  const { isResubmitMode, editFormData } = useEditTicketData(isEditMode, editTicketId, departmentName);

  // Form state
  const [formData, setFormData] = useState({
    driver_id: "",
    vehicle_id: "",
    trip_date: "",
    destination: "",
    purpose: "",
    charge_to: departmentName,
    passenger_name: "",
    estimated_fuel_liters: "",
    estimated_distance_km: "",
  });

  // Local UI state
  const [errors, setErrors] = useState({});
  const [locationQuery, setLocationQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showMOAssistanceModal, setShowMOAssistanceModal] = useState(false);
  const [moAssistanceData, setMoAssistanceData] = useState(null);
  
  const suggestionsRef = useRef(null);
  const originAddress = "LGU Building Laguindingan";

  // Load edit data into form
  useEffect(() => {
    if (editFormData) {
      setFormData(prev => ({ ...prev, ...editFormData }));
    }
  }, [editFormData]);

  // Set charge_to when department name loads
  useEffect(() => {
    if (departmentName && !formData.charge_to) {
      setFormData(prev => ({ ...prev, charge_to: departmentName }));
    }
  }, [departmentName]);

  // Update selected vehicle when vehicle_id changes
  useEffect(() => {
    if (formData.vehicle_id && vehicles.length > 0) {
      const vehicle = vehicles.find(
        (v) => (v.vehicle_id || v.id) === parseInt(formData.vehicle_id)
      );
      setSelectedVehicle(vehicle);
    } else {
      setSelectedVehicle(null);
    }
  }, [formData.vehicle_id, vehicles]);

  // Update selected driver when driver_id changes
  useEffect(() => {
    if (formData.driver_id && drivers.length > 0) {
      const driver = drivers.find(
        (d) => (d.driver_id || d.id) === parseInt(formData.driver_id)
      );
      setSelectedDriver(driver);
    } else {
      setSelectedDriver(null);
    }
  }, [formData.driver_id, drivers]);

  // Debounced location search
  const searchLocations = useCallback(
    debounce((query) => {
      setLocationQuery(query);
    }, 500),
    []
  );

  // Location search query
  const { data: locationSuggestions = [] } = useLocationSearch(locationQuery);

  const handleDestinationChange = (value) => {
    setFormData((prev) => ({ ...prev, destination: value }));
    searchLocations(value);
    if (errors.destination) {
      setErrors((prev) => ({ ...prev, destination: "" }));
    }
  };

  const calculateDistance = async (destinationName, coordinates = null) => {
    if (!destinationName || destinationName.length < 3) return;

    setCalculatingDistance(true);
    try {
      const params = {
        name: destinationName,
        vehicle_type: selectedVehicle?.fuel_type === "diesel" ? "truck" : "car",
        fuel_price: fuelPrices ? getFuelPriceByType(selectedVehicle?.fuel_type, fuelPrices) : 55.0,
      };

      if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
        params.lng = coordinates[0];
        params.lat = coordinates[1];
      }

      const data = await calculateDistanceMutation.mutateAsync(params);

      if (data) {
        setDistanceInfo(data);

        if (data.estimated_fuel_liters && !isNaN(data.estimated_fuel_liters)) {
          const fuelLiters = typeof data.estimated_fuel_liters === "number"
            ? data.estimated_fuel_liters
            : parseFloat(data.estimated_fuel_liters);
          setFormData((prev) => ({
            ...prev,
            estimated_fuel_liters: fuelLiters.toFixed(1),
          }));
        }

        let distanceValue = null;
        if (data.round_trip_km) {
          distanceValue = data.round_trip_km;
        } else if (data.total_distance_km) {
          distanceValue = data.total_distance_km;
        } else if (data.distance_km) {
          distanceValue = data.distance_km * 2;
        }

        if (distanceValue && !isNaN(distanceValue)) {
          const distanceNum = typeof distanceValue === "number"
            ? distanceValue
            : parseFloat(distanceValue);
          setFormData((prev) => ({
            ...prev,
            estimated_distance_km: distanceNum.toFixed(1),
          }));
        } else if (data.distance_km && !isNaN(data.distance_km)) {
          const roundTrip = data.distance_km * 2;
          setFormData((prev) => ({
            ...prev,
            estimated_distance_km: roundTrip.toFixed(1),
          }));
        }

        if (data.calculation_method === "fallback_estimate") {
          toast.success(`📍 Approximate distance: ${data.distance_text}`);
        } else {
          const roundTrip = data.round_trip_km || data.distance_km * 2;
          toast.success(`📍 ${data.distance_text} (${roundTrip.toFixed(1)} km round trip)`);
        }
      }
    } catch (error) {
      console.error("Error calculating distance:", error);
      setFormData((prev) => ({
        ...prev,
        estimated_distance_km: "",
        estimated_fuel_liters: "",
      }));
    } finally {
      setCalculatingDistance(false);
    }
  };

  const selectSuggestion = async (suggestion) => {
    setFormData((prev) => ({ ...prev, destination: suggestion.name }));
    setShowSuggestions(false);
    setLocationQuery("");
    await calculateDistance(suggestion.name, suggestion.coordinates);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.driver_id) newErrors.driver_id = "Please select a driver";
    if (!formData.vehicle_id) newErrors.vehicle_id = "Please select a vehicle";
    if (!formData.trip_date) newErrors.trip_date = "Please select trip date";
    if (!formData.destination) newErrors.destination = "Please enter destination";
    if (!formData.purpose) newErrors.purpose = "Please enter trip purpose";

    if (formData.trip_date && typeof formData.trip_date === "string" && formData.trip_date.trim() !== "") {
      const tripDateObj = new Date(formData.trip_date);

      if (isNaN(tripDateObj.getTime())) {
        newErrors.trip_date = "Invalid date format";
      } else if (isPastDate(formData.trip_date)) {
        newErrors.trip_date = "Trip date cannot be in the past";
      } else if (!isWithinCurrentWeek(formData.trip_date)) {
        newErrors.trip_date = "Trip tickets can only be created for dates within the current week (Monday to Sunday).";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createPayload = () => {
    const driverId = formData.driver_id ? parseInt(formData.driver_id) : null;
    const vehicleId = formData.vehicle_id ? parseInt(formData.vehicle_id) : null;

    return {
      driver_id: driverId,
      vehicle_id: vehicleId,
      trip_date: formData.trip_date || null,
      destination: formData.destination || null,
      purpose: formData.purpose || null,
      charge_to: formData.charge_to || null,
      passenger_name: formData.passenger_name || null,
      estimated_fuel_liters: formData.estimated_fuel_liters ? parseFloat(formData.estimated_fuel_liters) : null,
      estimated_distance_km: formData.estimated_distance_km ? parseFloat(formData.estimated_distance_km) : null,
    };
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      const firstError = document.querySelector(".error-message");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const payload = createPayload();
    let budgetWarningData = null;

    // Check budget for warning purposes only
    try {
      const checkResponse = await checkBudget.mutateAsync(payload);
      if (checkResponse.data && !checkResponse.data.can_proceed) {
        budgetWarningData = {
          budget: checkResponse.data.budget,
          estimated_cost: checkResponse.data.estimated_cost,
          shortage: checkResponse.data.shortage,
          request_id: checkResponse.data.request_id,
          message: checkResponse.data.message,
        };
      }
    } catch (budgetError) {
      console.warn("Budget check failed, but continuing with submission:", budgetError);
    }

    try {
      let submitResponse;
      
      if (isResubmitMode && editTicketId) {
        submitResponse = await resubmitTrip.mutateAsync({ id: editTicketId, payload });
      } else {
        submitResponse = await submitTrip.mutateAsync(payload);
      }

      if (submitResponse.data.success) {
        if (budgetWarningData) {
          setMoAssistanceData(budgetWarningData);
          setShowMOAssistanceModal(true);
          toast.success(
            "⚠️ Trip ticket submitted with INSUFFICIENT BUDGET warning.\n" +
              "The ticket will still proceed through the approval workflow.\n" +
              "Mayor's Office will be notified.",
            { duration: 6000 }
          );
        } else {
          toast.success(
            isResubmitMode
              ? "✓ Trip ticket resubmitted successfully! It has been sent to your Department Head for approval."
              : "✓ Trip ticket submitted successfully! It has been sent to your Department Head for approval."
          );
          setTimeout(() => navigate("/department/requests"), 1500);
        }
      }
    } catch (error) {
      // Error already handled by mutation onError
    }
  };

  const handleSaveDraft = async () => {
    // Validation checks
    if (!formData.driver_id) {
      toast.error("Please select a driver before saving draft");
      return;
    }
    if (!formData.vehicle_id) {
      toast.error("Please select a vehicle before saving draft");
      return;
    }
    if (!formData.trip_date) {
      toast.error("Please select a trip date before saving draft");
      return;
    }
    if (!formData.destination) {
      toast.error("Please enter a destination before saving draft");
      return;
    }
    if (!formData.purpose) {
      toast.error("Please enter a purpose before saving draft");
      return;
    }

    const payload = createPayload();
    await saveDraft.mutateAsync(payload);
    navigate("/department/requests");
  };

  const budgetStatus = useMemo(() => {
    if (!departmentBudget) return null;
    const remaining = departmentBudget.remaining_budget || 0;
    const allocated = departmentBudget.allocated_amount || 0;
    const used = allocated - remaining;
    const usedPercentage = allocated > 0 ? (used / allocated) * 100 : 0;
    const remainingPercentage = allocated > 0 ? (remaining / allocated) * 100 : 0;

    return {
      remaining,
      used,
      usedPercentage,
      remainingPercentage,
      isLow: remainingPercentage < 20,
      isCritical: remainingPercentage < 10,
    };
  }, [departmentBudget]);

  const estimatedCost = useMemo(() => {
    if (!formData.estimated_fuel_liters || parseFloat(formData.estimated_fuel_liters) <= 0) return 0;
    const fuelPrice = selectedVehicle?.fuel_type && fuelPrices 
      ? getFuelPriceByType(selectedVehicle.fuel_type, fuelPrices) 
      : 55.0;
    return parseFloat(formData.estimated_fuel_liters) * fuelPrice;
  }, [formData.estimated_fuel_liters, selectedVehicle, fuelPrices]);

  const isLoading = driversLoading || vehiclesLoading || budgetLoading || fuelPricesLoading;

  // MO Assistance Modal Component
  const MOAssistanceModal = () => {
    const handleClose = () => {
      setShowMOAssistanceModal(false);
      setTimeout(() => {
        navigate("/department/requests");
      }, 500);
    };

    const handleViewBudget = () => {
      setShowMOAssistanceModal(false);
      navigate("/department/budget-status");
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Insufficient Budget Notice
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-300">
                Your department does not have enough budget for this trip. However, your trip ticket has been submitted and will proceed through the normal approval workflow.
              </p>

              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Remaining Budget:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ₱{moAssistanceData?.budget?.remaining?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Estimated Cost:</span>
                    <span className="font-semibold">
                      ₱{moAssistanceData?.estimated_cost?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-600">
                    <span className="text-slate-500">Shortage:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ₱{moAssistanceData?.shortage?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </div>

              {moAssistanceData?.budget?.allocated > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Budget Utilization</span>
                    <span>
                      {Math.round(((moAssistanceData.budget.allocated -
                        moAssistanceData.budget.remaining) /
                        moAssistanceData.budget.allocated) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(((moAssistanceData.budget.allocated -
                          moAssistanceData.budget.remaining) /
                          moAssistanceData.budget.allocated) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">⚠️ Insufficient Budget Notice</p>
                    <p>
                      Your trip ticket has been submitted with INSUFFICIENT BUDGET notification.
                      The Mayor's Office will be notified and will decide which department's budget
                      to charge upon fund release.
                    </p>
                    <p className="text-xs mt-2 text-blue-600 dark:text-blue-400">
                      ✓ Your ticket will still proceed through the normal approval workflow
                    </p>
                    <p className="text-xs mt-1 text-blue-500 dark:text-blue-400">
                      Request ID: {moAssistanceData?.request_id}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  Need assistance? Contact Mayor's Office at
                  <span className="inline-flex items-center gap-1 ml-1">
                    <Phone className="h-3 w-3" />
                    <span>(088) 123-4567</span>
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleClose} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                <CheckCircle className="h-4 w-4 mr-2" />
                OK, Continue
              </Button>
              <Button variant="outline" onClick={handleViewBudget} className="flex-1 dark:border-slate-700 dark:text-slate-300">
                View Budget Details
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
        <div className="max-w-4xl mx-auto animate-fade-in-up">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                {isResubmitMode ? (
                  <RotateCcw className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                ) : (
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                {isResubmitMode ? "Resubmit Trip Ticket" : "Create Trip Ticket"}
              </h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 ml-12">
              {isResubmitMode
                ? "Make corrections to your returned trip ticket and resubmit for approval."
                : "Fill out the form below to request a trip ticket for official travel"}
            </p>
          </div>

          {/* Resubmit Banner */}
          {isResubmitMode && (
            <Alert className="mb-6 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                You are editing a returned ticket. Please review the rejection reason, make necessary corrections, and resubmit.
              </AlertDescription>
            </Alert>
          )}

          {/* Department Info Bar */}
          <div className="mb-6 p-4 bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Department:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {departmentName || "N/A"}
                  </strong>
                </span>
              </div>
              {departmentBudget && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Weekly Budget Remaining:{" "}
                    <strong
                      className={
                        budgetStatus?.isCritical
                          ? "text-red-600 dark:text-red-400"
                          : budgetStatus?.isLow
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      ₱{budgetStatus?.remaining?.toLocaleString() || 0}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Budget Alert */}
          {budgetStatus && budgetStatus.isLow && !isResubmitMode && (
            <Alert
              className={`mb-6 ${budgetStatus.isCritical
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
              }`}
            >
              <AlertCircle
                className={`h-4 w-4 ${budgetStatus.isCritical
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
                }`}
              />
              <AlertDescription
                className={
                  budgetStatus.isCritical
                    ? "text-red-800 dark:text-red-300"
                    : "text-amber-800 dark:text-amber-300"
                }
              >
                {budgetStatus.isCritical
                  ? `⚠️ CRITICAL: Only ₱${budgetStatus.remaining.toLocaleString()} remaining (${Math.round(budgetStatus.remainingPercentage)}% of weekly budget)! Please coordinate with your department head.`
                  : `⚠️ Low budget alert: Only ₱${budgetStatus.remaining.toLocaleString()} remaining (${Math.round(budgetStatus.remainingPercentage)}% of budget left this week).`}
              </AlertDescription>
            </Alert>
          )}

          {/* Main Form Card */}
          <Card className="shadow-xl border-0 dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 rounded-t-xl">
              <CardTitle className="text-slate-900 dark:text-white">Trip Ticket Information</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                All fields marked with <span className="text-red-500">*</span> are required
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Row 1: Trip Date & Destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    Trip Date <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      name="trip_date"
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      className={`pl-10 dark:bg-slate-900 dark:border-slate-700 ${errors.trip_date ? "border-red-500" : ""}`}
                      value={formData.trip_date}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.trip_date && (
                    <p className="text-red-500 text-sm mt-1 error-message">{errors.trip_date}</p>
                  )}
                </div>

                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    Destination <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="e.g., Cagayan de Oro City Hall, Provincial Capitol"
                        className={`pl-10 dark:bg-slate-900 dark:border-slate-700 ${errors.destination ? "border-red-500" : ""}`}
                        value={formData.destination}
                        onChange={(e) => handleDestinationChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      />
                      {calculatingDistance && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => calculateDistance(formData.destination)}
                      disabled={calculatingDistance || !formData.destination}
                      className="px-3 dark:border-slate-700"
                    >
                      <RefreshCw className={`h-4 w-4 ${calculatingDistance ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  {errors.destination && (
                    <p className="text-red-500 text-sm mt-1 error-message">{errors.destination}</p>
                  )}
                </div>
              </div>

              {/* Autocomplete Suggestions */}
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="relative z-10 -mt-2">
                  <div className="absolute top-0 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {locationSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectSuggestion(suggestion)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{suggestion.name}</p>
                          <p className="text-xs text-slate-400">{suggestion.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Distance Info Card */}
              {distanceInfo && (
                <div
                  className={`rounded-xl p-4 border ${
                    distanceInfo.calculation_method === "fallback_estimate"
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                      : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800"
                  } animate-fade-in`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        distanceInfo.calculation_method === "fallback_estimate"
                          ? "bg-amber-100 dark:bg-amber-800/50"
                          : "bg-blue-100 dark:bg-blue-800/50"
                      }`}
                    >
                      <Route
                        className={`h-5 w-5 ${
                          distanceInfo.calculation_method === "fallback_estimate"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">Route Information</h4>
                        {distanceInfo.calculation_method === "fallback_estimate" && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                            ⚠️ Approximate
                          </Badge>
                        )}
                        {distanceInfo.calculation_method === "gps_route" && (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                            ✓ GPS Route
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">From</p>
                          <p className="font-medium text-slate-700 dark:text-slate-300">
                            {originAddress}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">To</p>
                          <p className="font-medium text-slate-700 dark:text-slate-300">
                            {distanceInfo.destination}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Distance</p>
                          <p className="font-semibold text-blue-600 dark:text-blue-400">
                            {distanceInfo.distance_text}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Est. Fuel</p>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {distanceInfo.estimated_fuel_liters} L
                          </p>
                        </div>
                      </div>
                      {distanceInfo.note && (
                        <p className="text-xs text-slate-400 mt-2 italic">{distanceInfo.note}</p>
                      )}
                      {distanceInfo.fuel_price_used && (
                        <p className="text-xs text-slate-400 mt-1">
                          *Based on fuel price: ₱{distanceInfo.fuel_price_used}/L
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Row 2: Purpose */}
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-medium">
                  Purpose of Trip <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  name="purpose"
                  placeholder="Describe the official purpose of this trip..."
                  rows={3}
                  className={errors.purpose ? "border-red-500 dark:bg-slate-900 dark:border-slate-700" : "dark:bg-slate-900 dark:border-slate-700"}
                  value={formData.purpose}
                  onChange={handleInputChange}
                />
                {errors.purpose && (
                  <p className="text-red-500 text-sm mt-1 error-message">{errors.purpose}</p>
                )}
              </div>

              {/* Row 3: Charge To & Passenger */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    Charge To <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={departmentName || "N/A"}
                    disabled
                    className="bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    This trip will be charged to your department
                  </p>
                </div>

                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    Passenger Name (Optional)
                  </Label>
                  <Input
                    name="passenger_name"
                    placeholder="Name of passenger if applicable"
                    value={formData.passenger_name}
                    onChange={handleInputChange}
                    className="dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Row 4: Vehicle & Driver */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    Select Vehicle <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.vehicle_id?.toString()}
                    onValueChange={(value) => handleSelectChange("vehicle_id", value)}
                  >
                    <SelectTrigger className={errors.vehicle_id ? "border-red-500 dark:bg-slate-900 dark:border-slate-700" : "dark:bg-slate-900 dark:border-slate-700"}>
                      <SelectValue placeholder="Choose a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem
                          key={vehicle.vehicle_id || vehicle.id}
                          value={(vehicle.vehicle_id || vehicle.id).toString()}
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            {vehicle.plate_number} - {vehicle.vehicle_model}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.vehicle_id && (
                    <p className="text-red-500 text-sm mt-1 error-message">{errors.vehicle_id}</p>
                  )}
                </div>

                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    Select Driver <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.driver_id?.toString()}
                    onValueChange={(value) => handleSelectChange("driver_id", value)}
                  >
                    <SelectTrigger className={errors.driver_id ? "border-red-500 dark:bg-slate-900 dark:border-slate-700" : "dark:bg-slate-900 dark:border-slate-700"}>
                      <SelectValue placeholder="Choose a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem
                          key={driver.driver_id || driver.id}
                          value={(driver.driver_id || driver.id).toString()}
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {driver.user?.full_name || driver.full_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.driver_id && (
                    <p className="text-red-500 text-sm mt-1 error-message">{errors.driver_id}</p>
                  )}
                </div>
              </div>

              {/* Selected Vehicle Details */}
              {selectedVehicle && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2 text-blue-800 dark:text-blue-300">
                      <Truck className="h-4 w-4" />
                      Selected Vehicle Details
                    </h4>
                    <Badge className={selectedVehicle.status === "active" ? "bg-emerald-500" : "bg-amber-500"}>
                      {selectedVehicle.status === "active" ? "Available" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Plate Number</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{selectedVehicle.plate_number}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Model</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{selectedVehicle.vehicle_model}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fuel Type</p>
                      <Badge variant="outline" className="mt-1">
                        {selectedVehicle.fuel_type?.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  {fuelPrices && selectedVehicle?.fuel_type && (
                    <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                      <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <Info className="h-3 w-3" />
                        <span>
                          Current {selectedVehicle.fuel_type} price: ₱{getFuelPriceByType(selectedVehicle.fuel_type, fuelPrices).toFixed(2)}/L
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selected Driver Details */}
              {selectedDriver && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 animate-fade-in">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <User className="h-4 w-4" />
                    Selected Driver Details
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Full Name</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        {selectedDriver.user?.full_name || selectedDriver.full_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Email</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        {selectedDriver.user?.email || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Status</p>
                      <Badge className="mt-1 bg-emerald-500">Active</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 5: Estimates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    Estimated Fuel (Liters) - Optional
                  </Label>
                  <div className="relative">
                    <Fuel className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 50.00"
                      className="pl-10 dark:bg-slate-900 dark:border-slate-700"
                      name="estimated_fuel_liters"
                      value={formData.estimated_fuel_liters}
                      onChange={handleInputChange}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Optional but recommended for budget planning
                  </p>
                </div>

                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    Estimated Distance (KM) - Optional
                  </Label>
                  <div className="relative">
                    <Route className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 150.00"
                      className="pl-10 dark:bg-slate-900 dark:border-slate-700"
                      name="estimated_distance_km"
                      value={formData.estimated_distance_km}
                      onChange={handleInputChange}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Estimated total distance for this trip
                  </p>
                </div>
              </div>

              {/* Fuel Cost Estimate */}
              {selectedVehicle &&
                formData.estimated_fuel_liters &&
                parseFloat(formData.estimated_fuel_liters) > 0 &&
                fuelPrices && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <h4 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Estimated Fuel Cost</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Estimated Liters</p>
                        <p className="font-medium text-slate-700 dark:text-slate-300">
                          {parseFloat(formData.estimated_fuel_liters).toFixed(2)} L
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Estimated Cost</p>
                        <p className="font-medium text-blue-600 dark:text-blue-400">
                          ₱{estimatedCost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          *Based on {selectedVehicle.fuel_type} fuel at ₱{getFuelPriceByType(selectedVehicle.fuel_type, fuelPrices).toFixed(2)}/L
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </CardContent>

            <CardFooter className="flex justify-end gap-4 border-t pt-6 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={saveDraft.isPending || submitTrip.isPending || resubmitTrip.isPending || checkBudget.isPending}
                className="gap-2 dark:border-slate-700 dark:text-slate-300"
              >
                {saveDraft.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveDraft.isPending ? "Saving..." : "Save as Draft"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saveDraft.isPending || submitTrip.isPending || resubmitTrip.isPending || checkBudget.isPending}
                className={`gap-2 ${
                  isResubmitMode
                    ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
                    : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                } shadow-md hover:shadow-lg transition-all duration-200`}
              >
                {(checkBudget.isPending || submitTrip.isPending || resubmitTrip.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isResubmitMode ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {checkBudget.isPending
                  ? "Checking Budget..."
                  : submitTrip.isPending || resubmitTrip.isPending
                    ? "Submitting..."
                    : isResubmitMode
                      ? "Resubmit Ticket"
                      : "Submit to Department Head"}
              </Button>
            </CardFooter>
          </Card>

          {/* Process Info */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-100 dark:border-blue-800">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <CheckCircle className="h-4 w-4" />
              What happens next?
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              {["Submit to Head", "Head Approval", "GSO Review", "Mayor's Office", "Fund Release", "Trip Execution"].map((step, idx) => (
                <div key={idx} className="text-center">
                  <div className={`w-8 h-8 ${
                    idx === 0 ? "bg-blue-100 dark:bg-blue-900/50" :
                    idx === 1 ? "bg-purple-100 dark:bg-purple-900/50" :
                    idx === 2 ? "bg-amber-100 dark:bg-amber-900/50" :
                    idx === 3 ? "bg-emerald-100 dark:bg-emerald-900/50" :
                    idx === 4 ? "bg-orange-100 dark:bg-orange-900/50" :
                    "bg-indigo-100 dark:bg-indigo-900/50"
                  } rounded-full flex items-center justify-center mx-auto mb-2`}>
                    <span className={`font-bold ${
                      idx === 0 ? "text-blue-600" :
                      idx === 1 ? "text-purple-600" :
                      idx === 2 ? "text-amber-600" :
                      idx === 3 ? "text-emerald-600" :
                      idx === 4 ? "text-orange-600" :
                      "text-indigo-600"
                    }`}>{idx + 1}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MO Assistance Modal */}
      {showMOAssistanceModal && <MOAssistanceModal />}
    </>
  );
};

export default CreateTripTicket;