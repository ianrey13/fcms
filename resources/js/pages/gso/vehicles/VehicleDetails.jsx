// src/pages/gso/vehicles/VehicleDetails.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVehicles } from '../../../hooks/useVehicleManagement';
import { gpsAPI, gsoAPI } from '../../../services/api';
// ✅ GIBALIK ANG POLYLINE
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'; 
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import {
    ArrowLeft, Car, Fuel, Gauge, MapPin, Clock, User, 
    Building2, Activity, Navigation, Play, Square, Loader2,
    Maximize2, Minimize2, Info, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { format, startOfWeek } from 'date-fns';

// ============================================
// CUSTOM MAP ICONS
// ============================================
const createSvgIcon = (color, iconPath) => {
    return L.divIcon({
        className: 'custom-svg-icon',
        html: `<div style="
            background-color: ${color};
            width: 28px; height: 28px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        ">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                ${iconPath}
            </svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
};

const icons = {
    vehicle: createSvgIcon('#3b82f6', '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
    start: createSvgIcon('#22c55e', '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>'),
    end: createSvgIcon('#ef4444', '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>'),
};

// Map Component to Fit Bounds
const MapBoundsUpdater = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map]);
    return null;
};

const VehicleDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [chartRange, setChartRange] = useState('7d');
    
    const { data: vehicles = [], isLoading } = useVehicles();
    const vehicle = vehicles.find(v => v.vehicle_id === parseInt(id));

    // State for History
    const [selectedHistoryTrip, setSelectedHistoryTrip] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const replayIntervalRef = useRef(null);
    const [isMapExpanded, setIsMapExpanded] = useState(false);

    useEffect(() => {
        return () => {
            if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
        };
    }, []);

    // Fetch Trip History
    const { data: historyData = [], isLoading: historyLoading } = useQuery({
        queryKey: ['vehicle-history', id],
        queryFn: async () => {
            const res = await gpsAPI.getCompletedTrips({ limit: 50 });
            const trips = res?.data?.data || [];
            return trips.filter(t => t.plate_number === vehicle?.plate_number);
        },
        enabled: !!vehicle
    });

    const assignedDriver = historyData?.[0]?.driver_name || "Unassigned";

    // Fetch Fuel Receipts
    const { data: fuelReceipts = [], isLoading: fuelLoading } = useQuery({
        queryKey: ['vehicle-fuel-receipts', vehicle?.plate_number],
        queryFn: async () => {
            const res = await gsoAPI.getFuelReceipts();
            const allReceipts = res?.data?.data || [];
            return allReceipts.filter(r => r.plate_number === vehicle?.plate_number);
        },
        enabled: !!vehicle
    });

    // ✅ SIMPLIFIED WEEKLY CHART DATA
    const chartData = useMemo(() => {
        if (!vehicle) return { labels: [], fuelIn: [], fuelOut: [], max: 100 };
        
        const eff = parseFloat(vehicle.reference_efficiency || 10);
        
        const weeklyData = {};

        // Process Receipts (Fuel In)
        fuelReceipts.forEach(r => {
            const d = new Date(r.uploaded_at);
            const weekStart = startOfWeek(d, { weekStartsOn: 1 });
            const weekLabel = format(weekStart, 'MMM dd');
            
            if (!weeklyData[weekLabel]) weeklyData[weekLabel] = { in: 0, out: 0, date: weekStart };
            weeklyData[weekLabel].in += parseFloat(r.liters || 0);
        });

        // Process Trips (Fuel Out)
        historyData.forEach(t => {
            const d = new Date(t.updated_at || t.trip_date);
            const weekStart = startOfWeek(d, { weekStartsOn: 1 });
            const weekLabel = format(weekStart, 'MMM dd');
            const dist = parseFloat(t.actual_distance_km || 0);
            
            if (!weeklyData[weekLabel]) weeklyData[weekLabel] = { in: 0, out: 0, date: weekStart };
            weeklyData[weekLabel].out += (dist / eff);
        });

        // Sort weeks and limit based on range
        let weeks = Object.keys(weeklyData).sort((a, b) => weeklyData[a].date - weeklyData[b].date);
        
        if (chartRange === '7d') weeks = weeks.slice(-2);
        else if (chartRange === '30d') weeks = weeks.slice(-4);
        
        const labels = weeks;
        const fuelIn = weeks.map(w => weeklyData[w].in);
        const fuelOut = weeks.map(w => weeklyData[w].out);
        const max = Math.max(...fuelIn, ...fuelOut, 10) * 1.2;

        return { labels, fuelIn, fuelOut, max };
    }, [vehicle, fuelReceipts, historyData, chartRange]);

    const handleViewRoute = async (trip) => {
        setSelectedHistoryTrip(trip);
        setLoadingRoute(true);
        setRouteCoordinates([]); 
        handleStopReplay();
        try {
            const res = await gpsAPI.getTripRoute(trip.trip_id);
            const track = res?.data?.data?.track || [];
            setRouteCoordinates(track.map(p => [p.latitude, p.longitude]));
        } catch (e) {
            console.error("Failed to load route", e);
        } finally {
            setLoadingRoute(false);
        }
    };

    const handleStopReplay = () => {
        setIsReplaying(false);
        setReplayIndex(0);
        if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current);
            replayIntervalRef.current = null;
        }
    };

    const handleReplay = () => {
        if (!routeCoordinates || routeCoordinates.length < 2) return;
        if (isReplaying) { handleStopReplay(); return; }

        setIsReplaying(true);
        setReplayIndex(0);

        let currentIdx = 0;
        replayIntervalRef.current = setInterval(() => {
            currentIdx++;
            if (currentIdx >= routeCoordinates.length) {
                clearInterval(replayIntervalRef.current);
                setIsReplaying(false);
                setReplayIndex(0);
                return;
            }
            setReplayIndex(currentIdx);
        }, 300);
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading vehicle details...</div>;
    if (!vehicle) return <div className="p-8 text-center text-red-500">Vehicle not found.</div>;

    const fuelPct = vehicle.fuel_percentage || 0;
    const currentFuel = parseFloat(vehicle.current_fuel_balance || 0);
    const tankCap = parseFloat(vehicle.tank_capacity || 60);
    const refEff = parseFloat(vehicle.reference_efficiency || 10);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 font-sans">
            
            {/* Header */}
            <div className="mb-6">
                <button onClick={() => navigate('/admin/vehicles')} className="flex items-center text-sm text-slate-500 hover:text-blue-600 mb-2 transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to Vehicles
                </button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vehicle Details</h1>
            </div>

            {/* Top Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <Card className="lg:col-span-2 dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row overflow-hidden">
                    <div className="p-6 bg-slate-100/50 dark:bg-slate-800/30 flex items-center justify-center md:w-1/3">
                        <Car className="h-20 w-20 text-slate-300 dark:text-slate-700" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{vehicle.plate_number}</h2>
                                    <Badge className={cn("px-2 py-1", vehicle.status === 'active' ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100")}>
                                        ● {vehicle.status === 'active' ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                                <p className="text-slate-500 text-sm">
                                    {vehicle.vehicle_model} • {vehicle.fuel_type} • {vehicle.maintenance_flag ? 'Under Maintenance' : 'Serviceable'}
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/vehicles/edit/${id}`)}>Edit</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                            <div className="flex items-center gap-2">
                                <User className="h-8 w-8 p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full" />
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider">Assigned Driver</p>
                                    <p className="font-medium text-slate-800 dark:text-slate-200">{assignedDriver}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Building2 className="h-8 w-8 p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full" />
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider">Department</p>
                                    <p className="font-medium text-slate-800 dark:text-slate-200">{vehicle.department?.department_name || 'Engineering Office'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col items-center justify-center relative">
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                        <Fuel className="h-4 w-4 text-blue-500" />
                        <h3 className="font-bold text-slate-800 dark:text-white">Fuel Information</h3>
                    </div>
                    <div className="relative w-32 h-32 mt-6">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path className="text-blue-500" strokeDasharray={`${fuelPct}, 100`} strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{currentFuel.toFixed(1)} L</span>
                            <span className="text-[10px] text-slate-400 uppercase">Current Fuel</span>
                        </div>
                    </div>
                    <div className="w-full mt-6 space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-slate-500 flex items-center gap-1"><Fuel className="h-3 w-3"/> Tank Capacity</span><span className="font-semibold text-slate-800 dark:text-white">{tankCap.toFixed(1)} L</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500 flex items-center gap-1"><Activity className="h-3 w-3"/> Fuel Efficiency</span><span className="font-semibold text-slate-800 dark:text-white">{refEff} km/L</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500 flex items-center gap-1"><Navigation className="h-3 w-3"/> Estimated Range</span><span className="font-semibold text-slate-800 dark:text-white">~ {Math.round(currentFuel * refEff)} km</span></div>
                    </div>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
                {['overview', 'fuel', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 capitalize",
                            activeTab === tab ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        {tab === 'overview' && <Car className="h-4 w-4" />}
                        {tab === 'fuel' && <Fuel className="h-4 w-4" />}
                        {tab === 'history' && <MapPin className="h-4 w-4" />}
                        {tab === 'history' ? 'Trip History & Routes' : tab}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Car className="h-5 w-5"/> Vehicle Information</h3>
                        <div className="grid grid-cols-2 gap-y-4 text-sm">
                            <div><span className="text-slate-500">Plate No.</span><p className="font-semibold text-slate-800 dark:text-white">{vehicle.plate_number}</p></div>
                            <div><span className="text-slate-500">Make / Model</span><p className="font-semibold text-slate-800 dark:text-white">{vehicle.vehicle_model}</p></div>
                            <div><span className="text-slate-500">Fuel Type</span><p className="font-semibold text-slate-800 dark:text-white capitalize">{vehicle.fuel_type}</p></div>
                            <div><span className="text-slate-500">Assigned Department</span><p className="font-semibold text-slate-800 dark:text-white">{vehicle.department?.department_name}</p></div>
                        </div>
                    </Card>
                </div>
            )}

            {/* ✅ TAB CONTENT: FUEL (WEEKLY CHART ONLY) */}
            {activeTab === 'fuel' && (
                <div className="space-y-6">
                    <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                                    <Activity className="h-5 w-5 text-blue-500"/> Fuel Balance History
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Weekly summary of fuel added and consumed.</p>
                            </div>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                <button onClick={() => setChartRange('7d')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", chartRange === '7d' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>Last 2 Weeks</button>
                                <button onClick={() => setChartRange('30d')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", chartRange === '30d' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>Last 4 Weeks</button>
                                <button onClick={() => setChartRange('3m')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", chartRange === '3m' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>All Time</button>
                            </div>
                        </div>

                        {fuelLoading || historyLoading ? (
                            <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                        ) : chartData.labels.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                                <Fuel className="h-10 w-10 mb-2 opacity-50" />
                                <p>No fuel or trip history found for this range.</p>
                            </div>
                        ) : (
                            <div className="h-72 w-full mt-4 flex items-end justify-around gap-2 md:gap-8 pb-8 border-b border-slate-200 dark:border-slate-700 relative">
                                {/* Y-Axis Labels (Simplified) */}
                                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[10px] text-slate-400 font-mono">
                                    <span>{Math.round(chartData.max)} L</span>
                                    <span>0 L</span>
                                </div>

                                {/* Bars */}
                                <div className="flex-1 flex justify-around items-end h-full ml-8">
                                    {chartData.labels.map((label, idx) => {
                                        const inVal = chartData.fuelIn[idx];
                                        const outVal = chartData.fuelOut[idx];
                                        const inPct = (inVal / chartData.max) * 100;
                                        const outPct = (outVal / chartData.max) * 100;

                                        return (
                                            <div key={idx} className="flex flex-col items-center group w-1/3 max-w-[100px]">
                                                <div className="flex items-end justify-center gap-1 h-full w-full">
                                                    {/* Fuel In Bar */}
                                                    <div className="relative w-1/2 flex justify-center group-hover:opacity-80 transition-opacity" style={{ height: `${inPct}%` }}>
                                                        <div className="w-full bg-emerald-500 rounded-t-md relative">
                                                            {inVal > 0 && (
                                                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-500">
                                                                    +{inVal.toFixed(1)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Fuel Out Bar */}
                                                    <div className="relative w-1/2 flex justify-center group-hover:opacity-80 transition-opacity" style={{ height: `${outPct}%` }}>
                                                        <div className="w-full bg-orange-500 rounded-t-md relative">
                                                            {outVal > 0 && (
                                                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-orange-500">
                                                                    -{outVal.toFixed(1)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-medium mt-4 text-center">{label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Legend */}
                        <div className="flex justify-center gap-6 mt-4">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                                <span className="w-3 h-3 rounded-sm bg-emerald-500"></span> Fuel In (+) 
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                                <span className="w-3 h-3 rounded-sm bg-orange-500"></span> Fuel Out (-)
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* TAB CONTENT: HISTORY */}
            {activeTab === 'history' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Trip List Sidebar */}
                    <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col h-[600px] overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                            <h3 className="font-bold text-slate-800 dark:text-white">Past Trips</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {historyLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
                            ) : historyData?.length === 0 ? (
                                <p className="text-center text-sm text-slate-500 py-8">No completed trips.</p>
                            ) : (
                                historyData?.map(trip => (
                                    <div 
                                        key={trip.trip_id}
                                        onClick={() => handleViewRoute(trip)}
                                        className={cn("p-3 rounded-lg border cursor-pointer transition-all", selectedHistoryTrip?.trip_id === trip.trip_id ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800")}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-sm text-slate-800 dark:text-white">{trip.ticket_number}</span>
                                            <Badge variant="outline" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500">{trip.status}</Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-1">{trip.destination}</p>
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {trip.trip_date}</span>
                                            <span className="flex items-center gap-1"><Navigation className="h-3 w-3" /> {trip.actual_distance_km ? `${trip.actual_distance_km} km` : 'N/A'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Map Area */}
                    <Card className={cn(
                        "dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-[600px] overflow-hidden relative transition-all duration-300",
                        isMapExpanded ? "fixed inset-4 z-[9999] h-auto" : "lg:col-span-2"
                    )}>
                        
                        {/* Expand / Collapse Button */}
                        {selectedHistoryTrip && (
                            <Button 
                                variant="secondary" 
                                size="icon" 
                                onClick={() => setIsMapExpanded(!isMapExpanded)}
                                className="absolute top-4 right-4 z-[1000] shadow-md rounded-full bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800"
                            >
                                {isMapExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                        )}

                        {/* Replay Controls */}
                        {selectedHistoryTrip && routeCoordinates.length > 1 && !isMapExpanded && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Route Replay</span>
                                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
                                <button onClick={handleReplay} className={cn("p-1.5 rounded-full transition-colors flex items-center justify-center", isReplaying ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-blue-100 text-blue-600 hover:bg-blue-200")}>
                                    {isReplaying ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                                </button>
                                <span className="text-[10px] text-slate-500 font-mono">{isReplaying ? `${replayIndex} / ${routeCoordinates.length}` : `${routeCoordinates.length} pings`}</span>
                            </div>
                        )}

                        {selectedHistoryTrip && routeCoordinates.length > 0 ? (
                            <MapContainer bounds={routeCoordinates} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapBoundsUpdater bounds={routeCoordinates} />
                                
                                {/* ✅ GIBALIK ANG POLYLINE PERO MAY FILTER PARA DILI MAG-GUBOT */}
                                <Polyline 
                                    positions={routeCoordinates} 
                                    color="#3b82f6" 
                                    weight={4} 
                                    opacity={0.8} 
                                />

                                <Marker position={routeCoordinates[0]} icon={icons.start} />
                                <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={icons.end} />
                                {isReplaying && <Marker position={routeCoordinates[replayIndex]} icon={icons.vehicle} />}
                            </MapContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                                <MapPin className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                                <p className="text-slate-500 text-sm">Select a trip to view its GPS route.</p>
                            </div>
                        )}
                        
                        {/* ✅ FULL DETAILS PANEL (Only shown when expanded) */}
                        {isMapExpanded && selectedHistoryTrip && (
                            <div className="absolute top-4 left-4 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-5 w-[320px]">
                                <div className="flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                                    <FileText className="h-5 w-5 text-blue-500" />
                                    <h3 className="font-bold text-slate-900 dark:text-white">Trip Ticket Details</h3>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between"><span className="text-slate-500">Ticket No.</span><span className="font-mono text-slate-900 dark:text-white">{selectedHistoryTrip.ticket_number}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Vehicle</span><span className="font-semibold text-slate-900 dark:text-white">{selectedHistoryTrip.plate_number} ({selectedHistoryTrip.vehicle_model})</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Driver</span><span className="text-slate-900 dark:text-white">{selectedHistoryTrip.driver_name}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="text-slate-900 dark:text-white text-right max-w-[180px]">{selectedHistoryTrip.destination}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Purpose</span><span className="text-slate-900 dark:text-white text-right max-w-[180px]">{selectedHistoryTrip.purpose}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Distance</span><span className="text-slate-900 dark:text-white">{selectedHistoryTrip.actual_distance_km} km</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="text-slate-900 dark:text-white">{selectedHistoryTrip.trip_date}</span></div>
                                </div>
                            </div>
                        )}

                        {/* Replay Controls (Expanded Mode) */}
                        {isMapExpanded && selectedHistoryTrip && routeCoordinates.length > 1 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-white dark:bg-slate-800 px-6 py-3 rounded-full shadow-2xl border border-slate-200 dark:border-slate-700">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Replay Trip</span>
                                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
                                <button onClick={handleReplay} className={cn("p-2 rounded-full transition-colors flex items-center justify-center", isReplaying ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-blue-100 text-blue-600 hover:bg-blue-200")}>
                                    {isReplaying ? <Square className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-1" />}
                                </button>
                                <span className="text-xs text-slate-500 font-mono">{isReplaying ? `${replayIndex} / ${routeCoordinates.length}` : `${routeCoordinates.length} pings`}</span>
                            </div>
                        )}

                        {loadingRoute && (
                            <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading route...</p>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};

export default VehicleDetails;