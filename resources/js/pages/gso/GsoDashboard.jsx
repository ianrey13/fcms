// src/pages/gso/GsoDashboard.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { gsoAPI, vehicleAPI, gpsAPI, departmentAPI } from "../../services/api";
import { MapContainer, TileLayer, Marker, ZoomControl, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Car, CheckCircle, AlertTriangle, Wrench, RefreshCw, MapPin, Search,
    ChevronDown, Activity, PlusCircle, Fuel, Clock, FileCheck, Loader2, Check,
    Play, Square, User, Users, Target, Flag, Route, Calendar, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ============================================
// HELPERS & MAP ICONS
// ============================================
const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;
    return [];
};

const formatDateShort = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const createVehicleIcon = (plateNumber, vehicleModel) => {
    return L.divIcon({
        className: 'custom-vehicle-icon',
        html: `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; transform:translate(-50%,-50%); position:relative; width:120px;">
            <div style="background-color:#3b82f6; width:32px; height:32px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 6px rgba(0,0,0,0.3); z-index:2;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <div style="position:absolute; top:38px; background-color:rgba(255,255,255,0.95); color:#0f172a; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.2); border:1px solid #cbd5e1; z-index:1;">
                ${plateNumber || 'Unknown'}
                <span style="font-weight:400; font-size:9px; color:#64748b; display:block; text-align:center;">${vehicleModel || ''}</span>
            </div>
        </div>`,
        iconSize: [120, 80], iconAnchor: [60, 40], popupAnchor: [0, -30],
    });
};

