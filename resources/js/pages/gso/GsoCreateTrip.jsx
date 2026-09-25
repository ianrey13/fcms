// src/pages/gso/GsoCreateTrip.jsx


import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { SkeletonCard, SkeletonText, SkeletonTitle } from "../../components/ui/SkeletonCard";
import { gsoAPI, vehicleAPI, driverManagementAPI, adminDepartmentAPI, locationAPI } from "../../services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Truck, User, MapPin, Calendar, Building2, Loader2, CheckCircle,
    AlertTriangle, FileText, Clock, X, ArrowLeft,
    Navigation, Gauge, Shield, Plus, Trash2, Map as MapIcon, Maximize2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { debounce } from "lodash";
import { cn } from "@/lib/utils";
import RouteMap from "../../components/map/RouteMap";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

// ============================================
// CONSTANTS
// ============================================

const ORIGIN_ADDRESS = "Laguindingan Municipal Hall";
const SEARCH_DEBOUNCE_MS = 500;
const MAX_STOPS = 5;
const SHARED_DEPARTMENT_CODES = ["MO"];

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
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{title}</h3>
        </div>
        {children}
    </div>
);

const FormSkeleton = () => (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-4 mb-6">
            <SkeletonCard className="h-10 w-10 rounded-xl" />
            <div>
                <SkeletonTitle width="w-48" className="h-7" />
                <SkeletonText width="w-64" />
            </div>
        </div>
        <SkeletonCard className="p-6">
            <div className="space-y-6">
                <SkeletonCard className="p-5"><SkeletonText width="w-full" className="h-10" /></SkeletonCard>
                <SkeletonCard className="p-5">
                    <SkeletonText width="w-full" className="h-10" />
                    <SkeletonText width="w-full" className="h-24 mt-3" />
                </SkeletonCard>
            </div>
        </SkeletonCard>
    </div>
);

const FieldError = ({ error }) => {
    if (!error) return null;
    return (
        <p className="text-red-500 dark:text-red-400 text-xs mt-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            {error}
        </p>
    );
};

const FormFieldWrapper = ({ children, error, touched, label, required, icon: Icon, helper }) => {
    const hasError = touched && error;
    return (
        <div className="space-y-1.5">
            {label && (
                <Label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {Icon && <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
                    {label}
                    {required && <span className="text-red-500">*</span>}
                </Label>
            )}
            <div className="relative">
                {React.cloneElement(children, {
                    className: cn(
                        children.props.className,
                        hasError && "border-red-500 ring-red-500 bg-red-50/50 dark:bg-red-950/10"
                    )
                })}
                {hasError && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                    </div>
                )}
            </div>
            {hasError && <FieldError error={error} />}
            {helper && !hasError && (
                <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">{helper}</p>
            )}
        </div>
    );
};

// ============================================
// DRIVER DATALIST
// ============================================

