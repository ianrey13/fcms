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
    Check,
    X,
    Wifi,
    WifiOff,
    Focus,
    Map,
    Eye,
    Fuel,
    Zap,
    Target,
    Move,
    Crosshair,
    Minimize2,
    Plus,
    Minus,
    Car,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';

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

const createVehicleIcon = (status, isSelected, isOnline = true, isFocused = false) => {
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

    return L.divIcon({
        className: 'custom-vehicle-icon',
        html: `
            <div style="
                position: relative;
                width: ${size + 12}px;
                height: ${size + 12}px;
                cursor: pointer;
                transition: all 0.3s ease;
            ">
                ${isFocused ? `
                    <div style="
                        position: absolute;
                        inset: -8px;
                        border-radius: 50%;
                        background: rgba(59, 130, 246, 0.15);
                        border: 3px solid rgba(59, 130, 246, 0.5);
                        animation: pulse-ring 1.5s ease-out infinite;
                        box-shadow: 0 0 40px rgba(59, 130, 246, 0.3);
                    "></div>
                    <div style="
                        position: absolute;
                        inset: -4px;
                        border-radius: 50%;
                        background: rgba(59, 130, 246, 0.05);
                        border: 2px solid rgba(59, 130, 246, 0.2);
                    "></div>
                ` : isSelected ? `
                    <div style="
                        position: absolute;
                        inset: -4px;
                        border-radius: 50%;
                        background: rgba(59, 130, 246, 0.15);
                        border: 2px solid rgba(59, 130, 246, 0.3);
                        animation: pulse-ring 2s ease-out infinite;
                    "></div>
                ` : ''}
                
                <div style="
                    width: ${size}px;
                    height: ${size}px;
                    background: ${color};
                    border-radius: 12px;
                    border: ${isFocused ? '3px solid #3b82f6' : '2px solid white'};
                    box-shadow: ${isFocused 
                        ? '0 4px 24px rgba(59,130,246,0.6), 0 0 60px rgba(59,130,246,0.15)' 
                        : '0 4px 12px rgba(0,0,0,0.25)'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: ${size * 0.5}px;
                    color: white;
                    position: relative;
                    z-index: 1;
                    transition: all 0.3s ease;
                    ${isFocused ? 'transform: scale(1.15);' : ''}
                    ${isSelected ? 'transform: scale(1.08);' : ''}
                    ${!isOnline ? 'opacity: 0.5;' : ''}
                ">
                    🚗
                </div>
                
                ${isFocused ? `
                    <div style="
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        background: #3b82f6;
                        border-radius: 50%;
                        width: 18px;
                        height: 18px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 2px solid white;
                        font-size: 9px;
                        color: white;
                        box-shadow: 0 2px 8px rgba(59,130,246,0.4);
                        z-index: 2;
                    ">
                        🎯
                    </div>
                ` : ''}
            </div>
        `,
        iconSize: [size + 12, size + 12],
        iconAnchor: [(size + 12) / 2, (size + 12) / 2],
        popupAnchor: [0, -(size + 12) / 2 - 5],
    });
};

// Add keyframe animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    @keyframes pulse-ring {
        0% { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(1.8); opacity: 0; }
    }
    @keyframes glow-pulse {
        0% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.05); }
        100% { opacity: 0.6; transform: scale(1); }
    }
    .custom-vehicle-icon:hover {
        filter: brightness(1.1);
        transform: scale(1.05);
    }
    .focus-glow {
        animation: glow-pulse 2s ease-in-out infinite;
    }
