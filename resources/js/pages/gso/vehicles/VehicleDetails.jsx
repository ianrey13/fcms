import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVehicles } from '../../../hooks/useVehicleManagement';
import { gpsAPI, gsoAPI } from '../../../services/api';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import {
    ArrowLeft, Car, Fuel, Gauge, MapPin, Clock, User, 
    Building2, Activity, Navigation, Play, Square, Loader2,
    ArrowDownRight, ArrowUpRight, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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

const VehicleDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [chartRange, setChartRange] = useState('7d');
    const [fuelViewMode, setFuelViewMode] = useState('chart'); // 'chart' or 'table'
    
    const { data: vehicles = [], isLoading } = useVehicles();
    const vehicle = vehicles.find(v => v.vehicle_id === parseInt(id));

    // State for History
    const [selectedHistoryTrip, setSelectedHistoryTrip] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const replayIntervalRef = useRef(null);
    const [hoveredPoint, setHoveredPoint] = useState(null);

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

    // ✅ Calculate Historical Fuel Balance AND Build Table Ledger
    const { chartData, tableData } = useMemo(() => {
        if (!vehicle) return { chartData: { labels: [], values: [], max: 60 }, tableData: [] };
        
        const tankCap = parseFloat(vehicle.tank_capacity || 60);
        const eff = parseFloat(vehicle.reference_efficiency || 10);
        const currentBal = parseFloat(vehicle.current_fuel_balance || 0);

        let events = [];

        // Add Receipts
        fuelReceipts.forEach(r => {
            events.push({
                date: new Date(r.uploaded_at),
                type: 'Refuel',
                description: `Receipt ${r.ticket_number || ''}`,
                fuelChange: parseFloat(r.liters || 0), // Positive
                distance: 0
            });
        });

        // Add Trips
        historyData.forEach(t => {
            const dist = parseFloat(t.actual_distance_km || 0);
            events.push({
                date: new Date(t.updated_at || t.trip_date),
                type: 'Trip',
                description: `${t.ticket_number} (${t.destination})`,
                fuelChange: -(dist / eff), // Negative
                distance: dist
            });
        });

        // Sort Chronologically (Oldest to Newest for the Table)
        events.sort((a, b) => a.date - b.date);

        // Build the Ledger for the Table
        let runningBal = parseFloat(vehicle.initial_estimated_fuel || 0);
        const ledger = events.map(e => {
            runningBal += e.fuelChange;
            runningBal = Math.min(Math.max(runningBal, 0), tankCap); // Clamp
            return {
                ...e,
                balance: runningBal
            };
        });

        // Filter based on range for the Chart
        const ranges = { '7d': 7, '30d': 30, '3m': 90 };
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - ranges[chartRange]);

        let chartPoints = ledger.filter(e => e.date >= cutoff);
        
        // If no events in range, just use the last few
        if (chartPoints.length === 0) {
            chartPoints = ledger.slice(-7);
        }

        let grouped = {};
        chartPoints.forEach(e => {
            const dateStr = e.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            grouped[dateStr] = e.balance;
        });

        return { 
            chartData: { labels: Object.keys(grouped), values: Object.values(grouped), max: tankCap },
            // Show the latest events first in the table
            tableData: [...ledger].reverse()
        };
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

    const generatePath = (data, width, height, max) => {
        if (!data || data.length === 0) return '';
        if (data.length === 1) {
            const y = height - (data[0] / max) * height;
            return `M ${width/2} ${y}`;
        }
        const xStep = width / (data.length - 1);
        return data.map((val, i) => {
            const x = i * xStep;
            const y = height - (val / max) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    };

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

            {/* ✅ TAB CONTENT: FUEL (CHART + TABLE TOGGLE) */}
            {activeTab === 'fuel' && (
                <div className="space-y-6">
                    <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-blue-500"/> Fuel Balance History
                                </h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* View Mode Toggle */}
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                    <button onClick={() => setFuelViewMode('chart')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", fuelViewMode === 'chart' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>Chart</button>
                                    <button onClick={() => setFuelViewMode('table')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", fuelViewMode === 'table' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>Table</button>
                                </div>
                                {/* Range Toggle */}
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                    <button onClick={() => setChartRange('7d')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", chartRange === '7d' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>7 Days</button>
                                    <button onClick={() => setChartRange('30d')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", chartRange === '30d' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>30 Days</button>
                                    <button onClick={() => setChartRange('3m')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", chartRange === '3m' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>3 Months</button>
                                </div>
                            </div>
                        </div>

                        {fuelLoading || historyLoading ? (
                            <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                        ) : fuelViewMode === 'chart' ? (
                            // CHART VIEW
                            chartData.values.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                                    <Fuel className="h-10 w-10 mb-2 opacity-50" />
                                    <p>No fuel or trip history found for this range.</p>
                                </div>
                            ) : (
                                <div className="flex">
                                    <div className="flex flex-col justify-between text-[10px] text-slate-400 h-64 pr-2 py-1 font-mono text-right">
                                        <span>{Math.round(chartData.max).toFixed(0)}L</span>
                                        <span>{Math.round(chartData.max * 0.75).toFixed(0)}L</span>
                                        <span>{Math.round(chartData.max * 0.5).toFixed(0)}L</span>
                                        <span>{Math.round(chartData.max * 0.25).toFixed(0)}L</span>
                                        <span>0L</span>
                                    </div>

                                    <div className="flex-1 relative">
                                        <div className="h-64 w-full">
                                            <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible preserve-3d">
                                                <line x1="0" y1="50" x2="700" y2="50" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
                                                <line x1="0" y1="100" x2="700" y2="100" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
                                                <line x1="0" y1="150" x2="700" y2="150" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
                                                <line x1="0" y1="200" x2="700" y2="200" stroke="#cbd5e1" strokeWidth="1" />

                                                <path 
                                                    d={`${generatePath(chartData.values, 700, 200, chartData.max)} L ${chartData.values.length === 1 ? 350 : 700} 200 L 0 200 Z`} 
                                                    fill="url(#gradient)" 
                                                    opacity="0.2" 
                                                />
                                                
                                                <path 
                                                    d={generatePath(chartData.values, 700, 200, chartData.max)} 
                                                    fill="none" 
                                                    stroke="#3b82f6" 
                                                    strokeWidth="3" 
                                                    strokeLinecap="round" 
                                                    strokeLinejoin="round" 
                                                />

                                                {chartData.values.map((val, i) => {
                                                    const x = chartData.values.length === 1 ? 350 : (i / (chartData.values.length - 1)) * 700;
                                                    const y = 200 - (val / chartData.max) * 200;
                                                    return (
                                                        <g 
                                                            key={i} 
                                                            onMouseEnter={() => setHoveredPoint({ x, y, label: chartData.labels[i], value: val })}
                                                            onMouseLeave={() => setHoveredPoint(null)}
                                                            className="cursor-pointer"
                                                        >
                                                            <circle cx={x} cy={y} r="6" fill="transparent" />
                                                            <circle cx={x} cy={y} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />
                                                            
                                                            {hoveredPoint?.label === chartData.labels[i] && (
                                                                <foreignObject x={Math.min(Math.max(x - 40, 0), 620)} y={y - 35} width="100" height="30">
                                                                    <div className="bg-slate-800 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-md text-center">
                                                                        {val.toFixed(1)} L
                                                                    </div>
                                                                </foreignObject>
                                                            )}
                                                        </g>
                                                    );
                                                })}

                                                <defs>
                                                    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8"/>
                                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                        </div>

                                        <div className="flex justify-between text-xs text-slate-400 px-2 font-medium mt-1">
                                            {chartData.labels.map((label, i) => <span key={i}>{label}</span>)}
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : (
                            // TABLE VIEW
                            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Date</th>
                                            <th className="px-4 py-3 font-semibold">Event</th>
                                            <th className="px-4 py-3 font-semibold">Reference</th>
                                            <th className="px-4 py-3 font-semibold text-right">Distance</th>
                                            <th className="px-4 py-3 font-semibold text-right">Fuel +/-</th>
                                            <th className="px-4 py-3 font-semibold text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                        {tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {row.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {row.type === 'Refuel' ? (
                                                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none shadow-none"><Fuel className="h-3 w-3 mr-1"/> Refuel</Badge>
                                                    ) : (
                                                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none shadow-none"><Navigation className="h-3 w-3 mr-1"/> Trip</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-medium">{row.description}</td>
                                                <td className="px-4 py-3 text-right">{row.distance > 0 ? `${row.distance.toFixed(1)} km` : '-'}</td>
                                                <td className={cn("px-4 py-3 text-right font-semibold", row.fuelChange > 0 ? "text-emerald-500" : "text-red-500")}>
                                                    {row.fuelChange > 0 ? '+' : ''}{row.fuelChange.toFixed(1)} L
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                                    {row.balance.toFixed(1)} L
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>

                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><Fuel className="h-5 w-5 text-blue-500" /></div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Current Balance</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{currentFuel.toFixed(1)} L</p>
                                </div>
                            </div>
                        </Card>

                        <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"><MapPin className="h-5 w-5 text-emerald-500" /></div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Tank Capacity</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{tankCap.toFixed(1)} L</p>
                                </div>
                            </div>
                        </Card>

                        <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><Gauge className="h-5 w-5 text-purple-500" /></div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Ref. Efficiency</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{refEff} km/L</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: HISTORY */}
            {activeTab === 'history' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

                    <Card className="lg:col-span-2 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-[600px] overflow-hidden relative">
                        {selectedHistoryTrip && routeCoordinates.length > 1 && (
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
                            <MapContainer bounds={routeCoordinates} boundsOptions={{ padding: [50, 50] }} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Polyline positions={routeCoordinates} color="#3b82f6" weight={5} opacity={0.8} />
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