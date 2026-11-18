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
import { debounce } from "lodash";
import RouteMap from "../../components/map/RouteMap";

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

    useEffect(() => {
        if (selectedOption) setSearchTerm(getOptionLabel(selectedOption));
        else setSearchTerm("");
    }, [selectedOption, getOptionLabel]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
        if (!searchTerm || (selectedOption && searchTerm === getOptionLabel(selectedOption))) return []; 
        const lowerSearch = searchTerm.toLowerCase();
        return options.filter(o => 
            getOptionLabel(o)?.toLowerCase().includes(lowerSearch) ||
            getOptionSubLabel?.(o)?.toLowerCase().includes(lowerSearch)
        );
    }, [options, searchTerm, selectedOption, getOptionLabel, getOptionSubLabel]);

    const handleFocus = () => { if (!disabled) setIsOpen(true); };

    const handleSelect = (option) => {
        onChange(getOptionValue(option).toString());
        setSearchTerm(getOptionLabel(option));
        setIsOpen(false);
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        if (value) onChange(""); 
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
                    <button onClick={() => { onChange(""); setSearchTerm(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {isOpen && searchTerm && !selectedOption && (
                <div className="absolute z-50 w-full mt-1 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-auto">
                    {filteredOptions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">No results found</div>
                    ) : (
                        filteredOptions.map((option, idx) => (
                            <div key={idx} onClick={() => handleSelect(option)} className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0">
                                <p className="text-sm font-medium text-white">{getOptionLabel(option)}</p>
                                {getOptionSubLabel && <p className="text-xs text-slate-400 mt-0.5">{getOptionSubLabel(option)}</p>}
                            </div>
                        ))
                    )}
                </div>
            )}
            {error && <p className="text-red-400 text-xs flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" /> {error}</p>}
        </div>
    );
};

// ============================================
// MULTI-STOP DESTINATION COMPONENT
// ============================================
const MultiStopDestination = ({ stops, onChange, vehicleId, onEstimateChange }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [activeIndex, setActiveIndex] = useState(null);
    const [searching, setSearching] = useState(false);

    const searchDestinations = useCallback(
        debounce(async (query) => {
            if (query.length < 2) { setSuggestions([]); return; }
            setSearching(true);
            try {
                const response = await locationAPI.searchPlaces(query);
                const data = response?.data;
                if (data?.success !== false) {
                    let predictions = data.predictions || data.data || [];
                    setSuggestions(predictions.slice(0, 5));
                }
            } catch (error) { setSuggestions([]); } 
            finally { setSearching(false); }
        }, SEARCH_DEBOUNCE_MS), []
    );

    const calculateTotal = useCallback(async (currentStops, currentVehicleId) => {
        const validStops = currentStops.filter(s => s.address && s.lat && s.lng);
        if (validStops.length === 0) { onEstimateChange(null); return; }

        try {
            let totalDistance = 0;
            let efficiency = 10;
            let fuelPrice = 78;

            for (let i = 0; i < validStops.length; i++) {
                const stop = validStops[i];
                const legOrigin = i === 0 ? ORIGIN_ADDRESS : validStops[i - 1].address;
                const params = {
                    origin: legOrigin, destination: stop.address,
                    vehicle_id: currentVehicleId || undefined, round_trip: false,
                    dest_lat: stop.lat, dest_lng: stop.lng,
                };
                if (i > 0) { params.origin_lat = validStops[i - 1].lat; params.origin_lng = validStops[i - 1].lng; }

                try {
                    const response = await locationAPI.calculateDistance(params);
                    if (response.data?.success) {
                        totalDistance += parseFloat(response.data.distance_km) || 0;
                        if (response.data.fuel_efficiency_km_per_liter) efficiency = parseFloat(response.data.fuel_efficiency_km_per_liter);
                        if (response.data.fuel_price_per_liter) fuelPrice = parseFloat(response.data.fuel_price_per_liter);
                    }
                } catch (err) { console.error(err); }
            }

            if (totalDistance === 0) { onEstimateChange(null); return; }

            // ✅ GITANGGTANG ANG * 2 KAY ANG FORMULA SA BACKEND NAGLAKIP NA SA ROUND TRIP
            const finalDistance = Math.round(totalDistance * 100) / 100;
            
            // Compute estimated liters base sa final distance ug efficiency
            const estimatedLiters = Math.round((finalDistance / efficiency) * 1.1 * 100) / 100;
            const estimatedCost = Math.round(estimatedLiters * fuelPrice * 100) / 100;

            onEstimateChange({ distance_km: finalDistance, estimated_liters: estimatedLiters, estimated_cost: estimatedCost });
        } catch (error) { onEstimateChange(null); }
    }, [onEstimateChange]);

    const debouncedCalcRef = useRef(null);
    if (!debouncedCalcRef.current) debouncedCalcRef.current = debounce((s, v) => calculateTotal(s, v), 600);
    const debouncedCalc = debouncedCalcRef.current;

    const stopsKey = stops.map(s => `${s.address}|${s.lat}|${s.lng}`).join("::");
    useEffect(() => {
        debouncedCalc(stops, vehicleId);
        return () => debouncedCalc.cancel();
    }, [stopsKey, vehicleId, debouncedCalc]);

    const handleStopInputChange = (index, value) => {
        const newStops = [...stops];
        newStops[index] = { ...newStops[index], address: value, lat: null, lng: null };
        onChange(newStops);
        setActiveIndex(index);
        searchDestinations(value);
    };

    const handleSelectSuggestion = (index, suggestion) => {
        const newStops = [...stops];
        newStops[index] = { address: suggestion.description, lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lng) };
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
                            {searching && activeIndex === index && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
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
            <Button variant="outline" onClick={(e) => { e.preventDefault(); addStop(); }} className="w-full border-dashed border-slate-700 text-slate-300 hover:bg-slate-800 h-12">
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
    const toastIdRef = useRef(null);

    const [formData, setFormData] = useState({
        department_id: "",
        driver_id: "",
        vehicle_id: "",
        trip_date: new Date().toISOString().split("T")[0],
        purpose: "",
        passenger_name: "",
        charge_to: "", 
    });

    const [stops, setStops] = useState([{ address: "", lat: null, lng: null }]);
    const [tripEstimate, setTripEstimate] = useState(null);
    const [errors, setErrors] = useState({});

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
            const deptCode = departments.find(d => d.department_id === parseInt(deptId))?.department_code || "";
            
            setFormData(prev => ({
                ...prev,
                driver_id: driverId,
                department_id: deptId?.toString() || "",
                vehicle_id: "", 
                charge_to: deptCode, 
            }));
            setErrors(prev => ({ ...prev, driver_id: "", department_id: "", vehicle_id: "", charge_to: "" }));
        } else {
            setFormData(prev => ({ ...prev, driver_id: "", department_id: "", vehicle_id: "", charge_to: "" }));
        }
    };

    const handleEstimateChange = useCallback((estimate) => {
        setTripEstimate(estimate);
    }, []);

    const createTripMutation = useMutation({
        mutationFn: async (data) => {
            const response = await gsoAPI.createTrip(data);
            return response.data;
        },
        onSuccess: () => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.success("✅ Trip ticket created successfully!");
            queryClient.invalidateQueries({ queryKey: ["gso"] });
            navigate("/gso/dashboard");
        },
        onError: (error) => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(error.response?.data?.message || "Failed to create trip");
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const newErrors = {};
        if (!formData.driver_id) newErrors.driver_id = "Required";
        if (!formData.vehicle_id) newErrors.vehicle_id = "Required";
        if (!formData.purpose) newErrors.purpose = "Required";
        if (stops.filter(s => s.address && s.lat).length === 0) newErrors.destination = "Required";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return toast.error("Please fill in all required fields.");
        }

        const destString = stops.filter(s => s.address).map(s => s.address.split(',')[0]).join(', ');

        const payload = {
            ...formData,
            destination: destString,
            estimated_distance_km: tripEstimate?.distance_km || 0,
            estimated_fuel_liters: tripEstimate?.estimated_liters || 0,
            estimated_cost: tripEstimate?.estimated_cost || 0,
        };

        createTripMutation.mutate(payload);
    };

    return (
        <div className="min-h-screen bg-[#090e1a] p-4 md:p-6 font-sans text-slate-200">
            <div className="max-w-7xl mx-auto space-y-6">
                
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]"><Truck className="h-8 w-8 text-white" /></div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Create Trip Ticket</h1>
                        <p className="text-slate-400 mt-1">Fill in the details to create a new trip ticket.</p>
                    </div>
                    <Button onClick={() => navigate("/gso/dashboard")} variant="ghost" className="ml-auto text-slate-400 hover:text-white"><X className="h-6 w-6" /></Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        <div className="lg:col-span-2 bg-[#121829] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2"><Truck className="h-5 w-5 text-blue-500" /> Trip Details</h2>

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
                                    <Input type="date" value={formData.trip_date} onChange={(e) => setFormData(prev => ({ ...prev, trip_date: e.target.value }))} className="bg-[#0b101c] border-slate-700 text-white h-12 [color-scheme:dark]" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-slate-400" /> Department
                                    </label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                        <Input disabled value={departments.find(d => d.department_id === parseInt(formData.department_id))?.department_name || "Auto-filled based on driver"} className="pl-10 bg-[#0b101c] border-slate-700 text-slate-400 h-12 cursor-not-allowed" />
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
                                    <Input placeholder="Enter purpose" value={formData.purpose} onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))} className={cn("bg-[#0b101c] border-slate-700 text-white h-12", errors.purpose && "border-red-500")} />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <User className="h-4 w-4 text-slate-400" /> Passenger Name (Optional)
                                    </label>
                                    <Input placeholder="Enter passenger name" value={formData.passenger_name} onChange={(e) => setFormData(prev => ({ ...prev, passenger_name: e.target.value }))} className="bg-[#0b101c] border-slate-700 text-white h-12" />
                                </div>
                            </div>
                        </div>

                        {/* ✅ MAP CARD (GIBALIK) */}
                        <div className="bg-[#121829] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative">
                            <div className="flex items-center gap-2 mb-2">
                                <MapPin className="h-4 w-4 text-blue-500" />
                                <h3 className="font-bold text-white">Route Preview</h3>
                            </div>
                            
                            <div className="flex-1 rounded-xl overflow-hidden min-h-[220px] border border-slate-700">
                                {stops.some(s => s.lat && s.lng) ? (
                                    <RouteMap
                                        destination={stops[stops.length - 1]?.address || ""}
                                        coordinates={{ lat: stops[0].lat, lng: stops[0].lng }}
                                        waypoints={stops.filter(s => s.lat && s.lng).map(s => ({
                                            lat: s.lat,
                                            lng: s.lng,
                                            address: s.address,
                                        }))}
                                        height="100%"
                                        showRoute={true}
                                        interactive={false}
                                        className="w-full h-full"
                                        showMarker={true}
                                        draggableMarker={false}
                                        vehicleId={formData.vehicle_id}
                                        roundTrip={true}
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b101c]">
                                        <MapPin className="h-8 w-8 text-slate-600 mb-2" />
                                        <p className="text-xs text-slate-500 text-center px-4">Add a destination to preview route</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800">
                                <p className="text-xs text-slate-400 mb-1">Estimated Round Trip Distance</p>
                                <p className="text-xl font-bold text-white">
                                    {tripEstimate ? tripEstimate.distance_km : 0} km
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#121829] border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-500" /> Destinations</h2>
                            <Badge variant="outline" className="border-slate-700 text-slate-400">{stops.length}/{MAX_STOPS}</Badge>
                        </div>
                        <MultiStopDestination stops={stops} onChange={setStops} vehicleId={formData.vehicle_id} onEstimateChange={handleEstimateChange} />
                        {errors.destination && <p className="text-red-400 text-xs mt-2">{errors.destination}</p>}
                    </div>

                    <div className="bg-[#121829] border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><Building2 className="h-5 w-5 text-blue-500" /> Charged To Department</h2>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input disabled placeholder="Auto-filled based on driver's department" value={departments.find(d => d.department_id === parseInt(formData.department_id))?.department_name || ""} className="pl-10 bg-[#0b101c] border-slate-700 text-slate-400 h-12 cursor-not-allowed" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => navigate("/gso/dashboard")} className="border-slate-700 text-slate-300 h-12 px-6 rounded-xl">
                            <X className="h-5 w-5 mr-2" /> Cancel
                        </Button>
                        <Button type="submit" disabled={createTripMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 rounded-xl">
                            {createTripMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Creating...</> : <><CheckCircle className="h-5 w-5 mr-2" /> Create Trip Ticket</>}
                        </Button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default GsoCreateTrip;