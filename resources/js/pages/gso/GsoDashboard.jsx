// src/pages/gso/GsoDashboard.jsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { gsoAPI, vehicleAPI, gpsAPI } from "../../services/api";
import {
    Car, CheckCircle, AlertTriangle, Wrench, RefreshCw, MapPin, Search,
    ChevronDown, Activity, PlusCircle, ArrowRight, Fuel, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ============================================
// HELPERS
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

// ============================================
// MAIN COMPONENT
// ============================================
const GsoDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();

    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["gso-dashboard-vehicles"] });
        queryClient.invalidateQueries({ queryKey: ["gso-dashboard-trips"] });
        queryClient.invalidateQueries({ queryKey: ["gps-active-trips"] });
    }, [queryClient]);

    useAutoRefresh(["gso-trip-updated", "gps-active-trips", "trip-completed"], fetchAllData);

    // ============ QUERIES ============
    
    // 1. Vehicles (Para sa Stats ug Fuel Balance Monitoring)
    const { data: vehiclesRaw = [], isLoading: vehiclesLoading } = useOptimizedQuery({
        queryKey: ["gso-dashboard-vehicles"],
        queryFn: async () => extractArray(await vehicleAPI.getAll()),
    });
    const vehicles = useMemo(() => Array.isArray(vehiclesRaw) ? vehiclesRaw : [], [vehiclesRaw]);

    // 2. Active Trips (Para sa Map ug Utilization)
    const { data: activeTrips = [], isLoading: activeTripsLoading } = useQuery({
        queryKey: ["gps-active-trips"],
        queryFn: async () => {
            try {
                const res = await gpsAPI.getActiveTrips();
                return Array.isArray(res.data?.data) ? res.data.data : [];
            } catch { return []; }
        },
        refetchInterval: 15000,
    });

    // 3. Recent Trips (Para sa Recent Trip Tickets table)
    const { data: allTripsRaw = [], isLoading: tripsLoading } = useOptimizedQuery({
        queryKey: ["gso-dashboard-trips"],
        queryFn: async () => extractArray(await gsoAPI.getAllTrips()),
    });
    const allTrips = useMemo(() => Array.isArray(allTripsRaw) ? allTripsRaw : [], [allTripsRaw]);

    // ============ DERIVED DATA ============
    
    // Stats
    const totalVehicles = vehicles.length;
    const serviceable = vehicles.filter(v => v.status === 'active' && !v.maintenance_flag).length;
    const unserviceable = vehicles.filter(v => v.status !== 'active').length;
    const maintenance = vehicles.filter(v => v.maintenance_flag).length;

    // Utilization
    const inUse = activeTrips.length;
    const available = totalVehicles - inUse;
    const utilizationPct = totalVehicles > 0 ? Math.round((inUse / totalVehicles) * 100) : 0;

    // Recent Trips (Limit to 4)
    const recentTrips = useMemo(() => {
        return [...allTrips]
            .sort((a, b) => new Date(b.created_at || b.trip_date) - new Date(a.created_at || a.trip_date))
            .slice(0, 4);
    }, [allTrips]);

    // Selected vehicle for the Map popup (defaults to the first active trip)
    const displayVehicle = selectedVehicle || (activeTrips.length > 0 ? activeTrips[0].vehicle : null);
    const displayTripData = activeTrips.find(t => t.vehicle?.plate_number === displayVehicle?.plate_number);

    // Filtered Vehicles for the Fuel Monitoring Table
    const filteredVehicles = useMemo(() => {
        if (!searchTerm) return vehicles;
        const lower = searchTerm.toLowerCase();
        return vehicles.filter(v => 
            v.plate_number?.toLowerCase().includes(lower) ||
            v.vehicle_model?.toLowerCase().includes(lower) ||
            v.department?.department_name?.toLowerCase().includes(lower)
        );
    }, [vehicles, searchTerm]);


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
                                <Badge className="bg-blue-600 text-white border-none rounded-full px-3 py-1 text-[10px]">
                                    General Services Office
                                </Badge>
                                <Badge className="bg-purple-600 text-white border-none rounded-full px-3 py-1 text-[10px]">
                                    MIS Dashboard
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">GSO Dashboard</h1>
                            <p className="text-blue-200/70 text-sm mt-1 max-w-lg">
                                Monitor vehicle status, fuel balance, and trip activities in MIS or Laguindingan.
                            </p>
                        </div>
                        
                        <div className="flex gap-3">
                            <Button 
                                onClick={fetchAllData} 
                                variant="outline" 
                                className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl h-10 px-4"
                            >
                                <RefreshCw className={cn("h-4 w-4 mr-2", (vehiclesLoading || activeTripsLoading) && "animate-spin")} /> Refresh
                            </Button>
                            <Button 
                                onClick={() => navigate("/gso/create-trip")} 
                                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-10 px-6 shadow-lg shadow-blue-500/20"
                            >
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
                            <div className="p-3 bg-blue-600/20 rounded-xl">
                                <Car className="h-6 w-6 text-blue-500" />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">{serviceable}</p>
                                <p className="text-sm font-medium text-slate-300 mt-1">Serviceable</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Operational Condition</p>
                            </div>
                            <div className="p-3 bg-emerald-600/20 rounded-xl">
                                <CheckCircle className="h-6 w-6 text-emerald-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">{unserviceable}</p>
                                <p className="text-sm font-medium text-slate-300 mt-1">Unserviceable</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Not Fit for Operation</p>
                            </div>
                            <div className="p-3 bg-red-600/20 rounded-xl">
                                <AlertTriangle className="h-6 w-6 text-red-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">{maintenance}</p>
                                <p className="text-sm font-medium text-slate-300 mt-1">Under Maintenance</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Currently Being Serviced</p>
                            </div>
                            <div className="p-3 bg-amber-600/20 rounded-xl">
                                <Wrench className="h-6 w-6 text-amber-500" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 3. LIVE TRACKING & FUEL BALANCE MONITORING */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Live Vehicle Tracking (Map) */}
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
                            {/* NOTE: Diri nimo ibutang ang imong Map Component (RouteMap or MapContainer) */}
                            {/* Sample Placeholder para makita ang layout */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-30 bg-[url('https://tile.openstreetmap.org/10/550/375.png')] bg-cover bg-center" />
                            
                            {/* Floating Info Card (Same sa picture) */}
                            {displayTripData && (
                                <div className="absolute top-4 right-4 bg-[#121829]/95 backdrop-blur-md border border-slate-700 rounded-xl p-4 w-72 shadow-2xl">
                                    <div className="flex items-start justify-between mb-3 border-b border-slate-700 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Car className="h-5 w-5 text-blue-500" />
                                            <div>
                                                <p className="font-bold text-white text-sm">{displayVehicle?.vehicle_model}</p>
                                                <p className="text-[10px] text-slate-400">Plate No. {displayVehicle?.plate_number}</p>
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
                                            <span className="text-xl font-bold text-white">{displayVehicle?.current_fuel_balance?.toFixed(1) || 0} L</span>
                                            <span className="text-[10px] text-emerald-400 mb-1">56.3%</span>
                                        </div>
                                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "56%" }} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="flex items-center gap-1.5 text-slate-400"><Fuel className="h-3 w-3"/> Fuel Type: <span className="text-white">{displayVehicle?.fuel_type}</span></div>
                                        <div className="flex items-center gap-1.5 text-slate-400"><Activity className="h-3 w-3"/> Efficiency: <span className="text-white">{displayVehicle?.reference_efficiency} km/L</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Legend */}
                        <div className="p-3 bg-[#0b101c] border-t border-slate-800 flex gap-4 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/> In Transit</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"/> Available</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"/> Maintenance</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/> Unserviceable</span>
                        </div>
                    </Card>

                    {/* Fuel Balance Monitoring (Table) */}
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
                            <Button variant="outline" className="h-8 text-xs border-slate-700 text-slate-300 bg-[#0b101c]">
                                All Departments <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
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
                                    {filteredVehicles.slice(0, 5).map(v => {
                                        const balance = parseFloat(v.current_fuel_balance || 0);
                                        const cap = parseFloat(v.tank_capacity || 60);
                                        const pct = Math.min(100, (balance / cap) * 100);
                                        return (
                                            <tr key={v.vehicle_id} className="hover:bg-[#1a2235]">
                                                <td className="px-3 py-3">{v.department?.department_name || 'GSO'}</td>
                                                <td className="px-3 py-3 font-medium text-white">{v.vehicle_model}</td>
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

                {/* 4. BOTTOM ROW: Vehicle Status, Utilization, Recent Trips */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Vehicle Status */}
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

                    {/* Vehicle Utilization */}
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
                                <div className="bg-blue-600 h-full" style={{ width: `${utilizationPct}%` }} />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-2xl font-bold text-white">{available}</span>
                                <span className="text-[10px] text-slate-400">Available</span>
                            </div>
                        </div>

                        <div className="space-y-2 mt-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vehicles Currently In Use</p>
                            <table className="w-full text-xs text-left">
                                <tbody className="divide-y divide-slate-800/50">
                                    {activeTrips.slice(0, 3).map((trip, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 text-slate-400">{trip.department || 'GSO'}</td>
                                            <td className="py-2 text-white">{trip.vehicle?.vehicle_model}</td>
                                            <td className="py-2 font-mono text-slate-400">{trip.vehicle?.plate_number}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Recent Trip Tickets */}
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

            </div>
        </div>
    );
};

export default GsoDashboard;