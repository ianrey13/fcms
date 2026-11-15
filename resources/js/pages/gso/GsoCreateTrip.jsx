// src/pages/gso/GsoCreateTrip.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { gsoAPI, vehicleAPI, driverManagementAPI, adminDepartmentAPI, locationAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Truck, User, MapPin, Calendar, Building2, Loader2, CheckCircle,
    AlertTriangle, FileText, X, Navigation, Plus, Trash2, Search
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ============================================
// CONSTANTS
// ============================================
const ORIGIN_ADDRESS = "Laguindingan Municipal Hall";
const SEARCH_DEBOUNCE_MS = 500;
const MAX_STOPS = 5;
const SHARED_DEPARTMENT_CODES = ["MO"];

// ============================================
// CUSTOM SEARCHABLE SELECT COMPONENT
// ============================================
const SearchableSelect = ({ 
    label, icon: Icon, placeholder, options, value, onChange, 
    disabled, required, error, getOptionLabel, getOptionSubLabel, getOptionValue 
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const selectedOption = options.find(o => getOptionValue(o).toString() === value?.toString());

    // Sync search term with selected option
    useEffect(() => {
        if (selectedOption) {
            setSearchTerm(getOptionLabel(selectedOption));
        } else {
            setSearchTerm("");
        }
    }, [selectedOption, getOptionLabel]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm || (selectedOption && searchTerm === getOptionLabel(selectedOption))) {
            return []; // Don't show all by default if nothing typed
        }
        const lowerSearch = searchTerm.toLowerCase();
        return options.filter(o => 
            getOptionLabel(o)?.toLowerCase().includes(lowerSearch) ||
            getOptionSubLabel?.(o)?.toLowerCase().includes(lowerSearch)
        );
    }, [options, searchTerm, selectedOption, getOptionLabel, getOptionSubLabel]);

    const handleFocus = () => {
        if (!disabled) setIsOpen(true);
    };

    const handleSelect = (option) => {
        onChange(getOptionValue(option).toString());
        setSearchTerm(getOptionLabel(option));
        setIsOpen(false);
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        if (value) onChange(""); // Clear selection if user types something else
    };

    return (
        <div className="space-y-1.5" ref={wrapperRef}>
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-slate-400" />}
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <Input
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={cn(
                        "bg-[#0b101c] border-slate-700 text-white placeholder:text-slate-500 h-12 pl-10",
                        error && "border-red-500 focus-visible:ring-red-500",
                        selectedOption && "border-blue-500/50"
                    )}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {Icon ? <Icon className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                </div>
                {selectedOption && !disabled && (
                    <button 
                        onClick={() => { onChange(""); setSearchTerm(""); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Dropdown Options */}
            {isOpen && searchTerm && !selectedOption && (
                <div className="absolute z-50 w-full mt-1 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-auto">
                    {filteredOptions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">No results found</div>
                    ) : (
                        filteredOptions.map((option, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleSelect(option)}
                                className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0"
                            >
                                <p className="text-sm font-medium text-white">{getOptionLabel(option)}</p>
                                {getOptionSubLabel && (
                                    <p className="text-xs text-slate-400 mt-0.5">{getOptionSubLabel(option)}</p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
            {error && (
                <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" /> {error}
                </p>
            )}
        </div>
    );
};

// ============================================
// MULTI-STOP DESTINATION COMPONENT (Simplified for UI)
// ============================================
const MultiStopDestination = ({ stops, onChange, vehicleId, onEstimateChange }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [activeIndex, setActiveIndex] = useState(null);
    const [searching, setSearching] = useState(false);

    const searchDestinations = useCallback(
        async (query) => {
            if (query.length < 2) { setSuggestions([]); return; }
            setSearching(true);
            try {
                const response = await locationAPI.searchPlaces(query);
                const data = response?.data;
                if (data?.success !== false) {
                    let predictions = data.predictions || data.data || [];
                    setSuggestions(predictions.slice(0, 5));
                }
            } catch (error) {
                setSuggestions([]);
            } finally {
                setSearching(false);
            }
        }, []
    );

    const handleStopInputChange = (index, value) => {
        const newStops = [...stops];
        newStops[index] = { ...newStops[index], address: value, lat: null, lng: null };
        onChange(newStops);
        setActiveIndex(index);
        searchDestinations(value);
    };

    const handleSelectSuggestion = (index, suggestion) => {
        const newStops = [...stops];
        newStops[index] = { 
            address: suggestion.description, 
            lat: parseFloat(suggestion.lat), 
            lng: parseFloat(suggestion.lng) 
        };
        onChange(newStops);
        setSuggestions([]);
        setActiveIndex(null);
    };

    const addStop = () => {
        if (stops.length >= MAX_STOPS) return toast.error(`Max ${MAX_STOPS} stops`);
        onChange([...stops, { address: "", lat: null, lng: null }]);
    };

    const removeStop = (index) => {
        if (stops.length === 1) return;
        onChange(stops.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-3">
            {stops.map((stop, index) => (
                <div key={index} className="relative">
                    <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Add destination"
                                value={stop.address}
                                onChange={(e) => handleStopInputChange(index, e.target.value)}
                                onFocus={() => setActiveIndex(index)}
                                className="pl-10 pr-10 bg-[#0b101c] border-slate-700 text-white h-12"
                            />
                            {searching && activeIndex === index && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                            )}
                        </div>
                        {stops.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => removeStop(index)} className="text-red-400 hover:text-red-300">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {activeIndex === index && suggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-auto">
                            {suggestions.map((s, i) => (
                                <div key={i} onClick={() => handleSelectSuggestion(index, s)} className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0">
                                    <p className="text-sm text-white">{s.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            <Button 
                variant="outline" 
                onClick={addStop} 
                className="w-full border-dashed border-slate-700 text-slate-300 hover:bg-slate-800 h-12"
            >
                <Plus className="h-4 w-4 mr-2" /> Add Destination
            </Button>
        </div>
    );
};


// ============================================
// MAIN COMPONENT
// ============================================
const GsoCreateTrip = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        department_id: "",
        driver_id: "",
        vehicle_id: "",
        trip_date: new Date().toISOString().split("T")[0],
        purpose: "",
        passenger_name: "",
    });

    const [stops, setStops] = useState([{ address: "", lat: null, lng: null }]);
    const [tripEstimate, setTripEstimate] = useState(null);
    const [errors, setErrors] = useState({});

    // QUERIES
    const { data: departments = [] } = useOptimizedQuery({
        queryKey: ["departments"],
        queryFn: async () => (await adminDepartmentAPI.getSelector()).data?.data || [],
    });
    const { data: vehicles = [] } = useOptimizedQuery({
        queryKey: ["vehicles"],
        queryFn: async () => (await vehicleAPI.getAll()).data?.data || [],
    });
    const { data: drivers = [] } = useOptimizedQuery({
        queryKey: ["drivers"],
        queryFn: async () => (await driverManagementAPI.getAll()).data?.data || [],
    });

    const sharedVehicleDeptId = useMemo(() => {
        const mo = departments.find(d => SHARED_DEPARTMENT_CODES.includes(d.department_code));
        return mo?.department_id;
    }, [departments]);

    const availableVehicles = useMemo(() => {
        if (!formData.department_id) return [];
        const deptId = parseInt(formData.department_id);
        return vehicles.filter(v => {
            if (v.maintenance_flag || v.status !== "active") return false;
            return v.department_id === deptId || v.department_id === sharedVehicleDeptId;
        });
    }, [vehicles, formData.department_id, sharedVehicleDeptId]);

    const handleDriverSelect = (driverId) => {
        const driver = drivers.find(d => (d.driver_id || d.id).toString() === driverId);
        if (driver) {
            const deptId = driver.department_id || driver.user?.department_id;
            setFormData(prev => ({
                ...prev,
                driver_id: driverId,
                department_id: deptId?.toString() || "",
                vehicle_id: "", // Reset vehicle when driver changes
            }));
            setErrors(prev => ({ ...prev, driver_id: "", department_id: "", vehicle_id: "" }));
        } else {
            setFormData(prev => ({ ...prev, driver_id: "", department_id: "", vehicle_id: "" }));
        }
    };

    const handleEstimateChange = useCallback((estimate) => {
        setTripEstimate(estimate);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const newErrors = {};
        if (!formData.driver_id) newErrors.driver_id = "Required";
        if (!formData.vehicle_id) newErrors.vehicle_id = "Required";
        if (!formData.purpose) newErrors.purpose = "Required";
        if (stops.filter(s => s.address).length === 0) newErrors.destination = "Required";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return toast.error("Please fill in all required fields.");
        }

        // Combine multiple destinations
        const destString = stops.filter(s => s.address).map(s => s.address.split(',')[0]).join(', ');

        const payload = {
            ...formData,
            destination: destString,
            estimated_distance_km: tripEstimate?.distance_km || 0,
            estimated_fuel_liters: tripEstimate?.estimated_liters || 0,
            estimated_cost: tripEstimate?.estimated_cost || 0,
        };

        // Simulate API call
        toast.success("Trip Ticket Created!");
        navigate("/gso/dashboard");
    };

    const gaugePercent = tripEstimate ? Math.min(100, (tripEstimate.distance_km / 500) * 100) : 0;

    return (
        <div className="min-h-screen bg-[#090e1a] p-4 md:p-6 font-sans text-slate-200">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                        <Truck className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Create Trip Ticket</h1>
                        <p className="text-slate-400 mt-1">Fill in the details to create a new trip ticket.</p>
                    </div>
                    <Button onClick={() => navigate("/gso/dashboard")} variant="ghost" className="ml-auto text-slate-400 hover:text-white">
                        <X className="h-6 w-6" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Top Section: Details & Gauge */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Left Side: Form Details */}
                        <div className="lg:col-span-2 bg-[#121829] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                                <Truck className="h-5 w-5 text-blue-500" /> Trip Details
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SearchableSelect 
                                    label="Driver" icon={User} required
                                    placeholder="Search driver name..."
                                    options={drivers}
                                    value={formData.driver_id}
                                    onChange={handleDriverSelect}
                                    getOptionLabel={(o) => o.full_name || o.user?.full_name}
                                    getOptionSubLabel={(o) => o.department_name || o.user?.department_name}
                                    getOptionValue={(o) => o.driver_id || o.id}
                                    error={errors.driver_id}
                                />

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-slate-400" /> Trip Date <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="date"
                                        value={formData.trip_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, trip_date: e.target.value }))}
                                        className="bg-[#0b101c] border-slate-700 text-white h-12 [color-scheme:dark]"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-slate-400" /> Department
                                    </label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                        <Input
                                            disabled
                                            value={departments.find(d => d.department_id === parseInt(formData.department_id))?.department_name || "Auto-filled based on driver"}
                                            className="pl-10 bg-[#0b101c] border-slate-700 text-slate-400 h-12 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <SearchableSelect 
                                    label="Vehicle" icon={Truck} required
                                    placeholder={!formData.department_id ? "Select driver first" : "Search vehicle..."}
                                    options={availableVehicles}
                                    value={formData.vehicle_id}
                                    onChange={(v) => setFormData(prev => ({ ...prev, vehicle_id: v }))}
                                    disabled={!formData.department_id}
                                    getOptionLabel={(o) => o.plate_number}
                                    getOptionSubLabel={(o) => o.vehicle_model}
                                    getOptionValue={(o) => o.vehicle_id}
                                    error={errors.vehicle_id}
                                />

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-slate-400" /> Purpose <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        placeholder="Enter purpose"
                                        value={formData.purpose}
                                        onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                                        className={cn("bg-[#0b101c] border-slate-700 text-white h-12", errors.purpose && "border-red-500")}
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <User className="h-4 w-4 text-slate-400" /> Passenger Name (Optional)
                                    </label>
                                    <Input
                                        placeholder="Enter passenger name"
                                        value={formData.passenger_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, passenger_name: e.target.value }))}
                                        className="bg-[#0b101c] border-slate-700 text-white h-12"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Gauge */}
                        <div className="bg-[#121829] border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg relative">
                            <div className="absolute top-4 left-4 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-500" />
                                <h3 className="font-bold text-white">Round Trip Distance</h3>
                            </div>
                            
                            <div className="relative w-48 h-48 mt-8">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className="text-blue-500" strokeDasharray={`${gaugePercent}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <Navigation className="h-6 w-6 text-blue-500 mb-1" />
                                    <span className="text-3xl font-extrabold text-white">{tripEstimate ? tripEstimate.distance_km : 0} <span className="text-lg">km</span></span>
                                    <span className="text-xs text-slate-400">Estimate</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Destinations */}
                    <div className="bg-[#121829] border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-blue-500" /> Destinations
                            </h2>
                            <Badge variant="outline" className="border-slate-700 text-slate-400">{stops.length}/{MAX_STOPS}</Badge>
                        </div>
                        <MultiStopDestination 
                            stops={stops} 
                            onChange={setStops} 
                            vehicleId={formData.vehicle_id} 
                            onEstimateChange={handleEstimateChange} 
                        />
                        {errors.destination && <p className="text-red-400 text-xs mt-2">{errors.destination}</p>}
                    </div>

                    {/* Bottom Section: Charge To (Static) */}
                    <div className="bg-[#121829] border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                            <Building2 className="h-5 w-5 text-blue-500" /> Charged To Department
                        </h2>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input
                                disabled
                                placeholder="Auto-filled based on driver's department"
                                value={departments.find(d => d.department_id === parseInt(formData.department_id))?.department_name || ""}
                                className="pl-10 bg-[#0b101c] border-slate-700 text-slate-400 h-12 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => navigate("/gso/dashboard")} className="border-slate-700 text-slate-300 h-12 px-6 rounded-xl">
                            <X className="h-5 w-5 mr-2" /> Cancel
                        </Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 rounded-xl">
                            <CheckCircle className="h-5 w-5 mr-2" /> Create Trip Ticket
                        </Button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default GsoCreateTrip;