const createSvgIcon = (color, iconPath) => {
    return L.divIcon({
        className: 'custom-svg-icon',
        html: `<div style="
            background-color: ${color}; width: 28px; height: 28px; border-radius: 50%;
            border: 2px solid white; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        ">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                ${iconPath}
            </svg>
        </div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
    });
};

const icons = {
    start: createSvgIcon('#22c55e', '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>'),
    end: createSvgIcon('#ef4444', '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>'),
    vehicle: createSvgIcon('#3b82f6', '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
};

// ============================================
// MAIN COMPONENT
// ============================================
const GsoDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();

    // States
    const [searchTerm, setSearchTerm] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");
    
    // Validation Dialog States
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showValidateDialog, setShowValidateDialog] = useState(false);
    const [hasWatchedReplay, setHasWatchedReplay] = useState(false);
    
    // Replay States
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const replayIntervalRef = useRef(null);

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["gso-dashboard-vehicles"] });
        queryClient.invalidateQueries({ queryKey: ["gso-dashboard-trips"] });
        queryClient.invalidateQueries({ queryKey: ["gps-active-trips"] });
        queryClient.invalidateQueries({ queryKey: ["gso-pending-validation"] });
        queryClient.invalidateQueries({ queryKey: ["gso-fuel-ledger"] });
    }, [queryClient]);

    useAutoRefresh(["gso-trip-updated", "gps-active-trips", "trip-completed"], fetchAllData);

    // ============ QUERIES ============
    
    // 1. Vehicles
    const { data: vehiclesRaw = [], isLoading: vehiclesLoading } = useOptimizedQuery({
        queryKey: ["gso-dashboard-vehicles"],
        queryFn: async () => extractArray(await vehicleAPI.getAll()),
    });
    const vehicles = useMemo(() => Array.isArray(vehiclesRaw) ? vehiclesRaw : [], [vehiclesRaw]);

    // 2. Departments
    const { data: departmentsRaw = [] } = useOptimizedQuery({
        queryKey: ["gso-dashboard-departments"],
        queryFn: async () => extractArray(await departmentAPI.getAll()),
    });
    const departments = useMemo(() => Array.isArray(departmentsRaw) ? departmentsRaw : [], [departmentsRaw]);

    // 3. Active Trips (Live Map)
    const { data: activeTripsRaw = [], isLoading: activeTripsLoading } = useQuery({
        queryKey: ["gps-active-trips"],
        queryFn: async () => {
            try {
                const res = await gpsAPI.getActiveTrips();
                return Array.isArray(res.data?.data) ? res.data.data : [];
            } catch { return []; }
        },
        refetchInterval: 15000,
    });
    const activeTrips = useMemo(() => Array.isArray(activeTripsRaw) ? activeTripsRaw : [], [activeTripsRaw]);

    // 4. All Trips (For Recent list)
    const { data: allTripsRaw = [], isLoading: tripsLoading } = useOptimizedQuery({
        queryKey: ["gso-dashboard-trips"],
        queryFn: async () => extractArray(await gsoAPI.getAllTrips()),
    });
    const allTrips = useMemo(() => Array.isArray(allTripsRaw) ? allTripsRaw : [], [allTripsRaw]);

    // 5. Pending Validation (For Validation Table & Fuel Ledger)
    const { data: pendingValidationRaw = [], isLoading: validationLoading } = useOptimizedQuery({
        queryKey: ["gso-pending-validation"],
        queryFn: async () => extractArray(await gsoAPI.getPendingValidation()),
    });
    const pendingValidation = useMemo(() => Array.isArray(pendingValidationRaw) ? pendingValidationRaw : [], [pendingValidationRaw]);

    // 6. Fuel Ledger (If you have a separate API for past validated trips)
    const { data: fuelLedgerRaw = [], isLoading: ledgerLoading } = useOptimizedQuery({
        queryKey: ["gso-fuel-ledger"],
        queryFn: async () => extractArray(await gsoAPI.getFuelLedger()),
    });
    const fuelLedger = useMemo(() => Array.isArray(fuelLedgerRaw) ? fuelLedgerRaw : [], [fuelLedgerRaw]);

    // ============ MUTATIONS ============
    const validateMutation = useMutation({
        mutationFn: async ({ ticketId }) => {
            if (!ticketId) throw new Error("Ticket ID is missing");
            // Removed validationNote data
            const response = await gsoAPI.validateTrip(ticketId, {});
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Trip validated successfully!");
            queryClient.invalidateQueries({ queryKey: ["gso-pending-validation"] });
            queryClient.invalidateQueries({ queryKey: ["gso-dashboard-trips"] });
            queryClient.invalidateQueries({ queryKey: ["gso-fuel-ledger"] });
            setShowValidateDialog(false);
            setSelectedTicket(null);
            setHasWatchedReplay(false);
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || error.message || "Failed to validate trip");
        },
    });

    // ============ DERIVED DATA ============

    const totalVehicles = vehicles.length;
    const serviceable = vehicles.filter(v => v.status === 'active' && !v.maintenance_flag).length;
    const unserviceable = vehicles.filter(v => v.status !== 'active').length;
    const maintenance = vehicles.filter(v => v.maintenance_flag).length;

    const inUse = activeTrips.length;
    const available = totalVehicles - inUse;
    const utilizationPct = totalVehicles > 0 ? Math.round((inUse / totalVehicles) * 100) : 0;

    const recentTrips = useMemo(() => {
        return [...allTrips]
            .sort((a, b) => new Date(b.created_at || b.trip_date) - new Date(a.created_at || a.trip_date))
            .slice(0, 4);
    }, [allTrips]);

    const filteredVehicles = useMemo(() => {
        let result = vehicles;
        if (deptFilter !== "all") {
            result = result.filter(v => v.department_id?.toString() === deptFilter);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(v => 
                v.plate_number?.toLowerCase().includes(lower) ||
                v.vehicle_model?.toLowerCase().includes(lower) ||
                v.department?.department_name?.toLowerCase().includes(lower)
            );
        }
        return result.slice(0, 5);
    }, [vehicles, searchTerm, deptFilter]);

    const displayTripData = activeTrips.length > 0 ? activeTrips[0] : null;
    const displayVehicle = displayTripData?.vehicle;

    // ============================================
    // VALIDATION & REPLAY HANDLERS
    // ============================================
    
    const handleOpenValidateDialog = async (trip) => {
        setSelectedTicket(trip);
        setShowValidateDialog(true);
        setHasWatchedReplay(false);
        setRouteCoordinates([]);
        setLoadingRoute(true);

        try {
            const res = await gpsAPI.getTripRoute(trip.trip_ticket_id || trip.id);
            const track = res?.data?.data?.track || [];
            const coords = track.map(p => [p.latitude, p.longitude]);
            setRouteCoordinates(coords);
            
            // Auto-play the replay once coordinates are loaded
            if (coords.length >= 2) {
                setTimeout(() => {
                    startReplay(coords);
                }, 300); // Small delay to allow map bounds to initialize
            }
        } catch (e) {
            console.error("Failed to load route", e);
            toast.error("Could not load route replay data.");
        } finally {
            setLoadingRoute(false);
        }
    };

    const startReplay = (coords) => {
        if (isReplaying) handleStopReplay();

        setIsReplaying(true);
        setReplayIndex(0);
        setHasWatchedReplay(false);

        let currentIdx = 0;
        // Increased speed to 100ms per coordinate
        replayIntervalRef.current = setInterval(() => {
            currentIdx++;
            if (currentIdx >= coords.length) {
                clearInterval(replayIntervalRef.current);
                setIsReplaying(false);
                setReplayIndex(0);
                setHasWatchedReplay(true); // Enable confirm button
                return;
            }
            setReplayIndex(currentIdx);
        }, 100); 
    };

    const handleStopReplay = () => {
        setIsReplaying(false);
        setReplayIndex(0);
        if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current);
            replayIntervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
        };
    }, []);

    // ============================================
    // FUEL LEDGER DATA MAPPING
    // ============================================
    const pendingValidationLedger = useMemo(() => {
        return pendingValidation.map(trip => {
            const vehicle = vehicles.find(v => v.plate_number === trip.vehicle?.plate_number);
            const beginning = parseFloat(vehicle?.initial_estimated_fuel ?? vehicle?.current_fuel_balance ?? 0);
            const fuelIn = parseFloat(trip.liters_availed || trip.gas_slip?.fuel_receipt?.liters_availed || 0);
            const distance = parseFloat(trip.actual_distance_km || 0);
            const efficiency = parseFloat(vehicle?.reference_efficiency || 10);
            const fuelOut = distance > 0 ? (distance / efficiency) : 0;
            const balance = beginning + fuelIn - fuelOut;

            return {
                ...trip,
                beginning: beginning.toFixed(1),
                fuelIn: fuelIn.toFixed(1),
                fuelOut: fuelOut.toFixed(1),
                balance: balance.toFixed(1),
            };
        });
    }, [pendingValidation, vehicles]);

    return (
        <div className="min-h-screen bg-[#090e1a] p-4 md:p-6 font-sans text-slate-200">
            <div className="max-w-[1600px] mx-auto space-y-6">
                
                {/* 1. HERO HEADER */}
                <div className="relative overflow-hidden bg-gradient-to-r from-[#0f172a] via-[#1e3a8a] to-[#0f172a] rounded-2xl p-6 md:p-8 border border-blue-900/50 shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-none rounded-full px-3 py-1 text-[10px]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" /> GSO Office
                                </Badge>
                                <Badge className="bg-blue-600 text-white border-none rounded-full px-3 py-1 text-[10px]">General Services Office</Badge>
                                <Badge className="bg-purple-600 text-white border-none rounded-full px-3 py-1 text-[10px]">MIS Dashboard</Badge>
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">GSO Dashboard</h1>
                            <p className="text-blue-200/70 text-sm mt-1 max-w-lg">
                                Monitor vehicle status, fuel balance, and trip activities in MIS or Laguindingan.
                            </p>
                        </div>
                        
                        <div className="flex gap-3">
                            <Button onClick={fetchAllData} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl h-10 px-4">
                                <RefreshCw className={cn("h-4 w-4 mr-2", (vehiclesLoading || activeTripsLoading) && "animate-spin")} /> Refresh
                            </Button>
                            <Button onClick={() => navigate("/gso/create-trip")} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-10 px-6 shadow-lg shadow-blue-500/20">
                                <PlusCircle className="h-4 w-4 mr-2" /> Create Trip
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 2. STATS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">{totalVehicles}</p>
                                <p className="text-sm font-medium text-slate-300 mt-1">Total Vehicles</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Across All Departments</p>
                            </div>
                            <div className="p-3 bg-blue-600/20 rounded-xl"><Car className="h-6 w-6 text-blue-500" /></div>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">{serviceable}</p>
                                <p className="text-sm font-medium text-slate-300 mt-1">Serviceable</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Operational Condition</p>
                            </div>
                            <div className="p-3 bg-emerald-600/20 rounded-xl"><CheckCircle className="h-6 w-6 text-emerald-500" /></div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">{unserviceable}</p>
                                <p className="text-sm font-medium text-slate-300 mt-1">Unserviceable</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Not Fit for Operation</p>
                            </div>
                            <div className="p-3 bg-red-600/20 rounded-xl"><AlertTriangle className="h-6 w-6 text-red-500" /></div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">{maintenance}</p>
                                <p className="text-sm font-medium text-slate-300 mt-1">Under Maintenance</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Currently Being Serviced</p>
                            </div>
                            <div className="p-3 bg-amber-600/20 rounded-xl"><Wrench className="h-6 w-6 text-amber-500" /></div>
                        </CardContent>
                    </Card>
                </div>

                {/* 3. LIVE TRACKING & FUEL BALANCE MONITORING */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    <Card className="lg:col-span-2 bg-[#121829] border-slate-800 shadow-lg flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-500" /> Live Vehicle Tracking
                            </h3>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] text-emerald-400 font-medium">Real-time</span>
                            </div>
                        </div>
                        
                        <div className="flex-1 relative bg-[#0b101c] min-h-[350px]">
                            <MapContainer center={[8.5833, 124.6667]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0">
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <ZoomControl position="bottomright" />
                                {activeTrips.map(trip => {
                                    if (!trip.current_location) return null;
                                    return (
                                        <Marker key={trip.trip_id} position={[trip.current_location.latitude, trip.current_location.longitude]} icon={createVehicleIcon(trip.vehicle?.plate_number, trip.vehicle?.vehicle_model)} />
                                    );
                                })}
                            </MapContainer>

                            {displayTripData && displayVehicle && (
                                <div className="absolute top-4 right-4 z-[400] bg-[#121829]/95 backdrop-blur-md border border-slate-700 rounded-xl p-4 w-72 shadow-2xl">
                                    <div className="flex items-start justify-between mb-3 border-b border-slate-700 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Car className="h-5 w-5 text-blue-500" />
                                            <div>
                                                <p className="font-bold text-white text-sm">{displayVehicle.vehicle_model}</p>
                                                <p className="text-[10px] text-slate-400">Plate No. {displayVehicle.plate_number}</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2">In Transit</Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-2 text-xs mb-3">
                                        <span className="text-slate-500">Purpose</span>
                                        <span className="text-white text-right truncate">{displayTripData.purpose || "N/A"}</span>
                                        <span className="text-slate-500">Destination</span>
                                        <span className="text-white text-right truncate">{displayTripData.destination || "N/A"}</span>
                                    </div>

                                    <div className="bg-[#0b101c] rounded-lg p-3 mb-3">
                                        <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1"><Fuel className="h-3 w-3" /> Fuel Balance (Est.)</p>
                                        <div className="flex items-end gap-2 mb-1">
                                            <span className="text-xl font-bold text-white">{displayVehicle.current_fuel_balance?.toFixed(1) || 0} L</span>
                                            <span className="text-[10px] text-emerald-400 mb-1">
                                                {((displayVehicle.current_fuel_balance / displayVehicle.tank_capacity) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(displayVehicle.current_fuel_balance / displayVehicle.tank_capacity) * 100}%` }} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="flex items-center gap-1.5 text-slate-400"><Fuel className="h-3 w-3"/> Fuel Type: <span className="text-white capitalize">{displayVehicle.fuel_type}</span></div>
                                        <div className="flex items-center gap-1.5 text-slate-400"><Activity className="h-3 w-3"/> Efficiency: <span className="text-white">{displayVehicle.reference_efficiency} km/L</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-3 bg-[#0b101c] border-t border-slate-800 flex gap-4 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/> In Transit</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"/> Available</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"/> Maintenance</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/> Unserviceable</span>
                        </div>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg flex flex-col h-full">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Fuel className="h-4 w-4 text-blue-500" /> Fuel Balance Monitoring
                            </h3>
                            <button onClick={() => navigate('/admin/vehicles')} className="text-[10px] text-blue-400 hover:text-blue-300">View All →</button>
                        </div>
                        
                        <div className="p-3 border-b border-slate-800 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                <Input 
                                    placeholder="Search vehicle..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-[#0b101c] border-slate-700 text-white rounded-lg" 
                                />
                            </div>
                            <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="h-8 text-xs bg-[#0b101c] border border-slate-700 text-slate-300 rounded-lg px-2 outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="all">All Departments</option>
                                {departments.map(d => (
                                    <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-[#0b101c] text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Department</th>
                                        <th className="px-3 py-2 font-medium">Vehicle</th>
                                        <th className="px-3 py-2 font-medium">Plate No.</th>
                                        <th className="px-3 py-2 font-medium text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredVehicles.map(v => {
                                        const balance = parseFloat(v.current_fuel_balance || 0);
                                        const cap = parseFloat(v.tank_capacity || 60);
                                        const pct = Math.min(100, (balance / cap) * 100);
                                        return (
                                            <tr key={v.vehicle_id} className="hover:bg-[#1a2235]">
                                                <td className="px-3 py-3 truncate max-w-[80px]">{v.department?.department_name || 'GSO'}</td>
                                                <td className="px-3 py-3 font-medium text-white truncate max-w-[100px]">{v.vehicle_model}</td>
                                                <td className="px-3 py-3 font-mono">{v.plate_number}</td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={cn("font-bold", pct < 20 ? "text-red-400" : pct < 50 ? "text-amber-400" : "text-emerald-400")}>
                                                            {balance.toFixed(0)} L
                                                        </span>
                                                        <div className="w-16 h-1 bg-slate-800 rounded-full mt-1">
                                                            <div className={cn("h-1 rounded-full", pct < 20 ? "bg-red-500" : pct < 50 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* 4. BOTTOM ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="bg-[#121829] border-slate-800 shadow-lg p-4 flex flex-col">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Car className="h-4 w-4 text-blue-500" /> Vehicle Status
                        </h3>
                        <div className="grid grid-cols-2 gap-3 flex-1">
                            <div className="bg-[#0b101c] rounded-xl p-3 border border-slate-800 flex flex-col justify-between items-center">
                                <Car className="h-6 w-6 text-blue-500 mb-2" />
                                <span className="text-2xl font-bold text-white">{totalVehicles}</span>
                                <span className="text-[10px] text-slate-400">Total</span>
                            </div>
                            <div className="bg-emerald-950/20 rounded-xl p-3 border border-emerald-900/50 flex flex-col justify-between items-center">
                                <CheckCircle className="h-6 w-6 text-emerald-500 mb-2" />
                                <span className="text-2xl font-bold text-white">{serviceable}</span>
                                <span className="text-[10px] text-emerald-400">Serviceable</span>
                            </div>
                            <div className="bg-red-950/20 rounded-xl p-3 border border-red-900/50 flex flex-col justify-between items-center">
                                <AlertTriangle className="h-6 w-6 text-red-500 mb-2" />
                                <span className="text-2xl font-bold text-white">{unserviceable}</span>
                                <span className="text-[10px] text-red-400">Unserviceable</span>
                            </div>
                            <div className="bg-amber-950/20 rounded-xl p-3 border border-amber-900/50 flex flex-col justify-between items-center">
                                <Wrench className="h-6 w-6 text-amber-500 mb-2" />
                                <span className="text-2xl font-bold text-white">{maintenance}</span>
                                <span className="text-[10px] text-amber-400">Maintenance</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg p-4">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-blue-500" /> Vehicle Utilization
                        </h3>
                        
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex flex-col items-center">
                                <span className="text-2xl font-bold text-white">{inUse}</span>
                                <span className="text-[10px] text-slate-400">In Use</span>
                            </div>
                            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${utilizationPct}%` }} />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-2xl font-bold text-white">{available}</span>
                                <span className="text-[10px] text-slate-400">Available</span>
                            </div>
                        </div>

                        <div className="space-y-2 mt-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vehicles Currently in Use</p>
                            <table className="w-full text-xs text-left">
                                <thead className="text-slate-500 border-b border-slate-800">
                                    <tr>
                                        <th className="pb-2 font-medium">Department</th>
                                        <th className="pb-2 font-medium">Vehicle</th>
                                        <th className="pb-2 font-medium text-right">Destination</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {activeTrips.slice(0, 3).map((trip, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 text-slate-400 truncate max-w-[80px]">{trip.department || 'GSO'}</td>
                                            <td className="py-2 text-white truncate max-w-[100px]">{trip.vehicle?.vehicle_model}</td>
                                            <td className="py-2 text-right text-slate-300 truncate max-w-[100px]">{trip.destination || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg flex flex-col">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-500" /> Recent Trip Tickets
                            </h3>
                            <button onClick={() => navigate('/gso/trips')} className="text-[10px] text-blue-400 hover:text-blue-300">View All →</button>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-[#0b101c] text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Date</th>
                                        <th className="px-3 py-2 font-medium">TT Number</th>
                                        <th className="px-3 py-2 font-medium">Destination</th>
                                        <th className="px-3 py-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {recentTrips.map(trip => (
                                        <tr key={trip.trip_ticket_id} className="hover:bg-[#1a2235] cursor-pointer" onClick={() => navigate(`/gso/tickets/${trip.trip_ticket_id}`)}>
                                            <td className="px-3 py-2 whitespace-nowrap">{formatDateShort(trip.trip_date)}</td>
                                            <td className="px-3 py-2 font-mono text-white">{trip.trip_ticket_number}</td>
                                            <td className="px-3 py-2 truncate max-w-[100px]">{trip.destination}</td>
                                            <td className="px-3 py-2">
                                                <Badge className={cn("text-[9px] px-1.5 py-0.5", trip.status === 'in_transit' ? "bg-emerald-600" : trip.status === 'closed' ? "bg-blue-600" : "bg-slate-600")}>
                                                    {trip.status.replace(/_/g, ' ')}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* ============================================================ */}
                {/* 5. PENDING VALIDATION SECTION (UPDATED TO MATCH SCREENSHOT) */}
                {/* ============================================================ */}
                <Card className="bg-[#121829] border-slate-800 shadow-lg">
                    <CardHeader className="border-b border-slate-800 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <FileCheck className="h-5 w-5 text-blue-500" /> Pending Validation & Fuel Ledger
                                </CardTitle>
                                <p className="text-xs text-slate-400 mt-1">Trips completed by the driver, awaiting GSO validation and fuel balance confirmation.</p>
                            </div>
                            <Badge className="bg-blue-600 text-white">{pendingValidation.length} tickets</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-[#0b101c] text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Date</th>
                                        <th className="px-4 py-3 font-medium">TT No.</th>
                                        <th className="px-4 py-3 font-medium">Vehicle</th>
                                        <th className="px-4 py-3 font-medium text-right">Beginning (L)</th>
                                        <th className="px-4 py-3 font-medium text-right">Fuel In (L)</th>
                                        <th className="px-4 py-3 font-medium text-right">Fuel Out (L)</th>
                                        <th className="px-4 py-3 font-medium text-right">Balance (L)</th>
                                        <th className="px-4 py-3 font-medium text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {validationLoading ? (
                                        <tr><td colSpan={8} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-500"/></td></tr>
                                    ) : pendingValidationLedger.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-6 text-slate-500">No pending validations.</td></tr>
                                    ) : pendingValidationLedger.map(trip => (
                                        <tr key={trip.trip_ticket_id || trip.id} className="hover:bg-[#1a2235]">
                                            <td className="px-4 py-3 whitespace-nowrap">{formatDateShort(trip.trip_date)}</td>
                                            <td className="px-4 py-3 font-mono text-white">{trip.trip_ticket_number || trip.ticket_number}</td>
                                            <td className="px-4 py-3">{trip.vehicle?.plate_number || 'N/A'}</td>
                                            <td className="px-4 py-3 text-right text-slate-400">{trip.beginning}</td>
                                            <td className="px-4 py-3 text-right text-emerald-400">{trip.fuelIn}</td>
                                            <td className="px-4 py-3 text-right text-red-400">{trip.fuelOut}</td>
                                            <td className="px-4 py-3 text-right font-bold text-white">{trip.balance}</td>
                                            <td className="px-4 py-3 text-center">
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => handleOpenValidateDialog(trip)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs"
                                                >
                                                    <Check className="h-3.5 w-3.5 mr-1" /> Review & Validate
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* ============================================================ */}
            {/* VALIDATE & REPLAY DIALOG */}
            {/* ============================================================ */}
            <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
                <DialogContent className="sm:max-w-6xl bg-[#0f172a] border-slate-700 p-0 overflow-hidden rounded-2xl">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-500 border border-blue-500/30">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Trip Validation</h2>
                                <p className="text-xs text-slate-400">Review the completed trip details before confirming.</p>
                            </div>
                        </div>
                        <button onClick={() => setShowValidateDialog(false)} className="text-slate-400 hover:text-white transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row h-[600px]">
                        <div className="w-full md:w-[320px] bg-[#121829] border-r border-slate-800 p-6 overflow-y-auto flex-shrink-0">
                            <div className="space-y-5">
                                <div className="flex items-start gap-3">
                                    <Calendar className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Trip Ticket No.</p>
                                        <p className="text-sm font-bold text-white font-mono">{selectedTicket?.trip_ticket_number || selectedTicket?.ticket_number}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <User className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Driver</p>
                                        <p className="text-sm font-bold text-white">{selectedTicket?.driver_name || selectedTicket?.driver?.name || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Users className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Passenger</p>
                                        <p className="text-sm font-bold text-white">{selectedTicket?.passenger_name || selectedTicket?.passenger || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Car className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Vehicle</p>
                                        <p className="text-sm font-bold text-white">{selectedTicket?.vehicle?.vehicle_model || 'N/A'}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{selectedTicket?.vehicle?.plate_number || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Target className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Purpose</p>
                                        <p className="text-sm font-bold text-white">{selectedTicket?.purpose || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Flag className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Destination</p>
                                        <p className="text-sm font-bold text-white">{selectedTicket?.destination || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Route className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Actual Distance</p>
                                        <p className="text-sm font-bold text-white">{selectedTicket?.actual_distance_km || 0} km</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 relative bg-[#0b101c] flex flex-col">
                            <div className="flex-1 relative">
                                {loadingRoute ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                    </div>
                                ) : routeCoordinates.length > 0 ? (
                                    <MapContainer bounds={routeCoordinates} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                        <Polyline 
                                            positions={routeCoordinates.filter((coord, idx, arr) => {
                                                if (idx === 0) return true;
                                                const prev = arr[idx - 1];
                                                const R = 6371e3; 
                                                const lat1 = prev[0] * Math.PI / 180;
                                                const lat2 = coord[0] * Math.PI / 180;
                                                const deltaLat = (coord[0] - prev[0]) * Math.PI / 180;
                                                const deltaLon = (coord[1] - prev[1]) * Math.PI / 180;
                                                const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
                                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                                return (R * c) < 500; 
                                            })} 
                                            color="#3b82f6" weight={4} opacity={0.8} 
                                        />
                                        <Marker position={routeCoordinates[0]} icon={icons.start} />
                                        <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={icons.end} />
                                        {isReplaying && <Marker position={routeCoordinates[replayIndex]} icon={icons.vehicle} />}
                                    </MapContainer>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                                        <MapPin className="h-8 w-8 mb-2" />
                                        <p>No route data available</p>
                                    </div>
                                )}

                                {routeCoordinates.length > 0 && (
                                    <div className="absolute top-4 left-4 z-[400] flex items-center gap-3 bg-[#121829]/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-700 shadow-xl">
                                        <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", isReplaying ? "bg-blue-500/20 text-blue-500" : "bg-slate-700 text-slate-400")}>
                                            {isReplaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                                            {isReplaying ? 'Auto Playing...' : 'Replay Finished'}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {isReplaying ? `${replayIndex} / ${routeCoordinates.length}` : 'Live Tracking'}
                                        </span>
                                    </div>
                                )}

                                <div className="absolute top-4 right-4 z-[400] flex items-center gap-4 bg-[#121829]/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-700 shadow-xl text-xs text-white">
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Start</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-blue-500 rounded-full"></span> Route</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500"></span> Destination</span>
                                </div>
                            </div>

                            {/* UPDATED: Removed Textarea, only Confirm button */}
                            <div className="p-4 bg-[#121829] border-t border-slate-800 flex items-center justify-end">
                                <Button 
                                    onClick={() => {
                                        const ticketId = selectedTicket?.trip_ticket_id || selectedTicket?.id;
                                        validateMutation.mutate({ ticketId });
                                    }} 
                                    disabled={validateMutation.isPending || !hasWatchedReplay}
                                    className={cn(
                                        "text-white font-bold h-10 px-8 rounded-xl shadow-lg transition-all",
                                        hasWatchedReplay ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20" : "bg-slate-700 text-slate-400 cursor-not-allowed shadow-none"
                                    )}
                                    title={!hasWatchedReplay ? "Please wait for the replay to finish" : "Confirm Validation"}
                                >
                                    {validateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Check className="h-4 w-4 mr-2"/>}
                                    {hasWatchedReplay ? "Confirm" : "Waiting for Replay..."}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default GsoDashboard;