`;
document.head.appendChild(styleSheet);

// ============================================
// MAP TILE LAYER CONFIGURATIONS
// ============================================

const MAP_TILES = {
    street: {
        name: 'Street Map',
        icon: '🗺️',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    satellite: {
        name: 'Satellite',
        icon: '🛰️',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    },
    hybrid: {
        name: 'Hybrid',
        icon: '🌍',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    },
    terrain: {
        name: 'Terrain',
        icon: '⛰️',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
    },
    dark: {
        name: 'Dark Mode',
        icon: '🌙',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
    },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return 'N/A';
    }
};

const getStatusLabel = (status) => {
    const labels = {
        in_transit: 'In Transit',
        funds_issued: 'Funds Issued',
        acknowledged: 'Acknowledged',
        pending_mayors_office: 'Pending MO',
        pending_reconciliation: 'Pending Recon',
        completed: 'Completed',
        pending_gso_validation: 'Pending Validation',
        closed: 'Closed',
        returned_for_revision: 'Returned',
    };
    return labels[status] || status || 'Unknown';
};

const getStatusColor = (status) => {
    const colors = {
        in_transit: 'bg-green-500',
        funds_issued: 'bg-yellow-500',
        acknowledged: 'bg-blue-500',
        pending_mayors_office: 'bg-purple-500',
        pending_reconciliation: 'bg-orange-500',
        completed: 'bg-indigo-500',
        pending_gso_validation: 'bg-indigo-400',
        closed: 'bg-slate-500',
        returned_for_revision: 'bg-red-400',
    };
    return colors[status] || 'bg-slate-500';
};

const getStatusDot = getStatusColor;

const getMapTypeLabel = (type) => {
    return MAP_TILES[type]?.name || 'Street Map';
};

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${color} shadow-lg`}>
                <Icon className="h-4 w-4 text-white" />
            </div>
            <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{title}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
                {subtitle && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</p>
                )}
            </div>
        </div>
    </div>
);

// ============================================
// POPUP CONTENT COMPONENT
// ============================================

