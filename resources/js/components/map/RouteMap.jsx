// src/components/map/RouteMap.jsx
// ============================================
// CLEANED: Removed annoying guides, prevents double reload
// Simple map with markers and route line only
// ============================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { locationAPI } from '../../services/api';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ORIGIN_COORDS = { lat: 8.5731, lng: 124.4432 };
const ORIGIN_NAME = 'LGU Laguindingan';

const RouteMap = ({
  destination,
  coordinates,
  height = '250px',
  showRoute = true,
  className = '',
  interactive = false,
  onMapClick = null,
  showMarker = true,
  draggableMarker = false,
  onMarkerDrag = null,
  onRouteCalculated = null,
  vehicleId = null,
  roundTrip = true,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routingControlRef = useRef(null);
  const routeLineRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const markerRefs = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [apiError, setApiError] = useState(null);
  const isMountedRef = useRef(true);

  // Initialize map only once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    isMountedRef.current = true;

    mapInstanceRef.current = L.map(mapRef.current, {
      center: [ORIGIN_COORDS.lat, ORIGIN_COORDS.lng],
      zoom: 13,
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    setMapReady(true);
    setIsInitialized(true);

    // Scale control
    L.control.scale({
      position: 'bottomleft',
      metric: true,
      imperial: false,
    }).addTo(mapInstanceRef.current);

    // Click handler
    if (interactive && onMapClick) {
      mapInstanceRef.current.on('click', onMapClick);
    }

    return () => {
      isMountedRef.current = false;
      // Cleanup routing control
      if (routingControlRef.current) {
        try {
          mapInstanceRef.current?.removeControl(routingControlRef.current);
        } catch (e) {}
        routingControlRef.current = null;
      }
      // Cleanup markers
      markerRefs.current.forEach(m => {
        try { mapInstanceRef.current?.removeLayer(m); } catch (e) {}
      });
      markerRefs.current = [];
      originMarkerRef.current = null;
      destinationMarkerRef.current = null;
      // Remove map
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
      setMapReady(false);
      setIsInitialized(false);
    };
  }, []);

  // Update click handler when interactive changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (interactive && onMapClick) {
      mapInstanceRef.current.on('click', onMapClick);
    } else {
      mapInstanceRef.current.off('click');
    }
  }, [interactive, onMapClick]);

  // Calculate route via API
  const calculateRouteViaAPI = useCallback(async (coords) => {
    if (!coords || !coords.lat || !coords.lng || !isMountedRef.current) return null;

    setIsCalculating(true);
    setApiError(null);

    try {
      const destAddress = destination || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
      const params = {
        origin: ORIGIN_NAME,
        destination: destAddress,
        vehicle_id: vehicleId || '',
        round_trip: roundTrip ? 1 : 0,
        dest_lat: coords.lat,
        dest_lng: coords.lng,
      };

      const response = await locationAPI.calculateDistance(params);

      if (response?.data?.success && isMountedRef.current) {
        const data = response.data;
        const info = {
          distance: data.distance_km || 0,
          duration: data.duration_minutes || 0,
          distanceText: (data.distance_km || 0).toFixed(1) + ' km',
          durationText: (data.duration_minutes || 0) + ' mins',
          estimatedLiters: data.estimated_liters,
          estimatedCost: data.estimated_cost,
        };
        setRouteInfo(info);

        if (onRouteCalculated) {
          onRouteCalculated({
            distance_km: data.distance_km || 0,
            duration_minutes: data.duration_minutes || 0,
            estimated_liters: data.estimated_liters,
            estimated_cost: data.estimated_cost,
            fuel_efficiency_km_per_liter: data.fuel_efficiency_km_per_liter,
            fuel_price_per_liter: data.fuel_price_per_liter,
            fuel_type: data.fuel_type,
            is_round_trip: data.is_round_trip,
            one_way_distance_km: data.one_way_distance_km,
            round_trip_multiplier: data.round_trip_multiplier,
          });
        }
        return data;
      } else if (response?.data?.message) {
        setApiError(response.data.message);
      }
      return null;
    } catch (error) {
      if (isMountedRef.current) {
        setApiError(error.response?.data?.message || error.message || 'Failed to calculate');
      }
      return null;
    } finally {
      if (isMountedRef.current) setIsCalculating(false);
    }
  }, [destination, vehicleId, roundTrip, onRouteCalculated]);

  // Update route on map
  const updateRouteOnMap = useCallback((coords) => {
    if (!mapInstanceRef.current || !mapReady || !isMountedRef.current) return;
    if (!coords || !coords.lat || !coords.lng) return;

    // Remove old routing control if exists
    if (routingControlRef.current) {
      try {
        mapInstanceRef.current.removeControl(routingControlRef.current);
      } catch (e) {}
      routingControlRef.current = null;
    }

    // Remove old route line
    if (routeLineRef.current) {
      try {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
      } catch (e) {}
      routeLineRef.current = null;
    }

    // Remove old destination marker (keep origin)
    if (destinationMarkerRef.current) {
      try {
        mapInstanceRef.current.removeLayer(destinationMarkerRef.current);
      } catch (e) {}
      destinationMarkerRef.current = null;
    }

    const destLatLng = L.latLng(coords.lat, coords.lng);
    const originLatLng = L.latLng(ORIGIN_COORDS.lat, ORIGIN_COORDS.lng);

    // Origin marker (keep if exists)
    if (!originMarkerRef.current) {
      const originIcon = L.divIcon({
        className: 'origin-marker',
        html: `<div style="background:#22c55e;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;">📍</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      originMarkerRef.current = L.marker(originLatLng, { icon: originIcon, interactive: false })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>${ORIGIN_NAME}</b><br>${ORIGIN_COORDS.lat.toFixed(6)}, ${ORIGIN_COORDS.lng.toFixed(6)}`);
    }

    // Destination marker
    if (showMarker) {
      const destIcon = L.divIcon({
        className: 'destination-marker',
        html: `<div style="background:#2563eb;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(37,99,235,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(destLatLng, {
        icon: destIcon,
        draggable: draggableMarker,
        zIndexOffset: 1000,
      }).addTo(mapInstanceRef.current);

      destinationMarkerRef.current = marker;
      markerRefs.current.push(marker);

      const popupContent = `<b>${destination || 'Destination'}</b><br><span class="text-xs">${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}</span>`;
      marker.bindPopup(popupContent);

      // Drag handler
      if (draggableMarker && onMarkerDrag) {
        marker.on('dragend', async (e) => {
          const pos = marker.getLatLng();
          const newCoords = { lat: pos.lat, lng: pos.lng };
          if (onMarkerDrag) onMarkerDrag(newCoords);
          await calculateRouteViaAPI(newCoords);
          updateRouteOnMap(newCoords);
          marker.openPopup();
        });
      }
    }

    // Draw route
    if (showRoute) {
      try {
        routingControlRef.current = L.Routing.control({
          waypoints: [originLatLng, destLatLng],
          routeWhileDragging: false,
          showAlternatives: false,
          fitSelectedRoutes: false,
          show: false, // ✅ Hides the annoying summary panel
          lineOptions: {
            styles: [{ color: '#2563eb', weight: 4, opacity: 0.9 }],
            extendToWaypoints: true,
          },
          createMarker: () => null,
          addWaypoints: false,
          draggableWaypoints: false,
          geocoder: null,
          router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
          }),
        }).addTo(mapInstanceRef.current);

        routingControlRef.current.on('routesfound', (e) => {
          const route = e.routes?.[0];
          if (route?.summary && isMountedRef.current) {
            const dist = route.summary.totalDistance / 1000;
            const dur = Math.round(route.summary.totalTime / 60);
            setRouteInfo(prev => ({
              ...prev,
              distance: dist,
              duration: dur,
              distanceText: dist.toFixed(1) + ' km',
              durationText: dur + ' mins',
            }));
          }
        });

        routingControlRef.current.on('routingerror', () => {
          // Fallback: draw straight line
          routeLineRef.current = L.polyline([originLatLng, destLatLng], {
            color: '#2563eb',
            weight: 3,
            opacity: 0.6,
            dashArray: '6,6',
          }).addTo(mapInstanceRef.current);
        });

      } catch (error) {
        // Fallback: draw straight line
        routeLineRef.current = L.polyline([originLatLng, destLatLng], {
          color: '#2563eb',
          weight: 3,
          opacity: 0.6,
          dashArray: '6,6',
        }).addTo(mapInstanceRef.current);
      }
    }

    // Fit bounds
    const bounds = L.latLngBounds([originLatLng, destLatLng]);
    setTimeout(() => {
      if (mapInstanceRef.current && isMountedRef.current) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      }
    }, 300);
  }, [mapReady, showMarker, draggableMarker, destination, showRoute, calculateRouteViaAPI, onMarkerDrag]);

  // Initial route setup - runs once when coordinates are provided
  useEffect(() => {
    if (!mapReady || !isInitialized || !coordinates || !isMountedRef.current) return;

    // Use a ref to track if we've already initialized
    const initKey = `${coordinates.lat}_${coordinates.lng}`;
    if (window._routeMapInitialized === initKey) return;
    window._routeMapInitialized = initKey;

    const timer = setTimeout(() => {
      if (coordinates?.lat && coordinates?.lng && isMountedRef.current) {
        updateRouteOnMap(coordinates);
        calculateRouteViaAPI(coordinates);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [coordinates, mapReady, isInitialized]);

  // Update when coordinates change (but not on every render)
  useEffect(() => {
    if (!mapReady || !isInitialized || !coordinates || !isMountedRef.current) return;
    if (!coordinates.lat || !coordinates.lng) return;

    // Only update if coordinates actually changed
    const currentCoords = `${coordinates.lat}_${coordinates.lng}`;
    const lastCoords = window._lastRouteCoords;
    if (lastCoords === currentCoords) return;
    window._lastRouteCoords = currentCoords;

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        updateRouteOnMap(coordinates);
        calculateRouteViaAPI(coordinates);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [coordinates, mapReady, isInitialized]);

  // Invalidate size when height changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
    }
  }, [height]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapRef}
        className={`rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-700/60 ${className}`}
        style={{ height, width: '100%' }}
      />

      {/* ✅ Interactive hint - clean and simple */}
      {interactive && (
        <div className="absolute bottom-3 left-3 z-10 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none">
          {draggableMarker ? '📍 Drag marker to adjust destination' : '📍 Click map to place destination'}
        </div>
      )}

      {/* ✅ Route info - clean mini display */}
      {routeInfo && showRoute && (
        <div className="absolute bottom-3 right-3 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 border border-slate-200 dark:border-slate-700 pointer-events-none">
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-gray-400 text-[10px]">Dist</span>
              <div className="font-bold text-blue-600 dark:text-blue-400">{routeInfo.distanceText}</div>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-gray-400 text-[10px]">Time</span>
              <div className="font-bold text-blue-600 dark:text-blue-400">{routeInfo.durationText}</div>
            </div>
            {routeInfo.estimatedCost && (
              <>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                <div>
                  <span className="text-gray-400 text-[10px]">Fuel</span>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">₱{routeInfo.estimatedCost}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error indicator */}
      {apiError && (
        <div className="absolute top-3 right-3 z-10 bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-lg max-w-xs pointer-events-none">
          ⚠️ {apiError}
        </div>
      )}
    </div>
  );
};

export default RouteMap;