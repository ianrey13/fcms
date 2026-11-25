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
    Maximize2, Minimize2, FileText, ChevronLeft, ChevronRight, ArrowUpDown, AlertTriangle,
    BarChart3, Table as TableIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

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

const MapUpdater = ({ bounds, markerPos, isReplaying }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map]);
    return null;
};

const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const VehicleDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [page, setPage] = useState(1);
    const [sortOrder, setSortOrder] = useState('desc');
    const rowsPerPage = 5; 

    const [ledgerPage, setLedgerPage] = useState(1);
    const ledgerRowsPerPage = 5;

    const [ledgerView, setLedgerView] = useState('table'); 

    const { data: vehicles = [], isLoading } = useVehicles();
    const vehicle = vehicles.find(v => v.vehicle_id === parseInt(id));

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

    // ✅ GIKUHA TANAN NGA TRIPS PARA SA VEHICLE (Parehas sa GsoDashboard)
    const { data: historyData = [], isLoading: historyLoading } = useQuery({
        queryKey: ['vehicle-history', id],
        queryFn: async () => {
            const res = await gsoAPI.getAllTrips();
            const allTrips = res?.data?.data || [];
            
            // Filter by plate number and only include trips that actually have distance/fuel
            return allTrips.filter(t => 
                t.vehicle?.plate_number === vehicle?.plate_number &&
                !['cancelled', 'rejected', 'returned_for_revision', 'pending_mayors_office'].includes(t.status)
            );
        },
        enabled: !!vehicle
    });

    useEffect(() => {
        if (historyData.length > 0 && !selectedHistoryTrip) {
            handleViewRoute(historyData[0]);
        }
    }, [historyData]);

    const ledgerRows = useMemo(() => {
        if (!vehicle) return [];
        const r2 = (n) => parseFloat(toNum(n).toFixed(2));

        // 1. I-map ang tanang trips ngadto sa ledger rows (walay balance pa)
        const rows = historyData.map(trip => {
            const rawFuelIn = 
                trip.gasSlip?.fuelReceipt?.liters_availed ??
                trip.gas_slip?.fuel_receipt?.liters_availed ??
                trip.liters_availed;

            const hasFuelInput = rawFuelIn !== undefined && rawFuelIn !== null && rawFuelIn !== "";
            const fuelIn = hasFuelInput ? toNum(rawFuelIn) : null;
            
            const isCompleted = ['completed', 'pending_gso_validation', 'closed'].includes(trip.status);
            const distance = isCompleted ? toNum(trip.actual_distance_km || trip.gps_distance_km) : 0;
            
            let efficiency = toNum(vehicle.reference_efficiency) || 10;
            if (efficiency < 6 || efficiency > 20) efficiency = 10;
            
            const fuelOut = distance > 0 ? (distance / efficiency) : 0;

            return {
                trip,
                fuelIn: fuelIn !== null ? r2(fuelIn) : null,
                fuelOut: r2(fuelOut),
                distance,
                efficiency,
                sortTime: new Date(trip.created_at || trip.submitted_at || trip.trip_date || 0).getTime(),
            };
        });

        // 2. Sort oldest to newest para ma-compute ang chain
        rows.sort((a, b) => a.sortTime - b.sortTime);

        if (rows.length === 0) return [];

        // ✅ FIX: I-anchor ang pinaka-latest nga balance sa database (current_fuel_balance)
        // Aron mag-match jud ang pinaka-last nga row sa ledger ug sa Current Fuel card.
        const latestRow = rows[rows.length - 1];
        latestRow.balance = r2(vehicle.current_fuel_balance);
        latestRow.beginning = r2(latestRow.balance - (latestRow.fuelIn ?? 0) + latestRow.fuelOut);

        // 3. Roll backwards from the latest row to calculate previous balances
        for (let i = rows.length - 2; i >= 0; i--) {
            const currentRow = rows[i];
            const nextRow = rows[i + 1];
            
            currentRow.balance = nextRow.beginning;
            currentRow.beginning = r2(currentRow.balance - (currentRow.fuelIn ?? 0) + currentRow.fuelOut);
        }

        // 4. I-reverse para newest first sa table display
        return rows.reverse().map(r => ({
            ...r.trip,
            displayTicketNo: r.trip.ticket_number || r.trip.trip_ticket_number,
            displayDate: r.trip.trip_date || r.trip.submitted_at,
            beginning: r.beginning.toFixed(2),
            fuelIn: r.fuelIn !== null ? r.fuelIn.toFixed(2) : null, 
            fuelOut: r.fuelOut.toFixed(2),
            balance: r.balance.toFixed(2),
            distanceKm: r.distance,
            efficiencyUsed: r.efficiency,
            overTank: (toNum(vehicle.tank_capacity) > 0) && (r.balance > toNum(vehicle.tank_capacity) + 0.01)
        }));
    }, [historyData, vehicle]);

    const chartData = useMemo(() => {
        return [...ledgerRows].reverse().map(r => ({
            name: format(new Date(r.displayDate), 'MMM dd'),
            fuelIn: r.fuelIn !== null ? Number(r.fuelIn) : 0,
            fuelOut: Number(r.fuelOut),
            balance: Number(r.balance)
        }));
    }, [ledgerRows]);

    const totalLedgerPages = Math.ceil(ledgerRows.length / ledgerRowsPerPage);
    const currentLedgerData = useMemo(() => {
        const firstPageIndex = (ledgerPage - 1) * ledgerRowsPerPage;
        const lastPageIndex = firstPageIndex + ledgerRowsPerPage;
        return ledgerRows.slice(firstPageIndex, lastPageIndex);
    }, [ledgerPage, ledgerRows]);

    const sortedHistory = useMemo(() => {
        let sorted = [...historyData];
        sorted.sort((a, b) => {
            const dateA = new Date(a.trip_date || a.created_at).getTime();
            const dateB = new Date(b.trip_date || b.created_at).getTime();
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
            const tripId = trip.trip_ticket_id || trip.id || trip.trip_id;
            const res = await gpsAPI.getTripRoute(tripId);
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 font-sans flex flex-col gap-6">
            
            <div>
                <button onClick={() => navigate('/admin/vehicles')} className="flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-2 transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to Vehicles
                </button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vehicle Details</h1>
            </div>

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
                                   
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                                    {vehicle.vehicle_model} • {vehicle.fuel_type} • {vehicle.maintenance_flag ? 'Under Maintenance' : 'Serviceable'}
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/vehicles/edit/${id}`)} className="font-medium border-slate-300 dark:border-slate-700">Edit Details</Button>
                        </div>
                        
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
                             <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                                {Number.isInteger(currentFuel) ? currentFuel : parseFloat(currentFuel.toFixed(4))} L
                            </span>
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

            <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/20">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                            <Fuel className="h-5 w-5 text-blue-500"/> Fuel Ledger
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Historical record of fuel consumption and additions.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs font-bold hidden sm:inline-flex">
                            {ledgerRows.length} Entries
                        </Badge>
                        
                        <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg">
                            <button
                                onClick={() => setLedgerView('table')}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all",
                                    ledgerView === 'table' 
                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                <TableIcon className="h-3.5 w-3.5" /> Table
                            </button>
                            <button
                                onClick={() => setLedgerView('chart')}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all",
                                    ledgerView === 'chart' 
                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                <BarChart3 className="h-3.5 w-3.5" /> Chart
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                    {ledgerView === 'table' ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Date</th>
                                    <th className="px-4 py-3 font-bold">Trip Ticket No.</th>
                                    <th className="px-4 py-3 font-bold text-right">Beginning (L)</th>
                                    <th className="px-4 py-3 font-bold text-right text-emerald-600 dark:text-emerald-500">Fuel In (L)</th>
                                    <th className="px-4 py-3 font-bold text-right text-orange-600 dark:text-orange-500">Fuel Out (L)</th>
                                    <th className="px-4 py-3 font-bold text-right">Balance (L)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                {historyLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" /> Loading ledger...
                                        </td>
                                    </tr>
                                ) : currentLedgerData.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-500">No ledger entries found.</td>
                                    </tr>
                                ) : (
                                    currentLedgerData.map((row) => (
                                        <tr key={row.id || row.trip_ticket_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                                                {format(new Date(row.displayDate), 'MMM dd, yyyy')}
                                            </td>
                                            <td className="px-4 py-3 font-mono font-medium">{row.displayTicketNo}</td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-500">{row.beginning}</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                {row.fuelIn !== null ? `+${row.fuelIn}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-orange-600 dark:text-orange-400">
                                                -{row.fuelOut}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                                {row.balance}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-4 h-[350px] w-full">
                            {historyLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" /> Loading chart...
                                </div>
                            ) : chartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500">
                                    No data available for chart.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{ fontSize: 12, fill: '#64748b' }} 
                                            tickLine={false} 
                                            axisLine={false} 
                                            dy={10}
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 12, fill: '#64748b' }} 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickFormatter={(val) => `${val} L`}
                                        />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: '#0f172a', 
                                                border: '1px solid #1e293b', 
                                                borderRadius: '8px', 
                                                fontSize: '12px',
                                                color: '#fff'
                                            }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                        
                                        <Line type="monotone" name="Fuel In" dataKey="fuelIn" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" name="Fuel Out" dataKey="fuelOut" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" name="Balance" dataKey="balance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    )}
                </div>

                {ledgerView === 'table' && (
                    <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 mt-auto">
                        <span className="font-medium">
                            {ledgerRows.length > 0 ? ((ledgerPage - 1) * ledgerRowsPerPage) + 1 : 0}-{Math.min(ledgerPage * ledgerRowsPerPage, ledgerRows.length)} of {ledgerRows.length}
                        </span>
                        <div className="flex gap-1">
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-7 w-7 dark:border-slate-700"
                                onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                                disabled={ledgerPage === 1 || ledgerRows.length === 0}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-7 w-7 dark:border-slate-700"
                                onClick={() => setLedgerPage(p => Math.min(totalLedgerPages, p + 1))}
                                disabled={ledgerPage === totalLedgerPages || ledgerRows.length === 0}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapUpdater bounds={routeCoordinates} />
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
                                    weight={4} 
                                    opacity={0.8} 
                                />
                                <Marker position={routeCoordinates[0]} icon={icons.start} />
                                <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={icons.end} />
                                {isReplaying && <Marker position={routeCoordinates[replayIndex]} icon={icons.vehicle} />}
                            </MapContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <MapPin className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
                                <p className="text-slate-500 font-medium text-sm">Select a trip from the table.</p>
                            </div>
                        )}
                    </div>
                </Card>

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
                                                key={trip.trip_id || trip.trip_ticket_id} 
                                                onClick={() => handleViewRoute(trip)}
                                                className={cn(
                                                    "cursor-pointer transition-colors",
                                                    isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                                )}
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                                                    {format(new Date(trip.trip_date || trip.created_at), 'MMM dd, yyyy')}
                                                </td>
                                                <td className="px-4 py-3 font-mono font-medium">{trip.ticket_number || trip.trip_ticket_number}</td>
                                                <td className="px-4 py-3 truncate max-w-[150px] font-medium">{trip.destination}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{trip.actual_distance_km ? `${trip.actual_distance_km} km` : '—'}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

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
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapUpdater bounds={routeCoordinates} />
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
                            </MapContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <MapPin className="h-10 w-10 text-slate-300 mb-3" />
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