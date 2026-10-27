// src/pages/gso/LiveTracking.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useRealtime } from '../../contexts/RealtimeContext';
import { useOptimizedQuery } from '../../hooks/useOptimizedQuery';
import {
    SkeletonCard,
    SkeletonText,
    SkeletonTitle,
} from '../../components/ui/SkeletonCard';
import { gpsAPI } from '../../services/api';
import echo from '../../services/echo';
import LiveTripTracker from '../gso/LiveTripTracker';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    Circle,
    ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
    RefreshCw,
    Maximize2,
    Truck,
    User,
    MapPin,
    Clock,
    Gauge,
    Navigation,
    Satellite,
    Layers,
    Activity,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Check,
    Wifi,
    WifiOff,
    Focus,
    Eye,
    Car,
    Fuel,
    Loader2,
    X,
    Play,
    Square,
    Route,
    Calendar,
    Search,
    Filter,
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';

// ============================================
// Haversine distance helper (meters)
// ============================================
const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ============================================
// VEHICLE ICON
// ============================================
const createVehicleIcon = (status, isSelected, isOnline = true, isFocused = false, plateNumber = '', vehicleModel = '') => {
    const colors = {
        in_transit: '#22c55e',
        funds_issued: '#f59e0b',
        acknowledged: '#3b82f6',
        pending_mayors_office: '#8b5cf6',
        pending_reconciliation: '#f97316',
        completed: '#6366f1',
        pending_gso_validation: '#818cf8',
        closed: '#6b7280',
        returned_for_revision: '#ef4444',
    };
    const color = colors[status] || '#6b7280';
    const size = isFocused ? 44 : (isSelected ? 38 : 32);
    const labelBg = isFocused ? '#3b82f6' : '#1e293b';

    return L.divIcon({
        className: 'custom-vehicle-icon',
        html: `
            <div style="position: relative; width: ${size + 12}px; height: ${size + 12 + 35}px; cursor: pointer; transition: all 0.3s ease;">
                ${plateNumber ? `<div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); background: ${labelBg}; color: white; padding: 2px 8px; border-radius: 6px; font-size: ${isFocused ? '11px' : '10px'}; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 0.5px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 1.5px solid white; z-index: 10; ${isFocused ? 'animation: label-glow 1.5s ease-in-out infinite;' : ''}">${plateNumber}<div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 4px solid ${labelBg};"></div></div>` : ''}
                ${isFocused ? `<div style="position: absolute; top: 22px; left: 50%; transform: translateX(-50%); width: ${size + 24}px; height: ${size + 24}px; margin-left: -${(size + 24) / 2}px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); border: 3px solid rgba(59, 130, 246, 0.5); animation: pulse-ring 1.5s ease-out infinite; box-shadow: 0 0 40px rgba(59, 130, 246, 0.3);"></div>` : isSelected ? `<div style="position: absolute; top: 26px; left: 50%; transform: translateX(-50%); width: ${size + 16}px; height: ${size + 16}px; margin-left: -${(size + 16) / 2}px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); border: 2px solid rgba(59, 130, 246, 0.3); animation: pulse-ring 2s ease-out infinite;"></div>` : ''}
                <div style="position: absolute; top: 22px; left: 50%; transform: translateX(-50%) ${isFocused ? 'scale(1.15)' : isSelected ? 'scale(1.08)' : 'scale(1)'}; width: ${size}px; height: ${size}px; background: ${color}; border-radius: 12px; border: ${isFocused ? '3px solid #3b82f6' : '2px solid white'}; box-shadow: ${isFocused ? '0 4px 24px rgba(59,130,246,0.6), 0 0 60px rgba(59,130,246,0.15)' : '0 4px 12px rgba(0,0,0,0.25)'}; display: flex; align-items: center; justify-content: center; color: white; z-index: 1; transition: all 0.3s ease; ${!isOnline ? 'opacity: 0.5;' : ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                </div>
                ${vehicleModel ? `<div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); color: #e2e8f0; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; max-width: 80px; border: 1px solid rgba(255,255,255,0.2); z-index: 5;">${vehicleModel}</div>` : ''}
            </div>
        `,
        iconSize: [size + 12, size + 12 + 35],
        iconAnchor: [(size + 12) / 2, size + 12 + 29],
        popupAnchor: [0, -(size + 12 + 35) / 2 + 10],
    });
};

// Add keyframe animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.8); opacity: 0; } }
    @keyframes label-glow { 0% { box-shadow: 0 2px 8px rgba(59,130,246,0.3); } 50% { box-shadow: 0 2px 16px rgba(59,130,246,0.7); } 100% { box-shadow: 0 2px 8px rgba(59,130,246,0.3); } }
    .custom-vehicle-icon:hover { filter: brightness(1.1); }
`;
document.head.appendChild(styleSheet);

// ============================================
// MAP TILES
// ============================================
const MAP_TILES = {
    street: { name: 'Street Map', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
    satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
    hybrid: { name: 'Hybrid', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
    terrain: { name: 'Terrain', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap' },
    dark: { name: 'Dark Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CartoDB' },
};

// ============================================
// HELPERS
// ============================================
const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return 'N/A'; }
};

const formatDateTimeShort = (dateString) => {
    if (!dateString) return '--';
    try {
        return new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return '--'; }
};

const getStatusLabel = (status) => {
    const labels = { in_transit: 'In Transit', funds_issued: 'Funds Issued', acknowledged: 'Acknowledged', pending_mayors_office: 'Submitted', pending_reconciliation: 'Pending Recon', completed: 'Completed', pending_gso_validation: 'Pending Validation', closed: 'Closed', returned_for_revision: 'Returned' };
    return labels[status] || status || 'Unknown';
};

const getStatusColor = (status) => {
    const colors = { in_transit: 'bg-green-500', funds_issued: 'bg-yellow-500', acknowledged: 'bg-blue-500', pending_mayors_office: 'bg-purple-500', pending_reconciliation: 'bg-orange-500', completed: 'bg-indigo-500', pending_gso_validation: 'bg-indigo-400', closed: 'bg-slate-500', returned_for_revision: 'bg-red-400' };
    return colors[status] || 'bg-slate-500';
};

const getStatusDot = getStatusColor;
const getMapTypeLabel = (type) => MAP_TILES[type]?.name || 'Street Map';

// ============================================
// TOP STAT CARD COMPONENT
// ============================================
const TopStatCard = ({ title, value, subtitle, icon: Icon, color, trend, trendLabel }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col justify-between">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">{subtitle}</span>
            {trend && (
                <span className={`font-semibold flex items-center gap-1 ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% <span className="text-slate-400 font-normal ml-0.5">{trendLabel}</span>
                </span>
            )}
        </div>
    </div>
);

// ============================================
// POPUP CONTENT
// ============================================
const TripPopupContent = ({ trip, onViewTrip, onCenter }) => {
    return (
        <div className="p-2 min-w-[240px] max-w-[300px]">
            <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(trip?.status)} animate-pulse`} />
                <span className="font-semibold text-sm text-slate-800 dark:text-white">{trip?.ticket_number || 'N/A'}</span>
                <Badge className={`${getStatusColor(trip?.status)} text-white text-[10px] ml-auto`}>{getStatusLabel(trip?.status)}</Badge>
            </div>
            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-500">Plate:</span><span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{trip?.vehicle?.plate_number || 'N/A'}</span></div>
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-500">Driver:</span><span className="font-medium text-slate-700 dark:text-slate-300">{trip?.driver?.name || 'N/A'}</span></div>
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-500">Dest:</span><span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{trip?.destination || 'N/A'}</span></div>
                <div className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-500">Speed:</span><span className="font-medium text-slate-700 dark:text-slate-300">{trip?.current_location?.speed_kmh || 0} km/h</span></div>
            </div>
            <div className="mt-3 flex gap-2">
                <button onClick={() => onViewTrip(trip)} className="flex-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"><Eye className="h-3 w-3" /> View</button>
                <button onClick={() => onCenter(trip)} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-1"><Navigation className="h-3 w-3" /> Center</button>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
const LiveTracking = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [focusedTrip, setFocusedTrip] = useState(null);
    const [mapCenter, setMapCenter] = useState([8.5833, 124.6667]);
    const [mapZoom, setMapZoom] = useState(13);
    const [mapType, setMapType] = useState('street');
    const [isMapTypeDropdownOpen, setIsMapTypeDropdownOpen] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [tripsData, setTripsData] = useState([]);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sidebarTab, setSidebarTab] = useState('active');
    const [polylineRoute, setPolylineRoute] = useState(null);
    const [polylineInfo, setPolylineInfo] = useState(null);
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");

    const mapRef = useRef(null);
    const dropdownRef = useRef(null);
    const replayIntervalRef = useRef(null);
    const followedTripIdRef = useRef(null);
    const mapZoomRef = useRef(13);
    const tripsDataRef = useRef([]);
    const pendingPingsRef = useRef({});
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        const t = setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
        }, 350);
        return () => clearTimeout(t);
    }, [isSidebarOpen]);

    useEffect(() => { tripsDataRef.current = tripsData; }, [tripsData]);
    useEffect(() => { mapZoomRef.current = mapZoom; }, [mapZoom]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsMapTypeDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['gps-active-trips-live'] });
    }, [queryClient]);

    useAutoRefresh(["gps-location-updated", "trip-started", "trip-completed", "gso-trip-updated", "new-notification"], fetchAllData, 2000);

    const { data: activeTripsRaw, isLoading, refetch, isFetching } = useOptimizedQuery({
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
        refetchInterval: (query) => Array.isArray(query?.state?.data) && query.state.data.length > 0 ? 15000 : false,
        staleTime: 0,
        keepPreviousData: true,
        retry: 2,
    });

    const { data: refuelingsRaw, isLoading: refuelingsLoading } = useOptimizedQuery({
        queryKey: ['gps-recent-refuelings'],
        queryFn: async () => {
            try { const res = await gpsAPI.getRecentRefuelings({ limit: 50 }); return res?.data?.data ?? []; } catch (e) { return []; }
        },
        staleTime: 30_000,
        enabled: sidebarTab === 'refuelings',
    });

    const { data: completedRaw, isLoading: completedLoading } = useOptimizedQuery({
        queryKey: ['gps-completed-trips'],
        queryFn: async () => {
            try { const res = await gpsAPI.getCompletedTrips({ limit: 50 }); return res?.data?.data ?? []; } catch (e) { return []; }
        },
        staleTime: 30_000,
        enabled: sidebarTab === 'history',
    });

    const refuelings = useMemo(() => (Array.isArray(refuelingsRaw) ? refuelingsRaw : []), [refuelingsRaw]);
    const completedTrips = useMemo(() => (Array.isArray(completedRaw) ? completedRaw : []), [completedRaw]);
    const activeTrips = useMemo(() => (Array.isArray(activeTripsRaw) ? activeTripsRaw : []), [activeTripsRaw]);

    useEffect(() => {
        if (!Array.isArray(activeTrips)) return;
        setTripsData(prev => {
            const prevArr = Array.isArray(prev) ? prev : [];
            const prevById = {};
            for (const t of prevArr) { if (t && t.trip_id != null) prevById[t.trip_id] = t; }
            return activeTrips.map(serverTrip => {
                const existing = prevById[serverTrip.trip_id];
                const pending = pendingPingsRef.current[serverTrip.trip_id];
                if (pending && !serverTrip.current_location) {
                    delete pendingPingsRef.current[serverTrip.trip_id];
                    return { ...serverTrip, current_location: { latitude: pending.latitude, longitude: pending.longitude, speed_kmh: pending.speed_kmh || 0, accuracy_meters: pending.accuracy_meters || 0, heading_degrees: pending.heading_degrees || 0, recorded_at: pending.timestamp || new Date().toISOString() } };
                }
                if (existing?.current_location && !serverTrip.current_location) {
                    return { ...serverTrip, current_location: existing.current_location };
                }
                return serverTrip;
            });
        });
        setLastUpdate(new Date());
    }, [activeTrips]);

    useEffect(() => {
        const channel = echo.channel('gso-live-tracking');
        setIsWsConnected(true);

        channel.listen('.location.updated', (data) => {
            if (!isMountedRef.current) return;
            if ((data.accuracy_meters || 0) > 30) return;
            
            const existingTrip = tripsDataRef.current.find(t => t.trip_id === data.trip_id);
            if (existingTrip?.current_location) {
                const distMeters = haversineMeters(existingTrip.current_location.latitude, existingTrip.current_location.longitude, data.latitude, data.longitude);
                if (distMeters < 15 && (data.speed_kmh || 0) < 2) return;
            }

            if (!tripsDataRef.current.some(t => t.trip_id === data.trip_id)) {
                pendingPingsRef.current[data.trip_id] = data;
                queryClient.invalidateQueries({ queryKey: ['gps-active-trips-live'] });
                return;
            }

            setTripsData(prev => {
                if (!Array.isArray(prev)) return [];
                return prev.map(trip => trip && trip.trip_id === data.trip_id ? { ...trip, current_location: { latitude: data.latitude, longitude: data.longitude, speed_kmh: data.speed_kmh || 0, accuracy_meters: data.accuracy_meters || 0, heading_degrees: data.heading_degrees || 0, recorded_at: data.timestamp || new Date().toISOString() } } : trip);
            });

            setSelectedTrip(prev => prev && prev.trip_id === data.trip_id ? { ...prev, current_location: { latitude: data.latitude, longitude: data.longitude, speed_kmh: data.speed_kmh || 0, accuracy_meters: data.accuracy_meters || 0, heading_degrees: data.heading_degrees || 0, recorded_at: data.timestamp || new Date().toISOString() } } : prev);
            if (followedTripIdRef.current === data.trip_id && mapRef.current) mapRef.current.setView([data.latitude, data.longitude], mapZoomRef.current);
            setLastUpdate(new Date());
        });

        channel.listen('.trip.completed', (data) => {
            if (!isMountedRef.current) return;
            setTripsData(prev => prev.filter(t => t.trip_id !== data.trip_id));
            setSelectedTrip(prev => prev?.trip_id === data.trip_id ? null : prev);
            queryClient.invalidateQueries({ queryKey: ['gps-active-trips-live'] });
        });

        channel.subscribed(() => { if (isMountedRef.current) setIsWsConnected(true); });
        channel.error(() => { if (isMountedRef.current) setIsWsConnected(false); });

        if (echo.connector && echo.connector.pusher) {
            echo.connector.pusher.connection.bind('connected', () => { if (isMountedRef.current) setIsWsConnected(true); });
            echo.connector.pusher.connection.bind('disconnected', () => { if (isMountedRef.current) setIsWsConnected(false); });
        }

        return () => {
            try { channel.stopListening('.location.updated'); channel.stopListening('.trip.completed'); } catch (e) {}
        };
    }, []);

    const tripsWithLocation = useMemo(() => Array.isArray(tripsData) ? tripsData.filter(trip => trip && trip.current_location) : [], [tripsData]);
    
    // Filters the ongoing trips list based on the search bar
    const filteredTrips = useMemo(() => {
        if (!searchTerm) return tripsWithLocation;
        const lower = searchTerm.toLowerCase();
        return tripsWithLocation.filter(t => 
            (t.vehicle?.plate_number || '').toLowerCase().includes(lower) || 
            (t.vehicle?.vehicle_model || '').toLowerCase().includes(lower)
        );
    }, [tripsWithLocation, searchTerm]);

    const handleTripSelect = (trip) => {
        setSelectedTrip(trip);
        followedTripIdRef.current = trip?.trip_id;
        if (trip && trip.current_location) {
            setMapCenter([trip.current_location.latitude, trip.current_location.longitude]);
            setMapZoom(16);
            if (mapRef.current) mapRef.current.setView([trip.current_location.latitude, trip.current_location.longitude], 16);
        }
    };

    const handleStopReplay = () => {
        setIsReplaying(false); setReplayIndex(0);
        if (replayIntervalRef.current) { clearInterval(replayIntervalRef.current); replayIntervalRef.current = null; }
    };

    const handleReplay = () => {
        if (!polylineRoute || polylineRoute.length < 2) return;
        if (isReplaying) { handleStopReplay(); return; }
        setIsReplaying(true); setReplayIndex(0);
        let currentIdx = 0;
        replayIntervalRef.current = setInterval(() => {
            currentIdx++;
            if (currentIdx >= polylineRoute.length) { clearInterval(replayIntervalRef.current); setIsReplaying(false); setReplayIndex(0); return; }
            setReplayIndex(currentIdx);
            if (mapRef.current) mapRef.current.panTo(polylineRoute[currentIdx]);
        }, 300);
    };

    const handlePolylineView = async (item) => {
        if (!item?.trip_id) return toast.error('No trip data');
        handleStopReplay();
        try {
            const res = await gpsAPI.getTripRoute(item.trip_id);
            const track = res?.data?.data?.track ?? [];
            if (track.length < 2) return toast.error('Not enough GPS data');
            setPolylineRoute(track.map(p => [p.latitude, p.longitude]));
            setPolylineInfo({ label: item.ticket_number || item.plate_number, trip_id: item.trip_id });
            if (mapRef.current) mapRef.current.fitBounds(L.latLngBounds(track.map(p => [p.latitude, p.longitude])), { padding: [40, 40] });
        } catch (e) { toast.error('Failed to load route'); }
    };

    const handleClearPolyline = () => { setPolylineRoute(null); setPolylineInfo(null); handleStopReplay(); };

    const handleViewTrip = (trip) => { setSelectedTrip(null); followedTripIdRef.current = null; navigate(`/gso/trip/${trip?.trip_id}`); };

    const handleCenter = (trip) => {
        if (trip && trip.current_location) {
            setMapCenter([trip.current_location.latitude, trip.current_location.longitude]);
            setMapZoom(16); setSelectedTrip(trip); followedTripIdRef.current = trip.trip_id;
            if (mapRef.current) mapRef.current.setView([trip.current_location.latitude, trip.current_location.longitude], 16);
        }
    };

    const handleFitBounds = () => {
        if (tripsWithLocation.length === 0) return toast.error('No active vehicles');
        mapRef.current?.fitBounds(L.latLngBounds(tripsWithLocation.map(t => [t.current_location.latitude, t.current_location.longitude])), { padding: [50, 50] });
    };

    if (isLoading && tripsData.length === 0) {
        return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            
            {/* ============ Top Header & Stats ============ */}
            <header className="flex-shrink-0 bg-slate-50 dark:bg-slate-950 px-4 md:px-6 pt-6 pb-2 z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/gso/dashboard')} className="rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 h-10 w-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <MapPin className="h-6 w-6 text-blue-500" />
                                Live Tracking
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Monitor real-time distance per trip and vehicle movement.
                            </p>
                        </div>
                    </div>
                    <div className="text-right text-sm text-slate-500 dark:text-slate-400 hidden md:block">
                        <div>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{formatTime(new Date())}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                    <TopStatCard title="Total Vehicles" value="12" subtitle="Active: 8 | Inactive: 4" icon={Truck} color="from-blue-500 to-blue-600" />
                    <TopStatCard title="Ongoing Trips" value={tripsWithLocation.length} subtitle={`Out of 12 vehicles`} icon={Route} color="from-indigo-500 to-indigo-600" />
                    <TopStatCard title="Total Distance (Today)" value="482.6 km" subtitle="↑ 12% vs. yesterday" trend={12} trendLabel="" icon={Route} color="from-blue-400 to-blue-500" />
                    <TopStatCard title="Total Fuel Consumed (Today)" value="78.4 L" subtitle="↓ 8% vs. yesterday" trend={-8} trendLabel="" icon={Fuel} color="from-slate-700 to-slate-800" />
                </div>
            </header>

            {/* ============ Main Content Area ============ */}
            <div className="flex-1 flex overflow-hidden p-4 md:px-6 md:pb-6 min-h-0 gap-4">
                
                {/* LEFT SIDEBAR (Filters & Lists) */}
                <div className="w-80 flex-shrink-0 flex flex-col gap-4">
                    
                    {/* Filters Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex-shrink-0">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-semibold text-slate-800 dark:text-white">Vehicle</span>
                        </div>
                        
                        <select className="w-full mb-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option>All Vehicles</option>
                        </select>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Search by plate no. or vehicle name..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            />
                        </div>
                    </div>

                    {/* Ongoing Trips List Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-slate-800 dark:text-white">Ongoing Trips</h3>
                            <span className="text-xs font-semibold text-slate-500">{filteredTrips.length} trips</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filteredTrips.length === 0 ? (
                                <div className="text-center py-10">
                                    <Car className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">No active vehicles</p>
                                </div>
                            ) : (
                                filteredTrips.map((trip) => {
                                    const isSelected = selectedTrip?.trip_id === trip.trip_id;
                                    return (
                                        <div
                                            key={trip.trip_id}
                                            onClick={() => handleTripSelect(trip)}
                                            className={cn(
                                                "p-3 rounded-xl cursor-pointer transition-all duration-200 border-l-4",
                                                isSelected ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm" : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            )}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono text-sm font-bold text-slate-800 dark:text-white">
                                                            {trip.vehicle?.plate_number || 'N/A'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">·</span>
                                                        <span className="text-xs text-slate-500 truncate">{trip.vehicle?.vehicle_model}</span>
                                                        
                                                        <Badge className={`ml-auto text-[10px] px-2 py-0.5 rounded-md ${
                                                            trip.status === 'in_transit' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {getStatusLabel(trip.status)}
                                                        </Badge>
                                                    </div>
                                                    
                                                    <div className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                                        GSO → {trip.destination} → GSO
                                                    </div>

                                                    <div className="flex items-center gap-4 mt-2">
                                                        <div>
                                                            <div className="text-xs font-semibold text-slate-800 dark:text-white">
                                                                {trip.current_location?.speed_kmh ? `${trip.current_location.speed_kmh} km/h` : '0 km/h'}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-slate-400">
                                                            {formatTime(trip.current_location?.recorded_at)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-400 mt-2" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT MAP AREA */}
                <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative">
                    <MapContainer
                        ref={mapRef}
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        className="z-0"
                    >
                        {mapType === 'satellite' ? (
                            <TileLayer url={MAP_TILES.satellite.url} attribution={MAP_TILES.satellite.attribution} />
                        ) : (
                            <TileLayer url={MAP_TILES.street.url} attribution={MAP_TILES.street.attribution} />
                        )}
                        <ZoomControl position="bottomright" />

                        {polylineRoute && polylineRoute.length > 1 && (
                            <Polyline positions={polylineRoute} color="#2563eb" weight={5} opacity={0.85} />
                        )}

                        {isReplaying && polylineRoute && polylineRoute.length > 0 && (
                            <Marker position={polylineRoute[replayIndex]} icon={createVehicleIcon('in_transit', true, true, true, 'REPLAY', '')} />
                        )}

                        {tripsWithLocation.map((trip) => {
                            if (!trip || !trip.current_location) return null;
                            const isSelected = selectedTrip?.trip_id === trip.trip_id;
                            return (
                                <Marker
                                    key={trip.trip_id}
                                    position={[trip.current_location.latitude, trip.current_location.longitude]}
                                    icon={createVehicleIcon(trip.status, isSelected, true, isSelected, trip.vehicle?.plate_number, trip.vehicle?.vehicle_model)}
                                    eventHandlers={{ click: () => handleTripSelect(trip) }}
                                >
                                    <Popup><TripPopupContent trip={trip} onViewTrip={handleViewTrip} onCenter={handleCenter} /></Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>

                    {/* Map Style Selector Overlay */}
                    <div className="absolute top-4 right-4 z-[1000] bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg flex overflow-hidden">
                        <button onClick={() => setMapType('street')} className={cn("px-4 py-1.5 text-xs font-medium", mapType === 'street' ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>Map</button>
                        <button onClick={() => setMapType('satellite')} className={cn("px-4 py-1.5 text-xs font-medium", mapType === 'satellite' ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>Satellite</button>
                    </div>

                    {/* ✅ BOTTOM MAP OVERLAY (Route Progress) */}
                    {selectedTrip && (
                        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                            
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="font-mono font-bold text-sm text-slate-800 dark:text-white">
                                        {selectedTrip.vehicle?.plate_number}
                                    </span>
                                    <span className="text-xs text-slate-400">·</span>
                                    <span className="text-xs text-slate-500">{selectedTrip.vehicle?.vehicle_model}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none">
                                        {getStatusLabel(selectedTrip.status)}
                                    </Badge>
                                    <button onClick={() => handleViewTrip(selectedTrip)} className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-2">
                                        View Details <ArrowRight className="h-3 w-3 inline" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4">
                                {/* Route Timeline Graphic */}
                                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2 font-medium">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full"><Fuel className="h-3.5 w-3.5 text-slate-500" /></div>
                                        <span>Fuel Station</span>
                                        <span className="text-[9px] text-slate-400">(0.0 km)</span>
                                    </div>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700 mx-2 relative">
                                        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 px-2">
                                            <MapPin className="h-4 w-4 text-blue-500" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-xs font-semibold text-slate-800 dark:text-white">Destination</span>
                                        <span className="text-[9px] text-slate-400">({selectedTrip.destination})</span>
                                    </div>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700 mx-2 relative">
                                        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 px-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full"><MapPin className="h-3.5 w-3.5 text-slate-500" /></div>
                                        <span>Laguindingan Hall</span>
                                        <span className="text-[9px] text-slate-400">(56.3 km)</span>
                                    </div>
                                </div>

                                {/* Distance Progress Bar */}
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mt-4 relative overflow-hidden">
                                    <div className="bg-emerald-500 h-3 rounded-full absolute left-0 top-0 transition-all duration-1000" style={{ width: '75%' }} />
                                </div>
                                
                                <div className="flex justify-between items-center text-xs mt-2">
                                    <span className="font-bold text-slate-800 dark:text-white text-sm">42.8 km <span className="text-slate-400 font-normal">/ 58.0 km</span></span>
                                    <span className="text-slate-500">Variance: <span className="text-amber-500 font-semibold">+2.6 km (4.7%)</span></span>
                                </div>
                            </div>
                            
                            {/* Bottom info row */}
                            <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                    <div className="text-[10px] text-slate-500">Current Location</div>
                                    <div className="text-xs font-medium text-slate-800 dark:text-white truncate">Near Opol, Misamis Oriental</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500">Start Time</div>
                                    <div className="text-xs font-medium text-slate-800 dark:text-white">10:30 AM</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500">Estimated Arrival</div>
                                    <div className="text-xs font-medium text-slate-800 dark:text-white">12:15 PM</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500">Current Distance</div>
                                    <div className="text-xs font-medium text-slate-800 dark:text-white">42.8 km</div>
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