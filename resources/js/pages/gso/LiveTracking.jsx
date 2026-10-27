// src/pages/gso/LiveTracking.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from '../../contexts/RealtimeContext';
import { useOptimizedQuery } from '../../hooks/useOptimizedQuery';
import { gpsAPI, gsoAPI } from '../../services/api'; 
import echo from '../../services/echo';
import {
    MapContainer, TileLayer, Marker, Polyline, ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import {
    Car, Gauge, Clock, MapPin, User, Search
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ============================================
// CUSTOM MAP ICONS (SVG)
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

// ============================================
// HELPER FUNCTIONS
// ============================================
const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch { return 'N/A'; }
};

const LiveTracking = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();
    
    const [tripsData, setTripsData] = useState([]);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [mapType, setMapType] = useState('street');
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const mapRef = useRef(null);
    const hasSetupRef = useRef(false);

    // ✅ Fetch Real Dashboard Stats
    const { data: dashboardData } = useOptimizedQuery({
        queryKey: ['gso-dashboard-stats'],
        queryFn: async () => {
            const res = await gsoAPI.getDashboard();
            return res?.data?.data || {};
        },
        staleTime: 60000, 
    });

    // Fetch Active Trips
    const { data: activeTripsRaw, isLoading } = useOptimizedQuery({
        queryKey: ['gps-active-trips-live'],
        queryFn: async () => {
            try {
                const response = await gpsAPI.getActiveTrips();
                let data = response?.data?.data || response?.data || [];
                return Array.isArray(data) ? data : [];
            } catch (error) {
                return [];
            }
        },
        refetchInterval: 15000,
    });

    const activeTrips = useMemo(() => (Array.isArray(activeTripsRaw) ? activeTripsRaw : []), [activeTripsRaw]);

    // Sync API data with local state
    useEffect(() => {
        if (!Array.isArray(activeTrips)) return;
        setTripsData(prev => {
            const prevArr = Array.isArray(prev) ? prev : [];
            return activeTrips.map(serverTrip => {
                const existing = prevArr.find(t => t.trip_id === serverTrip.trip_id);
                return {
                    ...serverTrip,
                    current_location: serverTrip.current_location || existing?.current_location || null
                };
            });
        });
    }, [activeTrips]);

    // WebSocket Real-time Updates
    useEffect(() => {
        if (hasSetupRef.current) return;
        hasSetupRef.current = true;

        const channel = echo.channel('gso-live-tracking');
        setIsWsConnected(true);

        channel.listen('.location.updated', (data) => {
            setTripsData(prev => prev.map(trip => {
                if (trip.trip_id === data.trip_id) {
                    return {
                        ...trip,
                        current_location: {
                            latitude: data.latitude,
                            longitude: data.longitude,
                            speed_kmh: data.speed_kmh || 0,
                            recorded_at: data.timestamp || new Date().toISOString(),
                        }
                    };
                }
                return trip;
            }));

            setSelectedTrip(prev => {
                if (prev && prev.trip_id === data.trip_id) {
                    return {
                        ...prev,
                        current_location: {
                            latitude: data.latitude,
                            longitude: data.longitude,
                            speed_kmh: data.speed_kmh || 0,
                            recorded_at: data.timestamp || new Date().toISOString(),
                        }
                    };
                }
                return prev;
            });
        });

        channel.listen('.trip.completed', (data) => {
            setTripsData(prev => prev.filter(t => t.trip_id !== data.trip_id));
            setSelectedTrip(prev => (prev?.trip_id === data.trip_id ? null : prev));
        });

        return () => {
            hasSetupRef.current = false;
            channel.stopListening('.location.updated');
            channel.stopListening('.trip.completed');
        };
    }, []);

    const handleTripClick = (trip) => {
        setSelectedTrip(trip);
        if (trip.current_location && mapRef.current) {
            mapRef.current.setView([trip.current_location.latitude, trip.current_location.longitude], 14);
        }
    };

    // ✅ Extract stats from dashboardData
    const totalVehicles = dashboardData?.total_vehicles || 0;
    const availableVehicles = dashboardData?.available_vehicles || 0;
    const inUseVehicles = dashboardData?.vehicles_in_use || 0;

    // ✅ Merge Vehicles with Active Trips for the left list
    // Since the backend doesn't return the full list in getDashboard yet, 
    // we'll use active trips as the primary list and add an empty state.
    const filteredTrips = tripsData.filter(trip => 
        trip.vehicle?.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.vehicle?.vehicle_model?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading && tripsData.length === 0) {
        return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">Loading Live Tracking...</div>;
    }

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans">
            
            {/* ================= HEADER ================= */}
            <header className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-500" />
                        Live Tracking
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Monitor real-time distance per trip and vehicle movement.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-slate-500">
                        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </header>

            {/* ================= MAIN CONTENT ================= */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
                
                {/* LEFT PANEL: LIST */}
                <div className="w-full lg:w-[420px] flex flex-col gap-4 flex-shrink-0">
                    
                    {/* ✅ REAL STATS ROW */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Vehicles</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{totalVehicles}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Available: {availableVehicles} | In Use: {inUseVehicles}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ongoing Trips</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{tripsData.length}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Out of {totalVehicles} vehicles</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search by plate no. or vehicle name..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" 
                            />
                        </div>
                    </div>

                    {/* Ongoing Trips List */}
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
                            <h2 className="font-bold text-slate-800 dark:text-white text-sm">Ongoing Trips</h2>
                            <span className="text-xs text-slate-500">{filteredTrips.length} trips</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filteredTrips.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-sm text-slate-500">No active trips found.</p>
                                </div>
                            ) : (
                                filteredTrips.map(trip => (
                                    <div 
                                        key={trip.trip_id}
                                        onClick={() => handleTripClick(trip)}
                                        className={cn(
                                            "p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between",
                                            selectedTrip?.trip_id === trip.trip_id 
                                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm" 
                                                : "bg-white dark:bg-slate-800/50 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                                                <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-slate-800 dark:text-white">{trip.vehicle?.plate_number || 'Unknown'}</span>
                                                    <span className="text-[10px] text-slate-400">•</span>
                                                    <span className="text-xs text-slate-500">{trip.vehicle?.vehicle_model || 'Vehicle'}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[180px]">
                                                    {trip.driver?.name || 'Unknown Driver'} • {trip.destination || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                                    In Transit
                                                </Badge>
                                                <span className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatTime(trip.current_location?.recorded_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: MAP & DETAILS */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    
                    {/* Map Container */}
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-sm">
                        <MapContainer
                            ref={mapRef}
                            center={[8.5833, 124.6667]}
                            zoom={12}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                        >
                            <TileLayer
                                url={mapType === 'street' 
                                    ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                                    : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}
                                attribution='&copy; OpenStreetMap'
                            />
                            <ZoomControl position="bottomright" />

                            {filteredTrips.map(trip => {
                                if (!trip.current_location) return null;

                                return (
                                    <React.Fragment key={trip.trip_id}>
                                        {trip.route && trip.route.length > 1 && (
                                            <Polyline 
                                                positions={trip.route.map(p => [p.latitude, p.longitude])} 
                                                color="#3b82f6" 
                                                weight={4} 
                                                opacity={0.8} 
                                            />
                                        )}
                                        
                                        {trip.route && trip.route.length > 0 && (
                                            <Marker position={[trip.route[0].latitude, trip.route[0].longitude]} icon={icons.start} />
                                        )}
                                        
                                        {trip.route && trip.route.length > 1 && (
                                            <Marker position={[trip.route[trip.route.length-1].latitude, trip.route[trip.route.length-1].longitude]} icon={icons.end} />
                                        )}

                                        <Marker 
                                            position={[trip.current_location.latitude, trip.current_location.longitude]} 
                                            icon={icons.vehicle}
                                        />
                                    </React.Fragment>
                                );
                            })}
                        </MapContainer>

                        {/* Map Controls */}
                        <div className="absolute top-4 left-4 z-[400] flex bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1 border border-slate-200 dark:border-slate-700">
                            <button 
                                onClick={() => setMapType('street')} 
                                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", mapType === 'street' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700")}
                            >
                                Map
                            </button>
                            <button 
                                onClick={() => setMapType('satellite')} 
                                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", mapType === 'satellite' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700")}
                            >
                                Satellite
                            </button>
                        </div>
                    </div>

                    {/* Selected Trip Details */}
                    {selectedTrip && (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex-shrink-0">
                            
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-slate-900 dark:text-white">{selectedTrip.vehicle?.plate_number || 'Unknown'}</h2>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span className="text-sm text-slate-500">{selectedTrip.vehicle?.vehicle_model}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 mt-1">In Transit</Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="h-3 w-3"/> Destination</p>
                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{selectedTrip.destination || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><User className="h-3 w-3"/> Driver</p>
                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{selectedTrip.driver?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Gauge className="h-3 w-3"/> Speed</p>
                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{selectedTrip.current_location?.speed_kmh || 0} km/h</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="h-3 w-3"/> Last Update</p>
                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{formatTime(selectedTrip.current_location?.recorded_at)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveTracking;