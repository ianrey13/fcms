// src/components/gso/LiveTripTracker.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { gpsAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import echo from '../../services/echo';
import { cn } from '@/lib/utils';
import { 
  Focus,
  Crosshair,
  X,
  Move,
  Zap,
  Fuel,
  Clock,
  MapPin,
  Truck,
  User,
  Satellite,
  Plus,
  Minus,
} from 'lucide-react';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const trackerStyleSheet = document.createElement("style");
trackerStyleSheet.textContent = `
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  .custom-vehicle-icon:hover {
    filter: brightness(1.1);
  }
`;
document.head.appendChild(trackerStyleSheet);

// Create vehicle icon for focused marker
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
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) ${isFocused ? 'scale(1.15)' : isSelected ? 'scale(1.08)' : 'scale(1)'};
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
          color: white;
          z-index: 1;
          transition: all 0.3s ease;
          ${!isOnline ? 'opacity: 0.5;' : ''}
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
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

// ============================================
// 🎯 LIVE TRIP TRACKER COMPONENT
// ============================================

const LiveTripTracker = ({ trip, onClose, isOpen, allTrips }) => {
  const [tripStats, setTripStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTracking] = useState(true);
  const [mapCenter, setMapCenter] = useState([8.5833, 124.6667]);
  const [mapZoom, setMapZoom] = useState(15);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const intervalRef = useRef(null);
  const [followMode, setFollowMode] = useState(true);

  // ✅ Refs to keep latest values inside stable callbacks
  const followModeRef = useRef(true);
  const mapZoomRef = useRef(15);

  useEffect(() => { followModeRef.current = followMode; }, [followMode]);
  useEffect(() => { mapZoomRef.current = mapZoom; }, [mapZoom]);

  // ============================================
  // FETCH TRIP STATS (stable — no followMode/mapZoom in deps)
  // ============================================

  const fetchTripStats = useCallback(async () => {
    if (!trip?.trip_id) return;

    try {
      const response = await gpsAPI.getTripStats(trip.trip_id);
      const data = response.data?.data;

      if (data) {
        setTripStats(data);

        // ✅ Use refs for follow/zoom so callback identity is stable
        if (data.latest_location && followModeRef.current) {
          const { latitude, longitude } = data.latest_location;
          setMapCenter([latitude, longitude]);
          if (mapRef.current) {
            mapRef.current.setView([latitude, longitude], mapZoomRef.current);
          }
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch trip stats:', error);
      toast.error('Failed to load tracking data');
    } finally {
      setLoading(false);
    }
  }, [trip?.trip_id]);

  // ============================================
  // EFFECT 1 — Initial fetch + polling interval
  // Deps: trip_id, isTracking only
  // ============================================

  useEffect(() => {
    if (!trip?.trip_id || !isOpen) return;

    console.log('🚀 Starting polling for trip:', trip.trip_id);
    fetchTripStats();

    intervalRef.current = setInterval(() => {
      if (isTracking) {
        fetchTripStats();
      }
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [trip?.trip_id, isOpen, isTracking, fetchTripStats]);

  // ============================================
  // EFFECT 2 — WebSocket subscription (stable)
  // Deps: trip_id, isOpen only — NOT followMode, mapZoom
  //
  // ✅ CRITICAL: pass the handler to stopListening so we remove ONLY our
  // listener — NOT the one LiveTracking.jsx registered on the same channel.
  // ============================================

  useEffect(() => {
    if (!trip?.trip_id || !isOpen) return;

    let channel = null;

    // ✅ Named handler — required for targeted stopListening
    const locationHandler = (data) => {
      if (data.trip_id !== trip.trip_id) return;

      console.log('📍 WS update for focused trip:', data.trip_id);

      // ✅ Use refs for follow/zoom so we don't need them in deps
      if (markerRef.current && data.latitude && data.longitude) {
        markerRef.current.setLatLng([data.latitude, data.longitude]);
      }

      if (followModeRef.current && mapRef.current && data.latitude && data.longitude) {
        mapRef.current.setView([data.latitude, data.longitude], mapZoomRef.current);
      }

      // Refresh stats panel
      fetchTripStats();
    };

    try {
      if (echo.connector && echo.connector.pusher) {
        channel = echo.channel('gso-live-tracking');
        channel.listen('.location.updated', locationHandler);

        channel.subscribed(() => {
          console.log('✅ LiveTripTracker subscribed to gso-live-tracking');
        });
      } else {
        console.warn('⚠️ Echo connector not available for WebSocket');
      }
    } catch (error) {
      console.error('❌ WebSocket setup error:', error);
    }

    return () => {
      console.log('🧹 Cleaning up WS for trip:', trip.trip_id);
      if (channel) {
        try {
          // ✅ Pass handler to remove ONLY our listener
          channel.stopListening('.location.updated', locationHandler);
        } catch (e) {
          console.warn('⚠️ WebSocket cleanup error:', e);
        }
      }
    };
  }, [trip?.trip_id, isOpen, fetchTripStats]);

  // ============================================
  // EFFECT 3 — Follow mode recenters map on demand
  // Only runs when user toggles follow or tripStats updates the location
  // ============================================

  useEffect(() => {
    if (!followMode) return;
    if (!tripStats?.latest_location) return;

    const { latitude, longitude } = tripStats.latest_location;
    if (!latitude || !longitude) return;

    setMapCenter([latitude, longitude]);
    if (mapRef.current) {
      mapRef.current.setView([latitude, longitude], mapZoomRef.current);
    }
  }, [followMode, tripStats?.latest_location?.latitude, tripStats?.latest_location?.longitude]);

  // ============================================
  // HANDLERS
  // ============================================

  const toggleFollow = () => {
    setFollowMode(prev => {
      const next = !prev;
      if (next && tripStats?.latest_location) {
        const { latitude, longitude } = tripStats.latest_location;
        setMapCenter([latitude, longitude]);
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], mapZoomRef.current);
        }
      }
      return next;
    });
  };

  const handleZoomIn = () => {
    const newZoom = mapZoom === 18 ? 14 : mapZoom + 1;
    setMapZoom(newZoom);
    mapZoomRef.current = newZoom;
    if (mapRef.current) mapRef.current.setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = mapZoom === 4 ? 14 : mapZoom - 1;
    setMapZoom(newZoom);
    mapZoomRef.current = newZoom;
    if (mapRef.current) mapRef.current.setZoom(newZoom);
  };

  if (!isOpen || !trip) return null;

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading tracking data...</p>
          <p className="text-xs text-slate-400 mt-2">Trip: {trip?.ticket_number}</p>
        </div>
      </div>
    );
  }

  const hasLocation = tripStats?.latest_location && 
    tripStats.latest_location.latitude && 
    tripStats.latest_location.longitude;

  if (!hasLocation) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <Satellite className="h-10 w-10 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">No location data</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Waiting for first GPS ping...
          </p>
          <p className="text-xs text-blue-500 mt-2">● Live tracking starting...</p>
          <button
            onClick={fetchTripStats}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10">
            <Focus className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {trip?.ticket_number || 'Vehicle'}
              <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full">
                ● Live
              </span>
              <span className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded-full">
                {tripStats?.ping_count || 0} pings
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {trip?.destination || 'No destination'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                {trip?.vehicle?.plate_number || 'N/A'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {trip?.driver?.name || 'N/A'}
              </span>
              <span className="text-emerald-500 text-[10px] font-medium ml-auto">
                {followMode ? '● Following' : '○ Free'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFollow}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5",
              followMode 
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <Crosshair className="h-3.5 w-3.5" />
            {followMode ? 'Following' : 'Free'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-700/60">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Move className="h-3 w-3" /> Distance
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {tripStats?.total_distance_km?.toFixed(2) || '0.00'} km
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Zap className="h-3 w-3" /> Speed
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {tripStats?.current_speed_kmh?.toFixed(0) || '0'} km/h
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3" /> Duration
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {tripStats?.duration_minutes?.toFixed(0) || '0'} min
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="relative h-[400px] md:h-[500px]">
        <MapContainer
          ref={mapRef}
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <ZoomControl position="bottomright" />

          {tripStats?.route_points && tripStats.route_points.length > 1 && (
            <Polyline
              positions={tripStats.route_points.map(p => [p.latitude, p.longitude])}
              color="#3b82f6"
              weight={4}
              opacity={0.8}
              smoothFactor={1}
            />
          )}

          {tripStats?.route_points && tripStats.route_points.length > 0 && (
            <Marker 
              position={[
                tripStats.route_points[0].latitude, 
                tripStats.route_points[0].longitude
              ]}
            >
              <Popup>
                <div className="p-1">
                  <p className="text-xs font-semibold text-green-600">🟢 Start Point</p>
                  <p className="text-xs text-slate-500">
                    {new Date(tripStats.route_points[0].recorded_at).toLocaleTimeString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {hasLocation && (
            <Marker
              position={[
                tripStats.latest_location.latitude,
                tripStats.latest_location.longitude
              ]}
              icon={createVehicleIcon(trip?.status, true, true, true)}
              ref={markerRef}
            >
              <Popup>
                <div className="p-2 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-semibold text-sm">{trip?.ticket_number}</span>
                    <span className="bg-emerald-500/20 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full ml-auto">
                      ● Live
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Speed:</span>
                      <span className="font-medium">{tripStats?.current_speed_kmh?.toFixed(0) || 0} km/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Distance:</span>
                      <span className="font-medium">{tripStats?.total_distance_km?.toFixed(2) || 0} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fuel:</span>
                      <span className="font-medium text-amber-600">{tripStats?.estimated_fuel_liters?.toFixed(2) || 0} L</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Duration:</span>
                      <span className="font-medium">{tripStats?.duration_minutes?.toFixed(0) || 0} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pings:</span>
                      <span className="font-medium">{tripStats?.ping_count || 0}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 border-t border-slate-200 pt-1">
                    Updated: {formatTime(tripStats?.latest_location?.recorded_at)}
                    <span className="text-emerald-500 ml-2">● Live</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {hasLocation && tripStats.latest_location.accuracy_meters && 
            tripStats.latest_location.accuracy_meters < 100 && (
            <Circle
              center={[
                tripStats.latest_location.latitude,
                tripStats.latest_location.longitude
              ]}
              radius={tripStats.latest_location.accuracy_meters}
              color="#3b82f6"
              fillColor="#3b82f6"
              fillOpacity={0.1}
            />
          )}
        </MapContainer>

        {/* Controls Overlay */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
          <button
            onClick={toggleFollow}
            className={cn(
              "bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
              followMode ? "text-blue-500" : "text-slate-400"
            )}
            title={followMode ? "Following vehicle" : "Free movement"}
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            onClick={handleZoomIn}
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Zoom in"
          >
            <Plus className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={handleZoomOut}
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Zoom out"
          >
            <Minus className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-xs z-[1000] flex items-center gap-3 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-slate-600 dark:text-slate-300">
              {isTracking ? 'Live' : 'Paused'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-500">
            {tripStats?.ping_count || 0} pings
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-500">
            {followMode ? 'Following' : 'Free'}
          </span>
        </div>

        {/* Trip Info Overlay */}
        <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-xs z-[1000] border border-slate-200/60 dark:border-slate-700/60">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Trip {trip?.ticket_number}
          </span>
          <span className="ml-2 text-emerald-500">● Live</span>
        </div>
      </div>

      {/* Bottom Stats Bar */}
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="grid grid-cols-6 gap-2">
          <div className="text-center">
            <p className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pings</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{tripStats?.ping_count || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Max Speed</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{tripStats?.max_speed_kmh?.toFixed(0) || 0} km/h</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Speed</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{tripStats?.avg_speed_kmh?.toFixed(0) || 0} km/h</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Distance</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{tripStats?.total_distance_km?.toFixed(2) || 0} km</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fuel</p>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{tripStats?.estimated_fuel_liters?.toFixed(2) || 0} L</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{tripStats?.duration_minutes?.toFixed(0) || 0} min</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTripTracker;