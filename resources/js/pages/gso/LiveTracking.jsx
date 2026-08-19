// src/pages/gso/LiveTracking.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gpsAPI } from '../../services/api';
import echo from '../../services/echo';
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
  Wifi,
  WifiOff,
  Eye,
  Compass,
  X,
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
// 🧭 HELPER: Get cardinal direction
// ============================================

const getDirection = (heading) => {
  if (heading === null || heading === undefined) return '--';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((heading % 360) / 45)) % 8;
  return dirs[idx];
};

// ============================================
// 🚗 VEHICLE ICON - Clean & Normal
// ============================================

const createVehicleIcon = (status, isSelected, isOnline = true) => {
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
  const size = isSelected ? 38 : 32;
  
  return L.divIcon({
    className: 'custom-vehicle-icon',
    html: `
      <div style="
        position: relative;
        width: ${size + 8}px;
        height: ${size + 8}px;
        cursor: pointer;
      ">
        ${isSelected ? `
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: rgba(59, 130, 246, 0.15);
            border: 2px solid rgba(59, 130, 246, 0.3);
            animation: pulse-ring 2s ease-out infinite;
          "></div>
        ` : ''}
        
        <!-- 🚗 Car Icon -->
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 10px;
          border: 2px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${size * 0.5}px;
          color: white;
          position: relative;
          z-index: 1;
          transition: all 0.3s ease;
          ${isSelected ? 'transform: scale(1.1); box-shadow: 0 4px 20px rgba(59,130,246,0.4);' : ''}
          ${!isOnline ? 'opacity: 0.5;' : ''}
        ">
          🚗
        </div>

        <!-- Status Dot -->
        <div style="
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background: ${isOnline ? '#22c55e' : '#ef4444'};
          border-radius: 50%;
          border: 2px solid white;
          z-index: 2;
          ${isOnline ? 'animation: pulse-dot 2s ease-in-out infinite;' : ''}
        "></div>
      </div>
    `,
    iconSize: [size + 8, size + 8],
    iconAnchor: [(size + 8) / 2, (size + 8) / 2],
    popupAnchor: [0, -(size + 8) / 2 - 5],
  });
};

