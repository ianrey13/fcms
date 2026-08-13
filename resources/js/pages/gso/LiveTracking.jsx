// src/pages/gso/LiveTracking.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gpsAPI } from '../../services/api';
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
  Minus, 
  Plus, 
  Truck, 
  User, 
  MapPin, 
  Clock, 
  Gauge, 
  Navigation,
  Satellite,
  Layers,
  Eye,
  Activity,
  Zap,
  Shield,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'react-hot-toast';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ============================================
// VEHICLE ICONS
// ============================================

const createVehicleIcon = (status, isSelected, isOnline = true) => {
  const colors = {
    in_transit: '#22c55e',
    funds_issued: '#f59e0b',
    acknowledged: '#3b82f6',
    pending_mayors_office: '#8b5cf6',
    pending_reconciliation: '#f97316',
    closed: '#6b7280',
  };
  const color = colors[status] || '#6b7280';
  const size = isSelected ? 36 : 30;
  const glowSize = isSelected ? 44 : 36;
  
  return L.divIcon({
    className: 'custom-vehicle-icon',
    html: `
      <div style="position: relative; width: ${glowSize}px; height: ${glowSize}px;">
        ${isSelected ? `
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: rgba(59, 130, 246, 0.2);
            animation: pulse-ring 2s ease-out infinite;
          "></div>
        ` : ''}
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${size * 0.45}px;
          color: white;
          position: relative;
          z-index: 1;
          ${isSelected ? 'box-shadow: 0 0 0 4px rgba(59,130,246,0.5);' : ''}
          ${!isOnline ? 'opacity: 0.6;' : ''}
        ">
          🚗
        </div>
        ${!isOnline ? `
          <div style="
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 12px;
            height: 12px;
            background: #ef4444;
            border-radius: 50%;
            border: 2px solid white;
            z-index: 2;
          "></div>
        ` : ''}
        ${isOnline ? `
          <div style="
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 12px;
            height: 12px;
            background: #22c55e;
            border-radius: 50%;
            border: 2px solid white;
            z-index: 2;
            animation: pulse-dot 2s ease-in-out infinite;
          "></div>
        ` : ''}
      </div>
    `,
    iconSize: [glowSize, glowSize],
    iconAnchor: [glowSize/2, glowSize/2],
    popupAnchor: [0, -glowSize/2],
  });
};

// Add keyframe animations for the icon
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); }
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
// HELPER FUNCTIONS (MOVED BEFORE STATS)
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

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
    closed: 'Closed',
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
    closed: 'bg-slate-500',
  };
  return colors[status] || 'bg-slate-500';
};

const getMapTypeLabel = (type) => {
  return MAP_TILES[type]?.name || 'Street Map';
};

const getStatusDot = (status) => {
  const colors = {
    in_transit: 'bg-green-500',
    funds_issued: 'bg-yellow-500',
    acknowledged: 'bg-blue-500',
    pending_mayors_office: 'bg-purple-500',
    pending_reconciliation: 'bg-orange-500',
    closed: 'bg-slate-500',
  };
  return colors[status] || 'bg-slate-500';
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
// MAIN COMPONENT
// ============================================

export default function LiveTracking() {
  const navigate = useNavigate();
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [mapCenter, setMapCenter] = useState([8.5833, 124.6667]);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapType, setMapType] = useState('street');
  const [isMapTypeDropdownOpen, setIsMapTypeDropdownOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const mapRef = useRef(null);
  const dropdownRef = useRef(null);

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
        const data = response?.data?.data || [];
        setLastUpdate(new Date());
        return data;
      } catch (error) {
        console.error('Error fetching active trips:', error);
        return [];
      }
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // ============================================
  // FILTER: Trips with location data
  // ============================================

  const tripsWithLocation = activeTrips.filter(trip => trip.current_location);
  const activeCount = tripsWithLocation.length;

  // ============================================
  // STATS (NOW formatTime IS DEFINED)
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
      subtitle: 'Auto-refresh every 10s',
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
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span>{activeCount} active vehicle{activeCount !== 1 ? 's' : ''} tracking</span>
              {isFetching && (
                <span className="flex items-center gap-1 text-blue-500">
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

                    {/* Vehicle Marker */}
                    <Marker
                      position={[current_location.latitude, current_location.longitude]}
                      icon={createVehicleIcon(trip.status, isSelected, true)}
                      eventHandlers={{
                        click: () => handleTripSelect(trip),
                      }}
                    >
                      <Popup>
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
                                {trip.vehicle?.plate_number}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-slate-500">Driver:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {trip.driver?.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-slate-500">Destination:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                {trip.destination}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Gauge className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-slate-500">Speed:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {current_location.speed_kmh || 0} km/h
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2 mt-1">
                              <Clock className="h-3 w-3" />
                              Updated: {formatTime(current_location.recorded_at)}
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => navigate(`/gso/trip/${trip.trip_id}`)}
                              className="flex-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              View Trip
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTrip(trip);
                                setMapCenter([current_location.latitude, current_location.longitude]);
                                setMapZoom(16);
                              }}
                              className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                            >
                              Center
                            </button>
                          </div>
                        </div>
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
                  <div className="w-6 h-0.5 bg-slate-400" />
                  <span className="text-slate-500 dark:text-slate-400">Route</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 bg-blue-500" />
                  <span className="text-slate-500 dark:text-slate-400">Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-transparent" />
                  <span className="text-slate-500 dark:text-slate-400">Accuracy</span>
                </div>
              </div>
            </div>
          </div>

          {/* Map Info */}
          <div className="absolute top-4 right-4 flex items-center gap-3 z-[1000]">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-2 text-sm border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                {tripsWithLocation.length} active
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
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Click a vehicle to focus on map</p>
          </div>

          <div className="p-3 space-y-2">
            {tripsWithLocation.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <Truck className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">No active vehicles</p>
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
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                          <Truck className="h-3 w-3 text-slate-400" />
                          {trip.vehicle?.plate_number}
                          <span className="text-slate-400 mx-1">•</span>
                          <User className="h-3 w-3 text-slate-400" />
                          {trip.driver?.name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {trip.destination}
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

                    {isSelected && current_location && (
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg px-2 py-1">
                        <Navigation className="h-3 w-3" />
                        {current_location.latitude.toFixed(5)}, {current_location.longitude.toFixed(5)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Auto-refresh every 10s</span>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}