const DriverDatalist = ({
    value, onChange, onBlur, error, touched, drivers, loading, onDriverSelect, registerFocusRef,
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [filteredDrivers, setFilteredDrivers] = useState([]);
    const inputRef = useRef(null);
    const wrapperRef = useRef(null);
    const hasError = touched && error;

    useEffect(() => {
        if (registerFocusRef) registerFocusRef(() => inputRef.current?.focus());
    }, [registerFocusRef]);

    useEffect(() => {
        if (!value) {
            if (selectedDriver) { setSelectedDriver(null); setSearchTerm(""); }
            return;
        }
        if (drivers?.length > 0) {
            const valueNum = parseInt(value);
            let found = drivers.find(d => (d.driver_id || d.id) === valueNum);
            if (!found) found = drivers.find(d => d.user_id === valueNum);
            if (found && selectedDriver !== found) {
                setSelectedDriver(found);
                setSearchTerm("");
                if (onDriverSelect) onDriverSelect(found);
            }
        }
    }, [value, drivers]);

    useEffect(() => {
        if (!drivers?.length) { setFilteredDrivers([]); return; }
        if (!searchTerm || searchTerm.length < 1) {
            setFilteredDrivers(drivers.slice(0, 50));
            return;
        }
        const search = searchTerm.toLowerCase().trim();
        const filtered = drivers.filter(d => {
            const fullName = d.full_name || d.user?.full_name || d.name || "";
            const deptName = d.department_name || d.user?.department_name || d.department?.department_name || "";
            const deptCode = d.department_code || d.user?.department_code || d.department?.department_code || "";
            const empNum = d.employee_number || d.user?.employee_number || "";
            return `${fullName} ${deptName} ${deptCode} ${empNum}`.toLowerCase().includes(search);
        });
        setFilteredDrivers(filtered);
    }, [drivers, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const input = e.target.value;
        setSearchTerm(input);
        if (selectedDriver && input !== "" && input !== getDriverDisplayName(selectedDriver)) {
            setSelectedDriver(null);
            onChange("");
            if (onDriverSelect) onDriverSelect(null);
        }
        setIsOpen(input.length > 0);
    };

    const handleSelect = (driver) => {
        setSelectedDriver(driver);
        setSearchTerm("");
        onChange((driver.driver_id || driver.id)?.toString() || "");
        if (onDriverSelect) onDriverSelect(driver);
        setIsOpen(false);
        inputRef.current?.blur();
    };

    const handleClear = () => {
        setSearchTerm("");
        setSelectedDriver(null);
        onChange("");
        if (onDriverSelect) onDriverSelect(null);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleFocus = () => {
        if (drivers.length > 0) {
            setFilteredDrivers(drivers.slice(0, 50));
            setIsOpen(true);
        }
    };

    const getDriverDisplayName = (d) => d?.full_name || d?.user?.full_name || d?.name || "Unknown";
    const getDriverDepartment = (d) => d?.department_name || d?.user?.department_name || d?.department?.department_name || "No Dept";
    const getDriverId = (d) => d?.driver_id || d?.id || d?.user_id;

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"><User className="h-4 w-4" /></div>
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder={selectedDriver ? getDriverDisplayName(selectedDriver) : "Type driver name to search..."}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={() => { setTimeout(() => setIsOpen(false), 250); if (onBlur) onBlur(); }}
                    className={cn(
                        "pl-10 pr-10 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white",
                        hasError && "border-red-500 ring-red-500 bg-red-50/50 dark:bg-red-950/10",
                        selectedDriver && !hasError && "border-emerald-500 ring-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20"
                    )}
                />
                {searchTerm && (
                    <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X className="h-4 w-4" />
                    </button>
                )}
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
                )}
                {selectedDriver && !searchTerm && !hasError && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2"><CheckCircle className="h-4 w-4 text-emerald-500" /></div>
                )}
            </div>
            {selectedDriver && !searchTerm && !hasError && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{getDriverDisplayName(selectedDriver)}</span>
                    <Badge variant="outline" className="border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-[10px]">{getDriverDepartment(selectedDriver)}</Badge>
                    <button type="button" onClick={handleClear} className="ml-auto text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded-lg">Change</button>
                </div>
            )}
            {hasError && !selectedDriver && <FieldError error={error} />}
            {isOpen && filteredDrivers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-auto">
                    <div className="sticky top-0 bg-slate-50 dark:bg-slate-900 px-4 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 flex justify-between">
                        <span>{filteredDrivers.length} driver{filteredDrivers.length !== 1 ? "s" : ""} found</span>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">● All drivers</span>
                    </div>
                    {filteredDrivers.map((driver) => {
                        const driverId = getDriverId(driver);
                        return (
                            <div
                                key={driverId}
                                onMouseDown={(e) => { e.preventDefault(); handleSelect(driver); }}
                                className="px-4 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                            >
                                <div className="flex-1 min-w-0">
                                    <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">{getDriverDisplayName(driver)}</span>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        <Building2 className="h-3 w-3" />
                                        <span className="truncate">{getDriverDepartment(driver)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {isOpen && searchTerm && filteredDrivers.length === 0 && !loading && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 text-center">
                    <User className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No drivers found</p>
                </div>
            )}
        </div>
    );
};

// ============================================
// DEPARTMENT DISPLAY
// ============================================

const DepartmentDisplay = ({ department, error, driver, touched }) => {
    const hasError = touched && error;
    if (department) {
        return (
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400"><Building2 className="h-4 w-4" /></div>
                <Input value={department.department_name} disabled className={cn("pl-10 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium", hasError && "border-red-500")} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Badge variant="outline" className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 text-xs">{department.department_code || "Auto"}</Badge>
                </div>
                {hasError && <FieldError error={error} />}
            </div>
        );
    }
    if (driver) {
        const deptName = driver.department_name || driver.user?.department_name;
        const deptCode = driver.department_code || driver.user?.department_code;
        if (deptName) {
            return (
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400"><Building2 className="h-4 w-4" /></div>
                    <Input value={deptName} disabled className={cn("pl-10 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium", hasError && "border-red-500")} />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Badge variant="outline" className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 text-xs">{deptCode || "Auto"}</Badge>
                    </div>
                </div>
            );
        }
    }
    return (
        <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"><Building2 className="h-4 w-4" /></div>
            <Input value="Select a driver first" disabled className="pl-10 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500" />
        </div>
    );
};

// ============================================
// MULTI-STOP DESTINATION COMPONENT
// ============================================

const MultiStopDestination = ({
    stops,
    onChange,
    vehicleId,
    onEstimateChange,
    maxStops = MAX_STOPS,
}) => {
    const [activeIndex, setActiveIndex] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searching, setSearching] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const wrapperRefs = useRef([]);
    const abortRef = useRef(null);
    const calcVersionRef = useRef(0);
    const calcCacheRef = useRef({});
    const lastCalcKeyRef = useRef("");

    const searchDestinations = useCallback(
        debounce(async (query) => {
            if (query.length < 2) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }
            setSearching(true);
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            try {
                const response = await locationAPI.searchPlaces(query);
                const data = response?.data;
                if (data?.success !== false) {
                    let predictions = data.predictions || [];
                    if (predictions.length === 0 && data.data) predictions = data.data;
                    const filtered = predictions.filter(item => {
                        const lat = parseFloat(item.lat);
                        const lng = parseFloat(item.lng);
                        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
                    });

                    // ✅ Dedupe by description (case-insensitive)
                    const seen = new Set();
                    const deduped = (filtered.length > 0 ? filtered : predictions).filter(item => {
                        const key = (item.description || "").toLowerCase().trim();
                        if (!key || seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });

                    setSuggestions(deduped);
                    setShowSuggestions(true);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } finally {
                setSearching(false);
            }
        }, SEARCH_DEBOUNCE_MS),
        []
    );

    const calculateTotal = useCallback(async (currentStops, currentVehicleId) => {
        const validStops = currentStops.filter(s => s.address && s.lat && s.lng);
        if (validStops.length === 0) {
            onEstimateChange(null);
            return;
        }

        const version = ++calcVersionRef.current;
        setCalculating(true);

        try {
            let totalDistance = 0;
            let totalDuration = 0;
            let efficiency = 10;
            let fuelPrice = 78;
            let fuelType = "gasoline";
            let vehicleInfoCaptured = false;

            for (let i = 0; i < validStops.length; i++) {
                const stop = validStops[i];
                const legOrigin = i === 0
                    ? ORIGIN_ADDRESS
                    : (validStops[i - 1].shortName || validStops[i - 1].address);

                const cacheKey = `${legOrigin}→${stop.address}|${currentVehicleId || 'none'}`;

                if (calcCacheRef.current[cacheKey]) {
                    const cached = calcCacheRef.current[cacheKey];
                    console.log(`[Leg ${i + 1}] (cached) ${legOrigin} → ${stop.address}`);
                    totalDistance += parseFloat(cached.distance_km) || 0;
                    totalDuration += parseFloat(cached.duration_minutes) || 0;
                    if (!vehicleInfoCaptured && cached.fuel_price_per_liter) {
                        efficiency = parseFloat(cached.fuel_efficiency_km_per_liter) || 10;
                        fuelPrice = parseFloat(cached.fuel_price_per_liter) || 78;
                        fuelType = cached.fuel_type || "gasoline";
                        vehicleInfoCaptured = true;
                    }
                    continue;
                }

                const params = {
                    origin: legOrigin,
                    destination: stop.address,
                    vehicle_id: currentVehicleId || undefined,
                    round_trip: false,
                    dest_lat: stop.lat,
                    dest_lng: stop.lng,
                };
                if (i > 0) {
                    params.origin_lat = validStops[i - 1].lat;
                    params.origin_lng = validStops[i - 1].lng;
                }

                try {
                    const response = await locationAPI.calculateDistance(params);
                    console.log(`[Leg ${i + 1}] ${legOrigin} → ${stop.address}:`, response.data);

                    if (response.data?.success) {
                        calcCacheRef.current[cacheKey] = response.data;

                        totalDistance += parseFloat(response.data.distance_km) || 0;
                        totalDuration += parseFloat(response.data.duration_minutes) || 0;

                        if (!vehicleInfoCaptured && response.data.fuel_price_per_liter) {
                            efficiency = parseFloat(response.data.fuel_efficiency_km_per_liter) || 10;
                            fuelPrice = parseFloat(response.data.fuel_price_per_liter) || 78;
                            fuelType = response.data.fuel_type || "gasoline";
                            vehicleInfoCaptured = true;
                            console.log(`[Fuel] Captured from backend:`, { fuelType, fuelPrice, efficiency });
                        }
                    } else {
                        console.warn(`[Leg ${i + 1}] failed:`, response.data?.message);
                    }
                } catch (err) {
                    console.error(`[Leg ${i + 1}] error:`, err);
                    if (err.response?.status === 429) {
                        console.warn(`[Leg ${i + 1}] Rate limited, waiting 2s...`);
                        await new Promise(r => setTimeout(r, 2000));
                        try {
                            const retry = await locationAPI.calculateDistance(params);
                            if (retry.data?.success) {
                                calcCacheRef.current[cacheKey] = retry.data;
                                totalDistance += parseFloat(retry.data.distance_km) || 0;
                                totalDuration += parseFloat(retry.data.duration_minutes) || 0;
                                if (!vehicleInfoCaptured && retry.data.fuel_price_per_liter) {
                                    efficiency = parseFloat(retry.data.fuel_efficiency_km_per_liter) || 10;
                                    fuelPrice = parseFloat(retry.data.fuel_price_per_liter) || 78;
                                    fuelType = retry.data.fuel_type || "gasoline";
                                    vehicleInfoCaptured = true;
                                }
                            }
                        } catch (e2) {
                            console.error(`[Leg ${i + 1}] retry failed:`, e2);
                        }
                    }
                }
            }

            if (version !== calcVersionRef.current) return;

            if (totalDistance === 0) {
                console.warn("[Multi-stop] Total distance is 0");
                onEstimateChange(null);
                return;
            }

            const roundTripDistance = Math.round(totalDistance * 2 * 100) / 100;
            const roundTripDuration = Math.round(totalDuration * 2);
            const estimatedLiters = Math.round((roundTripDistance / efficiency) * 1.1 * 100) / 100;
            const estimatedCost = Math.round(estimatedLiters * fuelPrice * 100) / 100;

            const estimate = {
                success: true,
                distance_km: roundTripDistance,
                duration_minutes: roundTripDuration,
                estimated_liters: estimatedLiters,
                estimated_cost: estimatedCost,
                fuel_efficiency_km_per_liter: efficiency,
                fuel_price_per_liter: fuelPrice,
                fuel_type: fuelType,
                is_round_trip: true,
                is_multi_stop: validStops.length > 1,
                stops_count: validStops.length,
                source: 'multi_stop_sum',
            };

            console.log("[Multi-stop] ✅ Estimate:", estimate);
            onEstimateChange(estimate);
        } catch (error) {
            console.error("[Multi-stop] error:", error);
            onEstimateChange(null);
        } finally {
            if (version === calcVersionRef.current) {
                setCalculating(false);
            }
        }
    }, [onEstimateChange]);

    const debouncedCalcRef = useRef(null);
    if (!debouncedCalcRef.current) {
        debouncedCalcRef.current = debounce((s, v) => calculateTotal(s, v), 600);
    }
    const debouncedCalc = debouncedCalcRef.current;

    const stopsKey = stops.map(s => `${s.address}|${s.lat}|${s.lng}`).join("::");
    useEffect(() => {
        const currentKey = `${stopsKey}||${vehicleId || ''}`;
        if (currentKey === lastCalcKeyRef.current) return;
        lastCalcKeyRef.current = currentKey;

        calcCacheRef.current = {};

        debouncedCalc(stops, vehicleId);
        return () => debouncedCalc.cancel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopsKey, vehicleId]);

    useEffect(() => () => debouncedCalc.cancel(), []);

    useEffect(() => {
        const handleClick = (e) => {
            const isInsideAny = wrapperRefs.current.some(ref => ref && ref.contains(e.target));
            if (!isInsideAny) setShowSuggestions(false);
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const updateStop = (index, field, value) => {
        const newStops = [...stops];
        newStops[index] = { ...newStops[index], [field]: value };
        if (field === "address") {
            newStops[index].lat = null;
            newStops[index].lng = null;
            newStops[index].shortName = null;
        }
        onChange(newStops);
    };

    const handleStopInputChange = (index, value) => {
        updateStop(index, "address", value);
        setActiveIndex(index);
        if (value.length > 1) {
            searchDestinations(value);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

   const handleSelectSuggestion = (index, suggestion) => {
    const fullDescription = suggestion.description;
    const parts = fullDescription.split(",").map(p => p.trim());
    const shortName = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];

    const newLat = parseFloat(suggestion.lat);
    const newLng = parseFloat(suggestion.lng);

    // ✅ Check if this exact location (by coordinates) already exists in another stop
    const duplicateIndex = stops.findIndex(
        (s, i) =>
            i !== index &&
            s.lat != null &&
            s.lng != null &&
            Math.abs(s.lat - newLat) < 0.0001 &&
            Math.abs(s.lng - newLng) < 0.0001
    );

    if (duplicateIndex !== -1) {
        toast.error(
            `This location is already added as Stop ${duplicateIndex + 1}. Please choose a different destination.`,
            { duration: 4000 }
        );
        setShowSuggestions(false);
        setSuggestions([]);
        setActiveIndex(null);
        return;
    }

    const newStops = [...stops];
    newStops[index] = {
        address: fullDescription,
        shortName: shortName,
        lat: newLat,
        lng: newLng,
    };
    onChange(newStops);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(null);
};

    const addStop = () => {
        if (stops.length >= maxStops) {
            toast.error(`Maximum ${maxStops} stops allowed`);
            return;
        }
        onChange([...stops, { address: "", lat: null, lng: null, shortName: null }]);
    };

    const removeStop = (index) => {
        if (stops.length === 1) {
            onChange([{ address: "", lat: null, lng: null, shortName: null }]);
            return;
        }
        onChange(stops.filter((_, i) => i !== index));
    };

    const canAddMore = stops.length < maxStops;
    const routePreview = stops.map(s => s.address).filter(Boolean);

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                {stops.map((stop, index) => (
                    <div key={index} className="relative" ref={el => wrapperRefs.current[index] = el}>
                        <div className="flex gap-2 items-start">
                            <div className="flex-shrink-0 mt-2.5">
                                <Badge variant="outline" className="text-[10px] h-6 w-6 rounded-full flex items-center justify-center p-0 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400">
                                    {index + 1}
                                </Badge>
                            </div>
                            <div className="relative flex-1">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"><MapPin className="h-4 w-4" /></div>
                                <Input
                                    placeholder={index === 0 ? "First stop (e.g., Sinai, Laguindingan)" : `Stop ${index + 1}`}
                                    value={stop.address}
                                    onChange={(e) => handleStopInputChange(index, e.target.value)}
                                    onFocus={() => {
                                        setActiveIndex(index);
                                        if (suggestions.length > 0) setShowSuggestions(true);
                                    }}
                                    className="pl-10 pr-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                                {stop.address && stop.lat && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2"><CheckCircle className="h-4 w-4 text-emerald-500" /></div>
                                )}
                                {searching && activeIndex === index && !stop.lat && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="h-4 w-4 animate-spin text-blue-500" /></div>
                                )}

                                {activeIndex === index && showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-auto">
                                        <div className="sticky top-0 bg-slate-100 dark:bg-slate-900 px-4 py-2 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                                            <span>Suggestions</span>
                                            <span className="text-blue-500 dark:text-blue-400">{suggestions.length} results</span>
                                        </div>
                                        {suggestions.map((suggestion, sIndex) => (
                                            <div
                                                key={sIndex}
                                                onClick={() => handleSelectSuggestion(index, suggestion)}
                                                className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer flex items-start gap-3 border-b border-slate-100 dark:border-slate-700 last:border-0"
                                            >
                                                <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-sm text-slate-900 dark:text-slate-100">{suggestion.description}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {suggestion.lat && suggestion.lng
                                                            ? `${parseFloat(suggestion.lat).toFixed(4)}, ${parseFloat(suggestion.lng).toFixed(4)}`
                                                            : "Click to calculate"}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {stops.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeStop(index)}
                                    className="shrink-0 h-10 w-10 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {canAddMore && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStop}
                    className="w-full border-dashed border-2 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 dark:text-slate-300"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Stop ({stops.length}/{maxStops})
                </Button>
            )}

            {!canAddMore && (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">Maximum {maxStops} stops reached</p>
            )}

            {routePreview.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-2">
                        <Navigation className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Route preview (round trip):</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 break-words">
                                {ORIGIN_ADDRESS}
                                {routePreview.map((addr, i) => (
                                    <React.Fragment key={i}>
                                        {" → "}
                                        <span className="text-blue-600 dark:text-blue-400">{addr}</span>
                                    </React.Fragment>
                                ))}
                                {" → "}
                                {ORIGIN_ADDRESS}
                            </p>
                            {calculating && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Calculating total distance...
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
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
    const driverFocusRef = useRef(null);

    const [formData, setFormData] = useState({
        department_id: "",
        driver_id: "",
        vehicle_id: "",
        trip_date: new Date().toISOString().split("T")[0],
        purpose: "",
        charge_to: "",
        passenger_name: "",
        estimated_distance_km: "",
        estimated_fuel_liters: "",
        estimated_cost: "",
    });

    const [stops, setStops] = useState([{ address: "", lat: null, lng: null, shortName: null }]);
    const [tripEstimate, setTripEstimate] = useState(null);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);

    // ============================================
    // QUERIES
    // ============================================

    const { data: departments = [], isLoading: deptsLoading } = useOptimizedQuery({
        queryKey: ["departments"],
        queryFn: async () => {
            try {
                const r = await adminDepartmentAPI.getSelector();
                return Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
            } catch { return []; }
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: vehicles = [], isLoading: vehiclesLoading } = useOptimizedQuery({
        queryKey: ["vehicles"],
        queryFn: async () => {
            try {
                const r = await vehicleAPI.getAll();
                return Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
            } catch { return []; }
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: drivers = [], isLoading: driversLoading } = useOptimizedQuery({
        queryKey: ["drivers"],
        queryFn: async () => {
            try {
                const r = await driverManagementAPI.getAll();
                return Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
            } catch { return []; }
        },
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        const interval = setInterval(async () => {
            try { await queryClient.refetchQueries({ queryKey: ["drivers"] }); } catch {}
        }, 30000);
        return () => clearInterval(interval);
    }, [queryClient]);

    // ============================================
    // SHARED VEHICLES (MO)
    // ============================================

    const sharedVehicleDeptId = useMemo(() => {
        const mo = departments.find(d => SHARED_DEPARTMENT_CODES.includes(d.department_code));
        return mo?.department_id;
    }, [departments]);

        const availableVehicles = useMemo(() => {
        if (!formData.department_id) return [];
        const deptId = parseInt(formData.department_id);
        return vehicles.filter(v => {
            // ✅ Exclude vehicles under maintenance
            if (v.maintenance_flag === true) return false;

            // ✅ Exclude inactive / unserviceable vehicles
            if (v.status && v.status !== "active") return false;

            // ✅ Match department or shared MO vehicles
            if (v.department_id === deptId) return true;
            if (sharedVehicleDeptId && v.department_id === sharedVehicleDeptId) return true;
            return false;
        });
    }, [vehicles, formData.department_id, sharedVehicleDeptId]);
    // ============================================
    // HANDLERS
    // ============================================

    const handleDriverSelect = useCallback((driver) => {
        if (driver) {
            const driverId = driver.driver_id || driver.id || driver.user_id;
            const departmentId = driver.department_id || driver.user?.department_id;
            if (departmentId) {
                const dept = departments.find(d => d.department_id === parseInt(departmentId));
                const chargeTo = dept?.department_code || '';
                setFormData(prev => ({
                    ...prev,
                    department_id: departmentId.toString(),
                    driver_id: driverId?.toString() || "",
                    vehicle_id: "",
                    charge_to: chargeTo,
                }));
                setErrors(prev => ({ ...prev, department_id: "", driver_id: "", charge_to: "" }));
                if (toastIdRef.current) toast.dismiss(toastIdRef.current);
                toastIdRef.current = toast.success(`Driver: ${driver.full_name || driver.user?.full_name || driver.name}`);
            } else {
                toast.warning("Driver has no department");
                setFormData(prev => ({ ...prev, driver_id: driverId?.toString() || "" }));
            }
        } else {
            setFormData(prev => ({ ...prev, driver_id: "", department_id: "", vehicle_id: "", charge_to: "" }));
        }
    }, [departments]);

    const handleEstimateChange = useCallback((estimate) => {
        setTripEstimate(estimate);
        if (estimate) {
            setFormData(prev => ({
                ...prev,
                estimated_distance_km: estimate.distance_km,
                estimated_fuel_liters: estimate.estimated_liters,
                estimated_cost: estimate.estimated_cost,
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                estimated_distance_km: "",
                estimated_fuel_liters: "",
                estimated_cost: "",
            }));
        }
    }, []);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
    };

    const handleFieldBlur = (field) => setTouched(prev => ({ ...prev, [field]: true }));

    // ============================================
    // COMPUTED
    // ============================================

    const isLoading = deptsLoading || vehiclesLoading || driversLoading;
    const selectedVehicle = vehicles.find(v => v.vehicle_id === parseInt(formData.vehicle_id));
    const selectedDepartment = departments.find(d => d.department_id === parseInt(formData.department_id));
    const selectedDriverObj = drivers.find(d => (d.driver_id || d.id) === parseInt(formData.driver_id));
    const hasError = (field) => touched[field] && errors[field];
    const validStopsCount = stops.filter(s => s.address && s.lat && s.lng).length;
    const hasMapCoordinates = stops.some(s => s.lat && s.lng);

    // ============================================
    // VALIDATION
    // ============================================

    const validateForm = () => {
        const newErrors = {};
        const newTouched = {};

        if (!formData.department_id) { newErrors.department_id = "Department is required"; newTouched.department_id = true; }
        if (!formData.driver_id) { newErrors.driver_id = "Driver is required"; newTouched.driver_id = true; }
        if (!formData.vehicle_id) { newErrors.vehicle_id = "Vehicle is required"; newTouched.vehicle_id = true; }
        if (!formData.trip_date) { newErrors.trip_date = "Trip date is required"; newTouched.trip_date = true; }
        else {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            if (new Date(formData.trip_date) < today) {
                newErrors.trip_date = "Trip date cannot be in the past";
                newTouched.trip_date = true;
            }
        }
        if (validStopsCount === 0) {
            newErrors.destination = "At least one destination is required";
            newTouched.destination = true;
        }
        if (!formData.purpose || formData.purpose.trim().length < 5) {
            newErrors.purpose = "Purpose must be at least 5 characters";
            newTouched.purpose = true;
        }
        if (!formData.estimated_distance_km || parseFloat(formData.estimated_distance_km) <= 0) {
            newErrors.estimated_distance_km = "Distance not calculated. Check destinations.";
            newTouched.estimated_distance_km = true;
        }

        setErrors(newErrors);
        setTouched(prev => ({ ...prev, ...newTouched }));

        if (Object.keys(newErrors).length > 0) {
            const labels = {
                department_id: 'Department', driver_id: 'Driver', vehicle_id: 'Vehicle',
                trip_date: 'Trip Date', destination: 'Destination', purpose: 'Purpose',
                estimated_distance_km: 'Estimated Distance'
            };
            const msgs = Object.entries(newErrors).map(([f, m]) => `• ${labels[f] || f}: ${m}`);
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(
                <div className="space-y-1">
                    <div className="font-semibold text-red-600 dark:text-red-400">Please fix:</div>
                    <div className="text-sm text-red-500 dark:text-red-400 space-y-0.5">
                        {msgs.map((m, i) => <div key={i}>{m}</div>)}
                    </div>
                </div>, { duration: 5000 }
            );

            const firstField = Object.keys(newErrors)[0];
            setTimeout(() => {
                if (firstField === "driver_id" && driverFocusRef.current) driverFocusRef.current();
                else document.querySelector(`[name="${firstField}"]`)?.focus();
            }, 100);
            return false;
        }
        return true;
    };

    // ============================================
    // MUTATION
    // ============================================

    const createTripMutation = useMutation({
        mutationFn: async (data) => {
            const response = await gsoAPI.createTrip(data);
            return response.data;
        },
        onSuccess: () => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.success("✅ Trip ticket created successfully!");
            queryClient.invalidateQueries({ queryKey: ["gso"] });
            queryClient.invalidateQueries({ queryKey: ["drivers"] });
            queryClient.invalidateQueries({ queryKey: ["vehicles"] });
            navigate("/gso/dashboard");
        },
        onError: (error) => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(error.response?.data?.message || "Failed to create trip");
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        if (!validateForm()) return;

        // ✅ Safety net: block duplicate stops on submit
        const validStops = stops.filter(s => s.address && s.lat != null && s.lng != null);
        const coordSet = new Set();
        for (const stop of validStops) {
            const key = `${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;
            if (coordSet.has(key)) {
                toast.error("Duplicate destination detected. Please remove the duplicate stop.");
                return;
            }
            coordSet.add(key);
        }

        // ✅ Build destination string from stops
        const destinationString = (() => {
            const parts = stops
                .filter(s => s.address)
                .map(s => {
                    // Extract location name (first comma-separated chunk)
                    const firstComma = s.address.indexOf(",");
                    return firstComma > -1 ? s.address.substring(0, firstComma).trim() : s.address;
                });

            // ✅ Dedupe while preserving order
            const seen = new Set();
            const uniqueParts = parts.filter(p => {
                const key = p.toLowerCase().trim();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // Check if all stops are within Laguindingan
            const allInLaguindingan = stops
                .filter(s => s.address)
                .every(s => s.address.toLowerCase().includes("laguindingan"));

            if (allInLaguindingan) {
                return `${uniqueParts.join(", ")}, Laguindingan, Misamis Oriental`;
            } else {
                return `${uniqueParts.join(", ")}, Misamis Oriental`;
            }
        })();

        // ✅ Guard: ensure destination is non-empty
        if (!destinationString || destinationString.trim() === "" || destinationString === ", Misamis Oriental" || destinationString === ", Laguindingan, Misamis Oriental") {
            toast.error("Please enter at least one valid destination before submitting.");
            return;
        }

        createTripMutation.mutate({ ...formData, destination: destinationString });
    };

    if (isLoading) return <FormSkeleton />;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate("/gso/dashboard")} className="rounded-xl h-10 w-10">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Create Trip Ticket</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Multi-stop trip (max {MAX_STOPS} stops, round trip)</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30"><Shield className="h-3 w-3 mr-1" /> GSO</Badge>
                    <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30"><Navigation className="h-3 w-3 mr-1" /> Multi-Stop</Badge>
                </div>
            </div>

            <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl">
                <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                            <Truck className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="dark:text-white">Trip Ticket Information</CardTitle>
                            <CardDescription className="dark:text-slate-400">All fields marked with <span className="text-red-500">*</span> are required</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <FormSection title="Driver Selection" icon={User}>
                            <Label htmlFor="driver_id" className="dark:text-slate-300">Search Driver <span className="text-red-500">*</span></Label>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Type driver name to search across all departments</p>
                            <DriverDatalist
                                id="driver_id"
                                name="driver_id"
                                value={formData.driver_id}
                                onChange={(v) => handleChange("driver_id", v)}
                                onBlur={() => handleFieldBlur("driver_id")}
                                error={errors.driver_id}
                                touched={touched.driver_id}
                                drivers={drivers}
                                loading={driversLoading}
                                onDriverSelect={handleDriverSelect}
                                registerFocusRef={(fn) => { driverFocusRef.current = fn; }}
                            />
                        </FormSection>

                        <FormSection title={`Destinations (${stops.length}/${MAX_STOPS})`} icon={MapPin}>
                            <div className="space-y-4">
                                <MultiStopDestination
                                    stops={stops}
                                    onChange={setStops}
                                    vehicleId={formData.vehicle_id}
                                    onEstimateChange={handleEstimateChange}
                                    maxStops={MAX_STOPS}
                                />

                                {errors.destination && <FieldError error={errors.destination} />}

                                {tripEstimate && (
                                    <div className="rounded-xl border border-blue-200/70 dark:border-blue-800/50 bg-gradient-to-br from-blue-50 via-blue-50/60 to-white dark:from-blue-950/40 dark:via-slate-900/40 dark:to-slate-900/60 overflow-hidden shadow-sm">
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200/60 dark:border-blue-800/40 bg-white/50 dark:bg-slate-900/50">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-blue-500/15 dark:bg-blue-500/20">
                                                    <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Route</h4>
                                                {tripEstimate.is_multi_stop && (
                                                    <Badge className="bg-purple-500/15 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300/50 dark:border-purple-700/50 text-[10px] font-medium">
                                                        {tripEstimate.stops_count} stops
                                                    </Badge>
                                                )}
                                            </div>
                                            {hasMapCoordinates && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setIsMapModalOpen(true)}
                                                    className="h-7 px-2.5 text-blue-600 dark:text-blue-400 border-blue-300/70 dark:border-blue-700/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs"
                                                >
                                                    <MapIcon className="h-3 w-3 mr-1" /> View Map
                                                </Button>
                                            )}
                                        </div>

                                        {/* <div className="grid grid-cols-2 gap-3 p-4">
                                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-3">
                                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                                                    <MapPin className="h-3 w-3" />
                                                    Distance
                                                </div>
                                                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                    {tripEstimate.distance_km}
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">km</span>
                                                </p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">round trip</p>
                                            </div>

                                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-3">
                                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                                                    <Clock className="h-3 w-3" />
                                                    Duration
                                                </div>
                                                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                    {tripEstimate.duration_minutes}
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">min</span>
                                                </p>
                                            </div>
                                        </div> */}

                                        {hasMapCoordinates && (
                                            <div className="border-t border-blue-200/60 dark:border-blue-800/40 p-4 bg-white/30 dark:bg-slate-900/30">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-900 dark:text-slate-200">
                                                        <MapIcon className="h-3.5 w-3.5" /> Route Preview
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setIsMapModalOpen(true)}
                                                        className="h-6 px-2 text-blue-600 dark:text-blue-400 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                                    >
                                                        <Maximize2 className="h-3 w-3 mr-1" /> Expand
                                                    </Button>
                                                </div>
                                                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                                    <RouteMap
                                                        destination={stops[stops.length - 1]?.address || ""}
                                                        coordinates={{ lat: stops[0].lat, lng: stops[0].lng }}
                                                        waypoints={stops.filter(s => s.lat && s.lng).map(s => ({
                                                            lat: s.lat,
                                                            lng: s.lng,
                                                            address: s.address,
                                                        }))}
                                                        height="250px"
                                                        showRoute={true}
                                                        interactive={false}
                                                        className="w-full"
                                                        showMarker={true}
                                                        draggableMarker={false}
                                                        vehicleId={formData.vehicle_id}
                                                        roundTrip={true}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </FormSection>

                        <FormSection title="Assignment" icon={Building2}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="dark:text-slate-300">Department <span className="text-red-500">*</span></Label>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Auto-filled from driver</p>
                                    <DepartmentDisplay
                                        department={selectedDepartment}
                                        error={errors.department_id}
                                        driver={selectedDriverObj}
                                        touched={touched.department_id}
                                    />
                                </div>
                                <div>
                                    <FormFieldWrapper
                                        label="Vehicle"
                                        icon={Truck}
                                        required
                                        error={errors.vehicle_id}
                                        touched={touched.vehicle_id}
                                                                               helper={
                                            formData.department_id && availableVehicles.length === 0
                                                ? "No active vehicles available for this department (some may be under maintenance or unserviceable)"
                                                : sharedVehicleDeptId && formData.department_id
                                                    ? "Mayor's Office vehicles are shared across all departments"
                                                    : null
                                        }
                                    >
                                        <Select
                                            value={formData.vehicle_id?.toString() || undefined}
                                            onValueChange={(v) => handleChange("vehicle_id", v)}
                                            onOpenChange={() => handleFieldBlur("vehicle_id")}
                                        >
                                            <SelectTrigger className={cn("dark:bg-slate-900 dark:border-slate-700 dark:text-white", hasError("vehicle_id") && "border-red-500 ring-red-500")}>
                                                <SelectValue placeholder={
                                                    !formData.department_id ? "Select a driver first"
                                                    : availableVehicles.length === 0 ? "No vehicles available"
                                                    : "Select vehicle"
                                                } />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                                                {availableVehicles.length === 0 ? (
                                                    <SelectItem value="no-vehicle" disabled className="dark:text-slate-400">
                                                        {!formData.department_id ? "Select a driver first" : "No vehicles available"}
                                                    </SelectItem>
                                                ) : (
                                                    availableVehicles.map((v) => {
                                                        const isShared = sharedVehicleDeptId && v.department_id === sharedVehicleDeptId;
                                                        return (
                                                            <SelectItem key={v.vehicle_id} value={v.vehicle_id.toString()} className="dark:text-slate-200">
                                                                <div className="flex items-center gap-2">
                                                                    <Truck className="h-4 w-4" />
                                                                    <span>{v.plate_number} - {v.vehicle_model}</span>
                                                                    {isShared && (
                                                                        <Badge variant="outline" className="text-[10px] ml-1 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                                                            Shared
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </FormFieldWrapper>
                                </div>
                                <div>
                                    <FormFieldWrapper label="Trip Date" icon={Calendar} required error={errors.trip_date} touched={touched.trip_date}>
                                        <Input
                                            id="trip_date"
                                            name="trip_date"
                                            type="date"
                                            value={formData.trip_date}
                                            onChange={(e) => handleChange("trip_date", e.target.value)}
                                            onBlur={() => handleFieldBlur("trip_date")}
                                            className={cn(
                                                "dark:bg-slate-900 dark:border-slate-700 dark:text-white",
                                                "[&::-webkit-calendar-picker-indicator]:dark:invert",
                                                "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                                                hasError("trip_date") && "border-red-500 ring-red-500"
                                            )}
                                        />
                                    </FormFieldWrapper>
                                </div>
                            </div>
                        </FormSection>

                        {selectedVehicle && (
                            <div className="rounded-xl border border-blue-200/70 dark:border-blue-800/50 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 p-4">
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-300">
                                    <Truck className="h-4 w-4" /> Selected Vehicle
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Plate</p><p className="font-medium text-blue-700 dark:text-blue-300">{selectedVehicle.plate_number}</p></div>
                                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Model</p><p className="font-medium text-blue-700 dark:text-blue-300">{selectedVehicle.vehicle_model}</p></div>
                                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Fuel</p><Badge variant="outline" className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 uppercase">{selectedVehicle.fuel_type}</Badge></div>
                                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Status</p><Badge className={selectedVehicle.status === "active" ? "bg-emerald-500" : "bg-yellow-500"}>{selectedVehicle.status}</Badge></div>
                                </div>
                            </div>
                        )}

                        <FormSection title="Additional Details" icon={FileText}>
                            <div className="space-y-4">
                                <FormFieldWrapper label="Purpose" icon={FileText} required error={errors.purpose} touched={touched.purpose} helper="Describe the reason for this trip">
                                    <Textarea
                                        id="purpose"
                                        name="purpose"
                                        placeholder="Describe purpose..."
                                        value={formData.purpose}
                                        onChange={(e) => handleChange("purpose", e.target.value)}
                                        onBlur={() => handleFieldBlur("purpose")}
                                        rows={3}
                                        className={cn("dark:bg-slate-900 dark:border-slate-700 dark:text-white", hasError("purpose") && "border-red-500 ring-red-500")}
                                    />
                                </FormFieldWrapper>

                                <div>
                                    <Label htmlFor="passenger_name" className="dark:text-slate-300">Passenger Name (Optional)</Label>
                                    <Input
                                        id="passenger_name"
                                        placeholder="Name of passenger"
                                        value={formData.passenger_name}
                                        onChange={(e) => handleChange("passenger_name", e.target.value)}
                                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="charge_to" className="dark:text-slate-300">Charge To</Label>
                                    <Input
                                        id="charge_to"
                                        value={formData.charge_to || ''}
                                        disabled
                                        className={cn(
                                            "bg-gray-100 dark:bg-slate-800 font-mono",
                                            formData.charge_to && "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                        )}
                                    />
                                </div>
                            </div>
                        </FormSection>

                        {selectedDepartment && (
                            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <AlertDescription className="dark:text-slate-300">
                                    Creating trip for <strong>{selectedDepartment.department_name}</strong>
                                    {validStopsCount > 1 && ` • ${validStopsCount} stops`}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                            <Button variant="outline" onClick={() => navigate("/gso/dashboard")} type="button" className="dark:border-slate-700 dark:text-slate-300">Cancel</Button>
                            <Button type="submit" disabled={createTripMutation.isPending} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20">
                                {createTripMutation.isPending ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                                ) : (
                                    <><CheckCircle className="h-4 w-4 mr-2" /> Create Trip Ticket</>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
                <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                    <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-row items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 dark:text-white">
                            <MapIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            Multi-Stop Route Map
                            <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] ml-2">
                                {validStopsCount} stops
                            </Badge>
                        </DialogTitle>
                        <DialogClose asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
                        </DialogClose>
                    </DialogHeader>
                    <div className="flex-1 h-full min-h-[400px] p-4">
                        {hasMapCoordinates && (
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
                                className="w-full h-full rounded-lg"
                                showMarker={true}
                                draggableMarker={false}
                                vehicleId={formData.vehicle_id}
                                roundTrip={true}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GsoCreateTrip;