// Add keyframe animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.4); }
  }
  .custom-vehicle-icon:hover {
    filter: brightness(1.1);
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
// 🗺️ POPUP CONTENT COMPONENT
// ============================================

const TripPopupContent = ({ trip, onViewTrip, onCenter, onFocus }) => {
  const { current_location } = trip;
  const heading = current_location?.heading_degrees || 0;
  const dir = getDirection(heading);
  
  return (
    <div className="p-2 min-w-[240px] max-w-[300px]">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(trip.status)} animate-pulse`} />
        <span className="font-semibold text-sm text-slate-800 dark:text-white">
          {trip.ticket_number}
        </span>
        <Badge className={`${getStatusColor(trip.status)} text-white text-[10px] ml-auto`}>
          {getStatusLabel(trip.status)}
        </Badge>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Truck className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500">Vehicle:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {trip.vehicle?.plate_number || 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500">Driver:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {trip.driver?.name || 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500">Destination:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
            {trip.destination || 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500">Speed:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {current_location?.speed_kmh || 0} km/h
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Compass className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500">Heading:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {heading ? `${Math.round(heading)}° ${dir}` : '--'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2 mt-1">
          <Clock className="h-3 w-3" />
          Updated: {formatTime(current_location?.recorded_at)}
          <span className="text-emerald-500 text-[10px] font-medium ml-auto">● Live</span>
        </div>
        <div className="text-[10px] text-slate-400">
          GPS ping interval: 10s
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
          <Maximize2 className="h-3 w-3" />
          Focus
        </button>
      </div>
    </div>
  );
};

// ============================================
// 🎯 FOCUS MONITORING MODAL
// ============================================

const FocusModal = ({ trip, onClose }) => {
  if (!trip) return null;
  
  const { current_location } = trip;
  const heading = current_location?.heading_degrees || 0;
  const dir = getDirection(heading);
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200/60 dark:border-slate-700/60">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusDot(trip.status)} animate-pulse`} />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {trip.ticket_number}
            </h2>
            <Badge className={`${getStatusColor(trip.status)} text-white text-[10px]`}>
              {getStatusLabel(trip.status)}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Location */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">📍 Current Location</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-400">Latitude</p>
                <p className="text-sm font-mono text-slate-900 dark:text-white">
                  {current_location?.latitude.toFixed(6) || '--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Longitude</p>
                <p className="text-sm font-mono text-slate-900 dark:text-white">
                  {current_location?.longitude.toFixed(6) || '--'}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-400">Speed</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {current_location?.speed_kmh || 0} <span className="text-sm font-normal text-slate-400">km/h</span>
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-400">Heading</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {heading ? `${Math.round(heading)}°` : '--'} <span className="text-sm font-normal text-slate-400">{dir}</span>
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-400">Accuracy</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {current_location?.accuracy_meters || 0} <span className="text-sm font-normal text-slate-400">m</span>
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-400">Last Update</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatTime(current_location?.recorded_at)}
              </p>
            </div>
          </div>

          {/* Trip Info */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Trip Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Destination</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{trip.destination || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Vehicle</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {trip.vehicle?.plate_number || 'N/A'} • {trip.vehicle?.vehicle_model || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Driver</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{trip.driver?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Department</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{trip.department || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Pings</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{trip.ping_count || 0}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => window.open(`/gso/trip/${trip.trip_id}`, '_blank')}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Full Trip
            </button>
            <button
              onClick={() => {
                if (trip.current_location) {
                  onClose();
                  // Center map on this trip
                  const map = document.querySelector('.leaflet-container')?._leaflet_map;
                  if (map) {
                    map.setView(
                      [trip.current_location.latitude, trip.current_location.longitude],
                      16
                    );
                  }
                }
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Navigation className="h-4 w-4" />
              Center Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function LiveTracking() {
  const navigate = useNavigate();
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [focusedTrip, setFocusedTrip] = useState(null);
  const [mapCenter, setMapCenter] = useState([8.5833, 124.6667]);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapType, setMapType] = useState('street');
  const [isMapTypeDropdownOpen, setIsMapTypeDropdownOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tripsData, setTripsData] = useState([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [pingCount, setPingCount] = useState(0);
  const mapRef = useRef(null);
  const dropdownRef = useRef(null);
  const pingCounterRef = useRef(0);

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
  // QUERY: Active Trips with GPS
  // ============================================

  const { 
    data: activeTrips = [], 
    isLoading, 
    refetch,
    isFetching,
  } = useQuery({
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
        
        setTripsData(data);
        setLastUpdate(new Date());
        return data;
      } catch (error) {
        console.error('❌ Error fetching active trips:', error);
        toast.error('Failed to load active trips. Please refresh.');
        return [];
      }
    },
    refetchInterval: 10000,
    staleTime: 5000,
    retry: 2,
    retryDelay: 1000,
  });

  // ============================================
  // WEBSOCKET: Real-time location updates
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
        const updated = prev.map(trip => {
          if (trip.trip_id === data.trip_id) {
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

      if (focusedTrip && focusedTrip.trip_id === data.trip_id) {
        setFocusedTrip(prev => ({
          ...prev,
          current_location: {
            latitude: data.latitude,
            longitude: data.longitude,
            speed_kmh: data.speed_kmh || 0,
            accuracy_meters: data.accuracy_meters || 0,
            heading_degrees: data.heading_degrees || 0,
            recorded_at: data.timestamp || new Date().toISOString(),
          }
        }));
      }

      setLastUpdate(new Date());
    });

    channel.listen('.trip.completed', (data) => {
      console.log('🏁 Trip completed:', data);
      toast.success(`Trip ${data.trip_id || 'unknown'} has been completed`);
      refetch();
    });

    channel.listen('.trip.started', (data) => {
      console.log('🚗 Trip started:', data);
      toast.info(`Trip ${data.trip_id || 'unknown'} has started`);
      refetch();
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
  }, []);

  // ============================================
  // FILTER: Trips with location data
  // ============================================

  const tripsWithLocation = tripsData.filter(trip => trip.current_location);
  const activeCount = tripsWithLocation.length;

  // ============================================
  // STATS
  // ============================================

  const stats = [
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
        ? Math.round(tripsWithLocation.reduce((acc, t) => acc + (t.current_location?.speed_kmh || 0), 0) / activeCount)
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
  ];

  // ============================================
  // HANDLERS
  // ============================================

  const handleTripSelect = (trip) => {
    setSelectedTrip(trip);
    if (trip.current_location) {
      setMapCenter([trip.current_location.latitude, trip.current_location.longitude]);
      setMapZoom(16);
    }
  };

  const handleViewTrip = (trip) => {
    setSelectedTrip(null);
    navigate(`/gso/trip/${trip.trip_id}`);
  };

  const handleCenter = (trip) => {
    if (trip.current_location) {
      setMapCenter([trip.current_location.latitude, trip.current_location.longitude]);
      setMapZoom(16);
      setSelectedTrip(trip);
    }
  };

  const handleFocus = (trip) => {
    setFocusedTrip(trip);
  };

  const handleFitBounds = () => {
    if (tripsWithLocation.length === 0) {
      toast.error('No active vehicles to fit');
      return;
    }
    
    const bounds = L.latLngBounds(
      tripsWithLocation.map(trip => [
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

  const handleRefresh = () => {
    refetch();
    toast.success('Refreshing location data...');
  };

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
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                {activeCount} active vehicle{activeCount !== 1 ? 's' : ''} tracking
              </span>
              <span className="text-blue-500 text-[10px] font-medium">● Live</span>
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
              <span className="text-slate-400 text-[10px]">
                Pings: {pingCount}
              </span>
              {isFetching && (
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
            className="dark:border-slate-700 dark:text-slate-300"
          >
            <Maximize2 className="h-4 w-4 mr-1.5" />
            Fit All
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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
          ) : tripsWithLocation.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                  <Satellite className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">No active vehicles</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Vehicles with GPS tracking will appear here
                </p>
                <p className="text-xs text-blue-500 mt-2">
                  ● Waiting for real-time updates
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Mobile GPS pings every 10 seconds
                </p>
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

              {tripsWithLocation.map((trip) => {
                const isSelected = selectedTrip?.trip_id === trip.trip_id;
                const { current_location } = trip;

                return (
                  <div key={trip.trip_id}>
                    {/* Route Polyline */}
                    {trip.route && trip.route.length > 1 && (
                      <Polyline
                        positions={trip.route.map(p => [p.latitude, p.longitude])}
                        color={isSelected ? '#2563eb' : '#94a3b8'}
                        weight={isSelected ? 4 : 2}
                        opacity={isSelected ? 0.9 : 0.4}
                        dashArray={isSelected ? null : '5, 5'}
                      />
                    )}

                    {/* Vehicle Marker - Clickable with Popup */}
                    <Marker
                      position={[current_location.latitude, current_location.longitude]}
                      icon={createVehicleIcon(trip.status, isSelected, true)}
                      eventHandlers={{
                        click: () => handleTripSelect(trip),
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

                    {/* Accuracy Circle */}
                    {current_location.accuracy_meters && current_location.accuracy_meters < 100 && (
                      <Circle
                        center={[current_location.latitude, current_location.longitude]}
                        radius={current_location.accuracy_meters}
                        color={isSelected ? '#2563eb' : '#94a3b8'}
                        fillColor={isSelected ? '#2563eb' : '#94a3b8'}
                        fillOpacity={0.1}
                      />
                    )}
                  </div>
                );
              })}
            </MapContainer>
          )}

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-lg p-3 text-xs z-[1000] border border-slate-200/60 dark:border-slate-700/60">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-slate-600 dark:text-slate-300">In Transit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-slate-600 dark:text-slate-300">Funds Issued</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-slate-600 dark:text-slate-300">Acknowledged</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-slate-600 dark:text-slate-300">Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 bg-slate-400" />
                  <span className="text-slate-500 dark:text-slate-400">Route</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 bg-blue-500" />
                  <span className="text-slate-500 dark:text-slate-400">Selected</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                🚗 Click car for details • GPS ping: 10s
              </div>
            </div>
          </div>

          {/* Map Info */}
          <div className="absolute top-4 right-4 flex items-center gap-3 z-[1000]">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-2 text-sm border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500 animate-pulse" />
                {tripsWithLocation.length} active
                <span className="text-[10px] text-emerald-500 font-normal">● Live</span>
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar - Trip List */}
        <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200/60 dark:border-slate-800/60 overflow-y-auto">
          <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60">
            <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-500" />
              Active Vehicles
              <span className="text-xs text-emerald-500 font-normal ml-2">● Live</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Click a vehicle to focus on map</span>
              <span className="text-[10px] text-slate-400">Ping: 10s</span>
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
                const isSelected = selectedTrip?.trip_id === trip.trip_id;
                const { current_location } = trip;

                return (
                  <div
                    key={trip.trip_id}
                    onClick={() => handleTripSelect(trip)}
                    className={cn(
                      "p-3 rounded-xl cursor-pointer transition-all duration-200",
                      isSelected 
                        ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 shadow-sm shadow-blue-500/10" 
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusDot(trip.status)} animate-pulse`} />
                          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white truncate">
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
                        <Maximize2 className="h-3 w-3" />
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
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Real-time via WebSocket
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span>Ping: 10s</span>
            </span>
          </div>
        </div>
      </div>

      {/* Focus Monitoring Modal */}
      <FocusModal 
        trip={focusedTrip} 
        onClose={() => setFocusedTrip(null)} 
      />
    </div>
  );
}