const TripPopupContent = ({ trip, onViewTrip, onCenter, onFocus }) => {
    const current_location = trip?.current_location;

    return (
        <div className="p-2 min-w-[240px] max-w-[300px]">
            <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(trip?.status)} animate-pulse`} />
                <span className="font-semibold text-sm text-slate-800 dark:text-white">
                    {trip?.ticket_number || 'N/A'}
                </span>
                <Badge className={`${getStatusColor(trip?.status)} text-white text-[10px] ml-auto`}>
                    {getStatusLabel(trip?.status)}
                </Badge>
            </div>
            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-500">Vehicle:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                        {trip?.vehicle?.plate_number || 'N/A'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-500">Driver:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                        {trip?.driver?.name || 'N/A'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-500">Destination:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                        {trip?.destination || 'N/A'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Gauge className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-500">Speed:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                        {current_location?.speed_kmh || 0} km/h
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2 mt-1">
                    <Clock className="h-3 w-3" />
                    Updated: {formatTime(current_location?.recorded_at)}
                    <span className="text-emerald-500 text-[10px] font-medium ml-auto">● Live</span>
                </div>
                <div className="text-[10px] text-slate-400">
                    GPS ping interval: 3s
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                <button
                    onClick={() => onViewTrip(trip)}
                    className="flex-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                >
                    <Eye className="h-3 w-3" />
                    View Trip
                </button>
                <button
                    onClick={() => onCenter(trip)}
                    className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-1"
                >
                    <Navigation className="h-3 w-3" />
                    Center
                </button>
                <button
                    onClick={() => onFocus(trip)}
                    className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
                >
                    <Focus className="h-3 w-3" />
                    Focus
                </button>
            </div>
        </div>
    );
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        <header className="bg-white/95 dark:bg-slate-900/95 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
                <SkeletonCard className="h-9 w-9 rounded-xl" />
                <div>
                    <SkeletonTitle width="w-32" className="h-5" />
                    <SkeletonText width="w-48" className="h-3" />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <SkeletonCard className="h-8 w-24" />
                <SkeletonCard className="h-8 w-24" />
                <SkeletonCard className="h-8 w-24" />
            </div>
        </header>
        <div className="px-4 md:px-6 py-3">
            <div className="grid grid-cols-3 gap-3 max-w-lg">
                {[1, 2, 3].map((i) => (
                    <SkeletonCard key={i} className="p-3">
                        <div className="flex items-center gap-3">
                            <SkeletonCard className="h-8 w-8 rounded-lg" />
                            <div>
                                <SkeletonText width="w-16" className="h-3" />
                                <SkeletonTitle width="w-12" className="h-4" />
                            </div>
                        </div>
                    </SkeletonCard>
                ))}
            </div>
        </div>
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 relative min-h-[50vh] lg:min-h-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <SkeletonCard className="w-16 h-16 rounded-full mx-auto mb-4" />
                    <SkeletonText width="w-32" className="h-4 mx-auto" />
                    <SkeletonText width="w-48" className="h-3 mx-auto mt-2" />
                </div>
            </div>
            <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200/60 dark:border-slate-800/60">
                <div className="p-4 border-b">
                    <SkeletonTitle width="w-32" className="h-5" />
                    <SkeletonText width="w-48" className="h-3 mt-1" />
                </div>
                <div className="p-3 space-y-2">
                    {[1, 2, 3].map((i) => (
                        <SkeletonCard key={i} className="p-3">
                            <div className="flex justify-between">
                                <div className="space-y-2 flex-1">
                                    <SkeletonText width="w-24" className="h-4" />
                                    <SkeletonText width="w-32" className="h-3" />
                                    <SkeletonText width="w-40" className="h-3" />
                                </div>
                                <div className="text-right">
                                    <SkeletonText width="w-16" className="h-3" />
                                    <SkeletonText width="w-16" className="h-3 mt-1" />
                                </div>
                            </div>
                        </SkeletonCard>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const LiveTracking = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [focusedTrip, setFocusedTrip] = useState(null);
    const [focusModalOpen, setFocusModalOpen] = useState(false);
    const [mapCenter, setMapCenter] = useState([8.5833, 124.6667]);
    const [mapZoom, setMapZoom] = useState(13);
    const [mapType, setMapType] = useState('street');
    const [isMapTypeDropdownOpen, setIsMapTypeDropdownOpen] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [tripsData, setTripsData] = useState([]);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [pingCount, setPingCount] = useState(0);
    const [hasActiveTrips, setHasActiveTrips] = useState(false);
    const [refreshAttempts, setRefreshAttempts] = useState(0);
    const mapRef = useRef(null);
    const dropdownRef = useRef(null);
    const pingCounterRef = useRef(0);
    const markerRefs = useRef({});
    const [followedTripId, setFollowedTripId] = useState(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsMapTypeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ============================================
    // ✅ AUTO-REFRESH - ONLY when there are active trips
    // ============================================

    // This function will be called by useAutoRefresh
    const fetchAllData = useCallback(() => {
        // ✅ Only refresh if there are active trips visible
        if (hasActiveTrips) {
            queryClient.invalidateQueries({ queryKey: ['gps-active-trips-live'] });
        } else {
            console.log('⏸️ Auto-refresh paused - No active trips');
        }
    }, [queryClient, hasActiveTrips]);

    // ✅ Auto-refresh is ENABLED but the callback checks if there are active trips
    useAutoRefresh(
        [
            "gps-location-updated",
            "trip-started",
            "trip-completed",
            "gso-trip-updated",
            "new-notification",
        ],
        fetchAllData,
        2000 // 2 second debounce to prevent multiple rapid refreshes
    );

    // ============================================
    // OPTIMIZED QUERY
    // ============================================

    const {
        data: activeTrips = [],
        isLoading,
        refetch,
        isFetching,
    } = useOptimizedQuery({
        queryKey: ['gps-active-trips-live'],
        queryFn: async () => {
            try {
                const response = await gpsAPI.getActiveTrips();

                let data = [];
                if (response?.data?.data) {
                    data = response.data.data;
                } else if (response?.data) {
                    data = response.data;
                } else if (Array.isArray(response)) {
                    data = response;
                }

                const safeData = Array.isArray(data) ? data : [];
                
                // ✅ Update active trips state
                const hasActive = safeData.some(trip => trip && trip.current_location);
                setHasActiveTrips(hasActive);
                setTripsData(safeData);
                setLastUpdate(new Date());
                
                // ✅ Reset refresh attempts on success
                setRefreshAttempts(0);
                
                return safeData;
            } catch (error) {
                console.error('❌ Error fetching active trips:', error);
                
                // ✅ Only show toast on first few errors to avoid spam
                setRefreshAttempts(prev => {
                    const newAttempts = prev + 1;
                    if (newAttempts === 1) {
                        toast.error('Failed to load active trips. Retrying...');
                    } else if (newAttempts === 5) {
                        toast.error('Multiple connection errors. Please refresh the page.');
                    }
                    return newAttempts;
                });
                
                // ✅ On error, check if we have cached data
                if (tripsData.length > 0) {
                    // Keep using cached data
                    return tripsData;
                }
                return [];
            }
        },
        refetchInterval: hasActiveTrips ? 15000 : false, // ✅ Only auto-refetch when there are active trips
        staleTime: 5000,
        keepPreviousData: true,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        enabled: true,
    });

    // ============================================
    // WEBSOCKET
    // ============================================

    useEffect(() => {
        if (!echo.connector || !echo.connector.pusher) {
            console.warn('⚠️ Echo not ready, will retry...');
            return;
        }

        console.log('🗺️ Setting up GSO live tracking WebSocket...');

        const channel = echo.channel('gso-live-tracking');

        setIsWsConnected(true);

        channel.listen('.location.updated', (data) => {
            console.log('📍 Real-time location update:', data);

            pingCounterRef.current += 1;
            setPingCount(pingCounterRef.current);

            setTripsData(prev => {
                if (!Array.isArray(prev)) return [];
                const updated = prev.map(trip => {
                    if (trip && trip.trip_id === data.trip_id) {
                        return {
                            ...trip,
                            current_location: {
                                latitude: data.latitude,
                                longitude: data.longitude,
                                speed_kmh: data.speed_kmh || 0,
                                accuracy_meters: data.accuracy_meters || 0,
                                heading_degrees: data.heading_degrees || 0,
                                recorded_at: data.timestamp || new Date().toISOString(),
                            }
                        };
                    }
                    return trip;
                });
                
                // ✅ Check if there are still active trips
                const hasActive = updated.some(trip => trip && trip.current_location);
                setHasActiveTrips(hasActive);
                
                return updated;
            });

            setSelectedTrip(prev => {
                if (prev && prev.trip_id === data.trip_id) {
                    return {
                        ...prev,
                        current_location: {
                            latitude: data.latitude,
                            longitude: data.longitude,
                            speed_kmh: data.speed_kmh || 0,
                            accuracy_meters: data.accuracy_meters || 0,
                            heading_degrees: data.heading_degrees || 0,
                            recorded_at: data.timestamp || new Date().toISOString(),
                        }
                    };
                }
                return prev;
            });

            setFocusedTrip(prev => {
                if (prev && prev.trip_id === data.trip_id) {
                    return {
                        ...prev,
                        current_location: {
                            latitude: data.latitude,
                            longitude: data.longitude,
                            speed_kmh: data.speed_kmh || 0,
                            accuracy_meters: data.accuracy_meters || 0,
                            heading_degrees: data.heading_degrees || 0,
                            recorded_at: data.timestamp || new Date().toISOString(),
                        }
                    };
                }
                return prev;
            });

            if (followedTripId === data.trip_id && mapRef.current) {
                mapRef.current.setView([data.latitude, data.longitude], mapZoom);
            }

            setLastUpdate(new Date());
        });

        channel.listen('.trip.completed', (data) => {
            console.log('🏁 Trip completed:', data);
            toast.success(`Trip ${data.trip_id || 'unknown'} has been completed`);
            // ✅ Refetch when trip completes to update active list
            if (hasActiveTrips) {
                queryClient.invalidateQueries({ queryKey: ['gps-active-trips-live'] });
            }
        });

        channel.listen('.trip.started', (data) => {
            console.log('🚗 Trip started:', data);
            toast.info(`Trip ${data.trip_id || 'unknown'} has started`);
            // ✅ Refetch when trip starts to show new active trip
            queryClient.invalidateQueries({ queryKey: ['gps-active-trips-live'] });
            setHasActiveTrips(true);
        });

        channel.subscribed(() => {
            console.log('✅ Subscribed to gso-live-tracking');
            setIsWsConnected(true);
        });

        channel.error((error) => {
            console.error('❌ gso-live-tracking subscription error:', error);
            setIsWsConnected(false);
        });

        if (echo.connector && echo.connector.pusher) {
            const connection = echo.connector.pusher.connection;
            connection.bind('connected', () => {
                console.log('✅ WebSocket connected');
                setIsWsConnected(true);
            });
            connection.bind('disconnected', () => {
                console.log('🔌 WebSocket disconnected');
                setIsWsConnected(false);
            });
        }

        return () => {
            try {
                channel.stopListening('.location.updated');
                channel.stopListening('.trip.completed');
                channel.stopListening('.trip.started');
                echo.leave('gso-live-tracking');
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, [hasActiveTrips]);

    // ============================================
    // DERIVED DATA
    // ============================================

    const tripsWithLocation = useMemo(() => {
        return Array.isArray(tripsData)
            ? tripsData.filter(trip => trip && trip.current_location)
            : [];
    }, [tripsData]);

    const activeCount = tripsWithLocation.length;

    // Connection status
    const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
    const isRealTime = isConnected;

    // ============================================
    // STATS
    // ============================================

    const stats = useMemo(() => [
        {
            title: 'Active Vehicles',
            value: activeCount,
            icon: Truck,
            color: 'from-green-500 to-emerald-600',
            subtitle: `${activeCount} on the road`,
        },
        {
            title: 'Average Speed',
            value: activeCount > 0
                ? Math.round(tripsWithLocation.reduce((acc, t) => acc + (t?.current_location?.speed_kmh || 0), 0) / activeCount)
                : 0,
            icon: Gauge,
            color: 'from-blue-500 to-blue-600',
            subtitle: 'km/h',
        },
        {
            title: 'Last Update',
            value: lastUpdate ? formatTime(lastUpdate) : '--',
            icon: Clock,
            color: 'from-purple-500 to-purple-600',
            subtitle: `Pings: ${pingCount}`,
        },
    ], [activeCount, tripsWithLocation, lastUpdate, pingCount]);

    // ============================================
    // HANDLERS
    // ============================================

    const handleTripSelect = (trip) => {
        setSelectedTrip(trip);
        setFollowedTripId(trip?.trip_id);
        if (trip && trip.current_location) {
            setMapCenter([trip.current_location.latitude, trip.current_location.longitude]);
            setMapZoom(16);
            if (mapRef.current) {
                mapRef.current.setView([trip.current_location.latitude, trip.current_location.longitude], 16);
            }
        }
    };

    const handleViewTrip = (trip) => {
        setSelectedTrip(null);
        setFollowedTripId(null);
        navigate(`/gso/trip/${trip?.trip_id}`);
    };

    const handleCenter = (trip) => {
        if (trip && trip.current_location) {
            setMapCenter([trip.current_location.latitude, trip.current_location.longitude]);
            setMapZoom(16);
            setSelectedTrip(trip);
            setFollowedTripId(trip.trip_id);
            if (mapRef.current) {
                mapRef.current.setView([trip.current_location.latitude, trip.current_location.longitude], 16);
            }
        }
    };

    const handleFocus = (trip) => {
        console.log('🎯 Focusing on trip:', trip?.ticket_number);
        setFocusedTrip(trip);
        setFocusModalOpen(true);
    };

    const handleCloseModal = () => {
        console.log('🔒 Closing focus modal');
        setFocusModalOpen(false);
        setTimeout(() => {
            setFocusedTrip(null);
        }, 300);
    };

    const handleFocusAll = () => {
        setFocusedTrip(null);
        setFocusModalOpen(true);
    };

    const handleFitBounds = () => {
        if (tripsWithLocation.length === 0) {
            toast.error('No active vehicles to fit');
            return;
        }

        const validTrips = tripsWithLocation.filter(t => t && t.current_location);
        if (validTrips.length === 0) {
            toast.error('No valid vehicle locations');
            return;
        }

        const bounds = L.latLngBounds(
            validTrips.map(trip => [
                trip.current_location.latitude,
                trip.current_location.longitude,
            ])
        );
        mapRef.current?.fitBounds(bounds, { padding: [50, 50] });
    };

    const handleMapTypeChange = (type) => {
        setMapType(type);
        setIsMapTypeDropdownOpen(false);
        if (type === 'satellite' || type === 'hybrid') {
            setMapZoom(prev => Math.max(prev, 14));
        }
    };

    // ❌ REFRESH BUTTON REMOVED - Auto-refresh handles everything

    // ============================================
    // RENDER MAP TILE
    // ============================================

    const renderMapTiles = () => {
        switch (mapType) {
            case 'satellite':
                return (
                    <TileLayer
                        key="satellite"
                        url={MAP_TILES.satellite.url}
                        attribution={MAP_TILES.satellite.attribution}
                    />
                );
            case 'hybrid':
                return (
                    <div key="hybrid">
                        <TileLayer
                            url={MAP_TILES.satellite.url}
                            attribution={MAP_TILES.satellite.attribution}
                        />
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
                            opacity={0.7}
                        />
                    </div>
                );
            case 'terrain':
                return (
                    <TileLayer
                        key="terrain"
                        url={MAP_TILES.terrain.url}
                        attribution={MAP_TILES.terrain.attribution}
                    />
                );
            case 'dark':
                return (
                    <TileLayer
                        key="dark"
                        url={MAP_TILES.dark.url}
                        attribution={MAP_TILES.dark.attribution}
                    />
                );
            default:
                return (
                    <TileLayer
                        key="street"
                        url={MAP_TILES.street.url}
                        attribution={MAP_TILES.street.attribution}
                    />
                );
        }
    };

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading && tripsData.length === 0) {
        return <LoadingSkeleton />;
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-800/60 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/gso/dashboard')}
                        className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-9 w-9"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Satellite className="h-5 w-5 text-blue-500" />
                            Live Tracking
                            {!hasActiveTrips && (
                                <Badge variant="outline" className="text-xs text-slate-400 border-slate-300 dark:border-slate-600 ml-2">
                                    <Activity className="h-3 w-3 mr-1" />
                                    Paused
                                </Badge>
                            )}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                                <span className={`h-2 w-2 rounded-full ${hasActiveTrips ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                                {hasActiveTrips ? `${activeCount} active vehicle${activeCount !== 1 ? 's' : ''} tracking` : 'No active trips'}
                            </span>
                            {hasActiveTrips && (
                                <span className="text-blue-500 text-[10px] font-medium">● Live</span>
                            )}
                            <span className="flex items-center gap-1">
                                {isWsConnected ? (
                                    <Wifi className="h-3 w-3 text-emerald-500" />
                                ) : (
                                    <WifiOff className="h-3 w-3 text-red-500" />
                                )}
                                <span className={isWsConnected ? 'text-emerald-500' : 'text-red-500'}>
                                    {isWsConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </span>
                            {hasActiveTrips && (
                                <>
                                    <span className="text-slate-400 text-[10px]">
                                        Pings: {pingCount}
                                    </span>
                                    <span className="ml-2 text-xs opacity-70">{connectionStatus}</span>
                                    <span className="text-xs text-emerald-400 animate-pulse">
                                        ● Auto-refresh
                                    </span>
                                </>
                            )}
                            {!hasActiveTrips && (
                                <span className="text-xs text-slate-400">
                                    ⏸️ Waiting for trips
                                </span>
                            )}
                            {isFetching && hasActiveTrips && (
                                <span className="flex items-center gap-1 text-slate-400">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Updating...
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Map Type Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsMapTypeDropdownOpen(!isMapTypeDropdownOpen)}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Layers className="h-4 w-4" />
                            {getMapTypeLabel(mapType)}
                            <ChevronDown className="h-4 w-4" />
                        </button>

                        {isMapTypeDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 py-1 overflow-hidden">
                                {Object.entries(MAP_TILES).map(([key, config]) => {
                                    const isActive = mapType === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleMapTypeChange(key)}
                                            className={cn(
                                                "w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-3",
                                                isActive
                                                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                            )}
                                        >
                                            <span>{config.icon}</span>
                                            <span>{config.name}</span>
                                            {isActive && (
                                                <Check className="h-4 w-4 ml-auto text-blue-600" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFitBounds}
                        disabled={!hasActiveTrips}
                        className="dark:border-slate-700 dark:text-slate-300"
                    >
                        <Maximize2 className="h-4 w-4 mr-1.5" />
                        Fit All
                    </Button>
                    {/* ❌ REFRESH BUTTON REMOVED - Auto-refresh handles everything */}
                </div>
            </header>

            {/* Stats Bar */}
            <div className="px-4 md:px-6 py-3 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="grid grid-cols-3 gap-3 max-w-lg">
                    {stats.map((stat, index) => (
                        <StatsCard key={index} {...stat} />
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Map */}
                <div className="flex-1 relative min-h-[50vh] lg:min-h-0">
                    {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-slate-500 dark:text-slate-400">Loading vehicles...</p>
                            </div>
                        </div>
                    ) : (
                        <MapContainer
                            ref={mapRef}
                            center={mapCenter}
                            zoom={mapZoom}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            className="z-0"
                        >
                            {renderMapTiles()}
                            <ZoomControl position="bottomright" />

                            {tripsWithLocation.length > 0 ? (
                                tripsWithLocation.map((trip) => {
                                    if (!trip || !trip.current_location) return null;
                                    const isSelected = selectedTrip?.trip_id === trip.trip_id;
                                    const isFocused = focusedTrip?.trip_id === trip.trip_id;

                                    return (
                                        <div key={trip.trip_id}>
                                            {trip.route && trip.route.length > 1 && (
                                                <Polyline
                                                    positions={trip.route.map(p => [p.latitude, p.longitude])}
                                                    color={isSelected || isFocused ? '#2563eb' : '#94a3b8'}
                                                    weight={isSelected || isFocused ? 4 : 2}
                                                    opacity={isSelected || isFocused ? 0.9 : 0.4}
                                                    dashArray={isSelected || isFocused ? null : '5, 5'}
                                                />
                                            )}

                                            <Marker
                                                position={[trip.current_location.latitude, trip.current_location.longitude]}
                                                icon={createVehicleIcon(trip.status, isSelected, true, isFocused)}
                                                eventHandlers={{
                                                    click: () => handleTripSelect(trip),
                                                }}
                                                ref={(ref) => {
                                                    if (ref) {
                                                        markerRefs.current[trip.trip_id] = ref;
                                                    }
                                                }}
                                            >
                                                <Popup>
                                                    <TripPopupContent
                                                        trip={trip}
                                                        onViewTrip={handleViewTrip}
                                                        onCenter={handleCenter}
                                                        onFocus={handleFocus}
                                                    />
                                                </Popup>
                                            </Marker>

                                            {trip.current_location.accuracy_meters && trip.current_location.accuracy_meters < 100 && (
                                                <Circle
                                                    center={[trip.current_location.latitude, trip.current_location.longitude]}
                                                    radius={trip.current_location.accuracy_meters}
                                                    color={isSelected || isFocused ? '#2563eb' : '#94a3b8'}
                                                    fillColor={isSelected || isFocused ? '#2563eb' : '#94a3b8'}
                                                    fillOpacity={0.1}
                                                />
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md text-center pointer-events-auto border border-slate-200/60 dark:border-slate-700/60">
                                        <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                            <Satellite className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No active vehicles</p>
                                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                            Vehicles with GPS tracking will appear here
                                        </p>
                                        <div className="mt-3 flex items-center justify-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${hasActiveTrips ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                                            <span className={`text-xs ${hasActiveTrips ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                {hasActiveTrips ? 'Receiving GPS pings' : 'Waiting for GPS pings'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </MapContainer>
                    )}
                </div>

                {/* Sidebar */}
                <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200/60 dark:border-slate-800/60 overflow-y-auto">
                    <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                <Truck className="h-4 w-4 text-blue-500" />
                                Active Vehicles
                                <span className={`text-xs font-normal ml-2 ${hasActiveTrips ? 'text-emerald-500' : 'text-slate-400'}`}>
                                    {hasActiveTrips ? '● Live' : '○ No active'}
                                </span>
                            </h2>
                            {tripsWithLocation.length > 0 && (
                                <button
                                    onClick={handleFocusAll}
                                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Focus className="h-3 w-3" />
                                    Focus All
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {hasActiveTrips ? 'Click a vehicle to focus on map' : 'No active trips at the moment'}
                        </p>
                    </div>

                    <div className="p-3 space-y-2">
                        {tripsWithLocation.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                                    <Truck className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">No active vehicles</p>
                                <p className="text-xs text-slate-400 mt-1">Waiting for GPS pings...</p>
                            </div>
                        ) : (
                            tripsWithLocation.map((trip) => {
                                if (!trip) return null;
                                const isSelected = selectedTrip?.trip_id === trip.trip_id;
                                const isFocused = focusedTrip?.trip_id === trip.trip_id;
                                const { current_location } = trip;

                                return (
                                    <div
                                        key={trip.trip_id}
                                        onClick={() => handleTripSelect(trip)}
                                        className={cn(
                                            "p-3 rounded-xl cursor-pointer transition-all duration-200 relative",
                                            isFocused
                                                ? "bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/10"
                                                : isSelected
                                                    ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 shadow-sm shadow-blue-500/10"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        )}
                                    >
                                        {isFocused && (
                                            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Focus className="h-2.5 w-2.5" />
                                                FOCUS
                                            </div>
                                        )}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${getStatusDot(trip.status)} ${isFocused ? 'animate-ping' : 'animate-pulse'}`} />
                                                    <span className={cn(
                                                        "font-mono text-sm font-semibold truncate",
                                                        isFocused ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-white"
                                                    )}>
                                                        {trip.ticket_number}
                                                    </span>
                                                    <span className="text-[10px] text-emerald-500 font-medium">● Live</span>
                                                </div>
                                                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                                                    <Truck className="h-3 w-3 text-slate-400" />
                                                    {trip.vehicle?.plate_number || 'N/A'}
                                                    <span className="text-slate-400 mx-1">•</span>
                                                    <User className="h-3 w-3 text-slate-400" />
                                                    {trip.driver?.name || 'N/A'}
                                                </div>
                                                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {trip.destination || 'N/A'}
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 justify-end">
                                                    <Gauge className="h-3 w-3 text-slate-400" />
                                                    {current_location?.speed_kmh || 0} km/h
                                                </div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 justify-end">
                                                    <Clock className="h-3 w-3" />
                                                    {formatTime(current_location?.recorded_at)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-2 flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFocus(trip);
                                                }}
                                                className="flex-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Focus className="h-3 w-3" />
                                                Focus Monitor
                                            </button>
                                        </div>

                                        {isSelected && current_location && (
                                            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg px-2 py-1">
                                                <Navigation className="h-3 w-3" />
                                                {current_location.latitude.toFixed(5)}, {current_location.longitude.toFixed(5)}
                                                <span className="text-emerald-500 text-[10px] font-medium ml-auto">● Live</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${hasActiveTrips ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                            {hasActiveTrips ? 'Real-time via WebSocket' : 'Waiting for active trips'}
                        </span>
                        {hasActiveTrips && (
                            <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                <span>Ping: 3s</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Focus Monitoring Modal */}
            {focusModalOpen && focusedTrip && (
                <div className="fixed inset-0 z-[2000] overflow-y-auto">
                    <div className="min-h-screen px-2 py-4 md:px-4 md:py-8 flex items-center justify-center bg-black/80 backdrop-blur-md">
                        <LiveTripTracker
                            trip={focusedTrip}
                            allTrips={tripsWithLocation}
                            isOpen={focusModalOpen}
                            onClose={handleCloseModal}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveTracking;