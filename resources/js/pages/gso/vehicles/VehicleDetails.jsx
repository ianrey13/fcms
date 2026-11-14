// src/pages/gso/vehicles/VehicleDetails.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVehicles } from '../../../hooks/useVehicleManagement';
import { gpsAPI, gsoAPI } from '../../../services/api';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import {
    ArrowLeft, Car, Fuel, Gauge, MapPin, Clock, User, 
    Building2, Activity, Navigation, Play, Square, Loader2,
    Maximize2, Minimize2, FileText, ChevronLeft, ChevronRight, ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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
    const [chartRange, setChartRange] = useState('7d');
    
    // Table State
    const [page, setPage] = useState(1);
    const [sortOrder, setSortOrder] = useState('desc');
    const rowsPerPage = 5; 

    const { data: vehicles = [], isLoading } = useVehicles();
    const vehicle = vehicles.find(v => v.vehicle_id === parseInt(id));

    // State for Map
    const [selectedHistoryTrip, setSelectedHistoryTrip] = useState(null);
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const replayIntervalRef = useRef(null);

    useEffect(() => {
        return () => {
            if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
        };
    }, []);

    // Fetch Trip History
    const { data: historyData = [], isLoading: historyLoading } = useQuery({
        queryKey: ['vehicle-history', id],
        queryFn: async () => {
            const res = await gpsAPI.getCompletedTrips({ limit: 100 });
            const trips = res?.data?.data || [];
            return trips.filter(t => t.plate_number === vehicle?.plate_number);
        },
        enabled: !!vehicle
    });

    // Auto-select the latest trip when data loads
    useEffect(() => {
        if (historyData.length > 0 && !selectedHistoryTrip) {
            handleViewRoute(historyData[0]);
        }
    }, [historyData]);

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

    // Chart Data (Weekly)
    const chartData = useMemo(() => {
        if (!vehicle) return { labels: [], fuelIn: [], fuelOut: [], max: 100 };
        const eff = parseFloat(vehicle.reference_efficiency || 10);
        const weeklyData = {};

        fuelReceipts.forEach(r => {
            const d = new Date(r.uploaded_at);
            const weekStart = startOfWeek(d, { weekStartsOn: 1 });
            const weekLabel = format(weekStart, 'MMM dd');
            if (!weeklyData[weekLabel]) weeklyData[weekLabel] = { in: 0, out: 0, date: weekStart };
            weeklyData[weekLabel].in += parseFloat(r.liters || 0);
        });

        historyData.forEach(t => {
            const d = new Date(t.updated_at || t.trip_date);
            const weekStart = startOfWeek(d, { weekStartsOn: 1 });
            const weekLabel = format(weekStart, 'MMM dd');
            const dist = parseFloat(t.actual_distance_km || 0);
            if (!weeklyData[weekLabel]) weeklyData[weekLabel] = { in: 0, out: 0, date: weekStart };
            weeklyData[weekLabel].out += (dist / eff);
        });

        let weeks = Object.keys(weeklyData).sort((a, b) => weeklyData[a].date - weeklyData[b].date);
        if (chartRange === '7d') weeks = weeks.slice(-2);
        else if (chartRange === '30d') weeks = weeks.slice(-4);
        
        return { 
            labels: weeks, 
            fuelIn: weeks.map(w => weeklyData[w].in), 
            fuelOut: weeks.map(w => weeklyData[w].out), 
            max: Math.max(...weeks.map(w => Math.max(weeklyData[w].in, weeklyData[w].out)), 10) * 1.2 
        };
    }, [vehicle, fuelReceipts, historyData, chartRange]);

    // Sorting and Pagination for History Table
    const sortedHistory = useMemo(() => {
        let sorted = [...historyData];
        sorted.sort((a, b) => {
            const dateA = new Date(a.trip_date).getTime();
            const dateB = new Date(b.trip_date).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        return sorted;
    }, [historyData, sortOrder]);

    const totalPages = Math.ceil(sortedHistory.length / rowsPerPage);
    const currentTableData = useMemo(() => {
        const firstPageIndex = (page - 1) * rowsPerPage;
        const lastPageIndex = firstPageIndex + rowsPerPage;
        return sortedHistory.slice(firstPageIndex, lastPageIndex);
    }, [page, sortedHistory]);

    const toggleSortDate = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

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

    const currentFuel = parseFloat(vehicle.current_fuel_balance || 0);
    const tankCap = parseFloat(vehicle.tank_capacity || 60);
    const refEff = parseFloat(vehicle.reference_efficiency || 10);
    const fuelPct = vehicle.fuel_percentage || 0;

    // Reusable Map Content Component
    const MapContent = () => (
        <>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapBoundsUpdater bounds={routeCoordinates} />
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
                    const dist = R * c;
                    return dist < 500; 
                })} 
                color="#3b82f6" 
                weight={5} 
                opacity={0.8} 
            />
            <Marker position={routeCoordinates[0]} icon={icons.start} />
            <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={icons.end} />
            {isReplaying && <Marker position={routeCoordinates[replayIndex]} icon={icons.vehicle} />}
        </>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 font-sans flex flex-col gap-6">
            
            {/* Header */}
            <div>
                <button onClick={() => navigate('/admin/vehicles')} className="flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-2 transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to Vehicles
                </button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vehicle Details</h1>
            </div>

            {/* 1. Top Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row overflow-hidden">
                    <div className="p-6 bg-slate-100/50 dark:bg-slate-800/30 flex items-center justify-center md:w-1/3">
                        <Car className="h-20 w-20 text-slate-300 dark:text-slate-700" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{vehicle.plate_number}</h2>
                                    <Badge className={cn("px-2.5 py-1 text-xs font-bold", vehicle.status === 'active' ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-red-500 hover:bg-red-600 text-white")}>
                                        ● {vehicle.status === 'active' ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                                    {vehicle.vehicle_model} • {vehicle.fuel_type} • {vehicle.maintenance_flag ? 'Under Maintenance' : 'Serviceable'}
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/vehicles/edit/${id}`)} className="font-medium border-slate-300 dark:border-slate-700">Edit Details</Button>
                        </div>
                        
                        {/* Department Info (Driver Removed) */}
                        <div className="flex items-center gap-3 mt-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                            <Building2 className="h-10 w-10 p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl" />
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</p>
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-0.5">{vehicle.department?.department_name || 'General Services Office'}</p>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col items-center justify-center relative">
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                        <Fuel className="h-4 w-4 text-blue-500" />
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Fuel Information</h3>
                    </div>
                    
                    <div className="relative w-32 h-32 mt-6">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path className="text-blue-500" strokeDasharray={`${fuelPct}, 100`} strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{currentFuel.toFixed(1)} L</span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">Current Fuel</span>
                        </div>
                    </div>

                    <div className="w-full mt-6 space-y-2.5">
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium flex items-center gap-1.5"><Fuel className="h-3.5 w-3.5"/> Tank Capacity</span><span className="font-bold text-slate-800 dark:text-white">{tankCap.toFixed(1)} L</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium flex items-center gap-1.5"><Activity className="h-3.5 w-3.5"/> Fuel Efficiency</span><span className="font-bold text-slate-800 dark:text-white">{refEff} km/L</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5"/> Est. Range</span><span className="font-bold text-slate-800 dark:text-white">~ {Math.round(currentFuel * refEff)} km</span></div>
                    </div>
                </Card>
            </div>

            {/* 2. Fuel Balance History Chart */}
            <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                            <Activity className="h-5 w-5 text-blue-500"/> Fuel Balance History
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Weekly summary of fuel added and consumed.</p>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button onClick={() => setChartRange('7d')} className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", chartRange === '7d' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Last 2 Weeks</button>
                        <button onClick={() => setChartRange('30d')} className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", chartRange === '30d' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Last 4 Weeks</button>
                        <button onClick={() => setChartRange('3m')} className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", chartRange === '3m' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>All Time</button>
                    </div>
                </div>

                {fuelLoading || historyLoading ? (
                    <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                ) : chartData.labels.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                        <Fuel className="h-10 w-10 mb-2 opacity-50" />
                        <p className="font-medium">No fuel or trip history found for this range.</p>
                    </div>
                ) : (
                    <div className="h-72 w-full mt-4 flex items-end justify-around gap-2 md:gap-8 pb-8 border-b border-slate-200 dark:border-slate-700 relative">
                        <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[11px] font-bold text-slate-400">
                            <span>{Math.round(chartData.max)} L</span>
                            <span>0 L</span>
                        </div>
                        <div className="flex-1 flex justify-around items-end h-full ml-8">
                            {chartData.labels.map((label, idx) => {
                                const inVal = chartData.fuelIn[idx];
                                const outVal = chartData.fuelOut[idx];
                                const inPct = (inVal / chartData.max) * 100;
                                const outPct = (outVal / chartData.max) * 100;
                                return (
                                    <div key={idx} className="flex flex-col items-center group w-1/3 max-w-[100px]">
                                        <div className="flex items-end justify-center gap-1.5 h-full w-full">
                                            <div className="relative w-1/2 flex justify-center group-hover:opacity-80 transition-opacity" style={{ height: `${inPct}%` }}>
                                                <div className="w-full bg-emerald-500 rounded-t-md relative shadow-sm">
                                                    {inVal > 0 && <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-500">+{inVal.toFixed(1)}</span>}
                                                </div>
                                            </div>
                                            <div className="relative w-1/2 flex justify-center group-hover:opacity-80 transition-opacity" style={{ height: `${outPct}%` }}>
                                                <div className="w-full bg-orange-500 rounded-t-md relative shadow-sm">
                                                    {outVal > 0 && <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-orange-500">-{outVal.toFixed(1)}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-4 text-center">{label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                <div className="flex justify-center gap-8 mt-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="w-3 h-3 rounded-sm bg-emerald-500"></span> Fuel In (+) 
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="w-3 h-3 rounded-sm bg-orange-500"></span> Fuel Out (-)
                    </div>
                </div>
            </Card>

            {/* 3. Bottom Row: Map & Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* MAP CARD (Left - Mini Version) */}
                <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden h-[500px] shadow-sm">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-blue-500" /> Route for Selected Trip
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{selectedHistoryTrip ? selectedHistoryTrip.ticket_number : 'Select a trip'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedHistoryTrip && routeCoordinates.length > 1 && (
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                                    <button onClick={handleReplay} className={cn("p-1 rounded-full flex items-center justify-center", isReplaying ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600")}>
                                        {isReplaying ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-0.5" />}
                                    </button>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{isReplaying ? `${replayIndex} / ${routeCoordinates.length}` : 'Replay'}</span>
                                </div>
                            )}
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => setIsMapExpanded(true)}
                                className="h-8 w-8 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 relative bg-slate-100 dark:bg-slate-950">
                        {loadingRoute ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 z-50">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                            </div>
                        ) : selectedHistoryTrip && routeCoordinates.length > 0 ? (
                            <MapContainer bounds={routeCoordinates} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                                <MapContent />
                            </MapContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <MapPin className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
                                <p className="text-slate-500 font-medium text-sm">Select a trip from the table.</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* TRIP HISTORY TABLE (Right) */}
                <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[500px]">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                            <Car className="h-4 w-4 text-blue-500" /> Trip History
                        </h3>
                        <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs font-bold">
                            {sortedHistory.length} Records
                        </Badge>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 font-bold cursor-pointer hover:text-slate-800 dark:hover:text-slate-200" onClick={toggleSortDate}>
                                        <div className="flex items-center gap-1">
                                            Date <ArrowUpDown className="h-3.5 w-3.5" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 font-bold">Trip Ticket No.</th>
                                    <th className="px-4 py-3 font-bold">Destination</th>
                                    <th className="px-4 py-3 font-bold text-right">Distance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                {historyLoading ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" /> Loading...
                                        </td>
                                    </tr>
                                ) : currentTableData.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-slate-500">No trip records found.</td>
                                    </tr>
                                ) : (
                                    currentTableData.map(trip => {
                                        const isSelected = selectedHistoryTrip?.trip_id === trip.trip_id;
                                        return (
                                            <tr 
                                                key={trip.trip_id} 
                                                onClick={() => handleViewRoute(trip)}
                                                className={cn(
                                                    "cursor-pointer transition-colors",
                                                    isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                                )}
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                                                    {format(new Date(trip.trip_date), 'MMM dd, yyyy')}
                                                </td>
                                                <td className="px-4 py-3 font-mono font-medium">{trip.ticket_number}</td>
                                                <td className="px-4 py-3 truncate max-w-[150px] font-medium">{trip.destination}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{trip.actual_distance_km ? `${trip.actual_distance_km} km` : '—'}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50">
                        <span className="font-medium">
                            {((page - 1) * rowsPerPage) + 1}-{Math.min(page * rowsPerPage, sortedHistory.length)} of {sortedHistory.length}
                        </span>
                        <div className="flex gap-1">
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-7 w-7 dark:border-slate-700"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-7 w-7 dark:border-slate-700"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ✅ FULLSCREEN MAP MODAL */}
            <Dialog open={isMapExpanded} onOpenChange={setIsMapExpanded}>
                <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden dark:bg-slate-900 dark:border-slate-700 flex flex-col">
                    <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Route for Selected Trip</DialogTitle>
                                <DialogDescription className="text-sm font-medium text-slate-500 mt-1">
                                    {selectedHistoryTrip?.ticket_number} • {selectedHistoryTrip?.destination}
                                </DialogDescription>
                            </div>
                            
                            {/* Replay Controls */}
                            {routeCoordinates.length > 1 && (
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Replay Trip</span>
                                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
                                    <button onClick={handleReplay} className={cn("p-1.5 rounded-full transition-colors flex items-center justify-center", isReplaying ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-blue-100 text-blue-600 hover:bg-blue-200")}>
                                        {isReplaying ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                                    </button>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{isReplaying ? `${replayIndex} / ${routeCoordinates.length}` : `${routeCoordinates.length} pings`}</span>
                                </div>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 relative bg-slate-100 dark:bg-slate-950">
                        {loadingRoute ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 z-50">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-3" />
                                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Loading route...</p>
                            </div>
                        ) : routeCoordinates.length > 0 ? (
                            <MapContainer bounds={routeCoordinates} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                                <MapContent />
                            </MapContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <MapPin className="h-12 w-12 text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">No GPS data available for this trip.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VehicleDetails;