// web/src/pages/gso/LiveTracking.jsx
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

const createVehicleIcon = (status, isSelected) => {
  const colors = {
    in_transit: '#22c55e',
    funds_issued: '#f59e0b',
    acknowledged: '#3b82f6',
  };
  const color = colors[status] || '#6b7280';
  const size = isSelected ? 32 : 28;
  
  return L.divIcon({
    className: 'custom-vehicle-icon',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size * 0.5}px;
        color: white;
        ${isSelected ? 'ring: 4px solid rgba(59,130,246,0.5);' : ''}
      ">
        🚗
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2],
  });
};

// ============================================
// MAP TILE LAYER CONFIGURATIONS
// ============================================

const MAP_TILES = {
  street: {
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  hybrid: {
    name: 'Hybrid',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  terrain: {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
  },
  dark: {
    name: 'Dark Mode',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
  },
};

// ============================================
// SATELLITE LAYER WITH LABELS (Hybrid)
// ============================================

// For true hybrid (satellite + labels), we use two layers
// Option 1: Esri Satellite with labels overlay
const HybridLayer = ({ opacity = 1 }) => {
  const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const labelsUrl = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';

  return (
    <>
      <TileLayer
        url={satelliteUrl}
        attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
        opacity={opacity}
      />
      <TileLayer
        url={labelsUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
        opacity={0.7}
      />
    </>
  );
};

// ============================================
// COMPONENT
// ============================================

export default function LiveTracking() {
  const navigate = useNavigate();
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [mapCenter, setMapCenter] = useState([8.5833, 124.6667]);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapType, setMapType] = useState('street');
  const [isMapTypeDropdownOpen, setIsMapTypeDropdownOpen] = useState(false);
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
        return response?.data?.data || [];
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

  // ============================================
  // HANDLERS
  // ============================================

  const handleTripSelect = (trip) => {
    setSelectedTrip(trip);
    if (trip.current_location) {
      setMapCenter([trip.current_location.latitude, trip.current_location.longitude]);
      setMapZoom(15);
    }
  };

  const handleFitBounds = () => {
    if (tripsWithLocation.length === 0) return;
    
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
    // Adjust zoom for satellite (needs higher zoom for detail)
    if (type === 'satellite' || type === 'hybrid') {
      setMapZoom(prev => Math.max(prev, 14));
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleTimeString('en-US', {
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
    };
    return labels[status] || status || 'Unknown';
  };

  const getStatusColor = (status) => {
    const colors = {
      in_transit: 'bg-green-500',
      funds_issued: 'bg-yellow-500',
      acknowledged: 'bg-blue-500',
    };
    return colors[status] || 'bg-slate-500';
  };

  const getMapTypeLabel = (type) => {
    return MAP_TILES[type]?.name || 'Street Map';
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
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📍</span>
            Live Tracking
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {tripsWithLocation.length} active vehicle{tripsWithLocation.length !== 1 ? 's' : ''} tracking
            {isFetching && <span className="ml-2 text-blue-500 text-xs">(Updating...)</span>}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {/* Map Type Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsMapTypeDropdownOpen(!isMapTypeDropdownOpen)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              {getMapTypeLabel(mapType)}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isMapTypeDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50 py-1">
                {Object.entries(MAP_TILES).map(([key, config]) => {
                  const isActive = mapType === key;
                  const emoji = {
                    street: '🗺️',
                    satellite: '🛰️',
                    hybrid: '🌍',
                    terrain: '⛰️',
                    dark: '🌙',
                  }[key] || '🗺️';
                  
                  return (
                    <button
                      key={key}
                      onClick={() => handleMapTypeChange(key)}
                      className={`
                        w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-3
                        ${isActive 
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }
                      `}
                    >
                      <span>{emoji}</span>
                      <span>{config.name}</span>
                      {isActive && (
                        <svg className="w-4 h-4 ml-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleFitBounds}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Fit All
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map - Takes most space */}
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
                <div className="text-6xl mb-4">🗺️</div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No active vehicles</p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
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
              {/* Render selected map tiles */}
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
                      icon={createVehicleIcon(trip.status, isSelected)}
                      eventHandlers={{
                        click: () => handleTripSelect(trip),
                      }}
                    >
                      <Popup>
                        <div className="p-2 min-w-[220px] max-w-[280px]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(trip.status)} animate-pulse`} />
                            <span className="font-semibold text-sm">{trip.ticket_number}</span>
                          </div>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Vehicle</span>
                              <span className="font-medium">{trip.vehicle?.plate_number}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Driver</span>
                              <span className="font-medium">{trip.driver?.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Destination</span>
                              <span className="font-medium truncate max-w-[120px]">{trip.destination}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Speed</span>
                              <span className="font-medium">{current_location.speed_kmh || 0} km/h</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Status</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(trip.status)} text-white`}>
                                {getStatusLabel(trip.status)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700">
                              Updated: {formatTime(current_location.recorded_at)}
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => navigate(`/gso/trip/${trip.trip_id}`)}
                              className="flex-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
                            >
                              View Trip
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTrip(trip);
                                setMapCenter([current_location.latitude, current_location.longitude]);
                                setMapZoom(16);
                              }}
                              className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
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

          {/* Map Legend - Overlay */}
          <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs z-[1000]">
            <div className="flex flex-col gap-1.5">
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
                  <span className="text-slate-500 dark:text-slate-400">Selected Route</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-transparent" />
                  <span className="text-slate-500 dark:text-slate-400">Accuracy</span>
                </div>
              </div>
            </div>
          </div>

          {/* Map Type & Trip Count */}
          <div className="absolute top-4 right-4 flex items-center gap-3 z-[1000]">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-sm flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400">Map:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {getMapTypeLabel(mapType)}
              </span>
            </div>
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {tripsWithLocation.length} active
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar - Trip List */}
        <div className="w-full lg:w-80 bg-white dark:bg-slate-800 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 overflow-y-auto">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold text-slate-800 dark:text-white">Active Vehicles</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Click a vehicle to focus on map</p>
          </div>

          <div className="p-3 space-y-2">
            {tripsWithLocation.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No active vehicles</p>
              </div>
            ) : (
              tripsWithLocation.map((trip) => {
                const isSelected = selectedTrip?.trip_id === trip.trip_id;
                const { current_location } = trip;

                return (
                  <div
                    key={trip.trip_id}
                    onClick={() => handleTripSelect(trip)}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all
                      ${isSelected 
                        ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(trip.status)} animate-pulse`} />
                          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white truncate">
                            {trip.ticket_number}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate">
                          {trip.vehicle?.plate_number} • {trip.driver?.name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                          {trip.destination}
                        </div>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {current_location?.speed_kmh || 0} km/h
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {formatTime(current_location?.recorded_at)}
                        </div>
                      </div>
                    </div>

                    {isSelected && current_location && (
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {current_location.latitude.toFixed(5)}, {current_location.longitude.toFixed(5)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500">
            Auto-refresh every 10 seconds
          </div>
        </div>
      </div>
    </div>
  );
}