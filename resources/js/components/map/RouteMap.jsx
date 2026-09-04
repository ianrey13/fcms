// src/components/map/RouteMap.jsx

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

// ORS Origin (LGU Laguindingan - Poblacion)
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
  const markerRefs = useRef([]);
  const destinationMarkerRef = useRef(null);
  const originMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const coordDisplayRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(coordinates);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRouteUpdating, setIsRouteUpdating] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [mousePosition, setMousePosition] = useState(null);
  const [apiError, setApiError] = useState(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [ORIGIN_COORDS.lat, ORIGIN_COORDS.lng],
        zoom: 13,
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: true,
        attributionControl: true,
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      setMapReady(true);
      setIsInitialized(true);

      // Add scale control
      L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false,
      }).addTo(mapInstanceRef.current);

      // ✅ Add coordinate display on mouse move
      if (interactive) {
        mapInstanceRef.current.on('mousemove', (e) => {
          const lat = e.latlng.lat.toFixed(6);
          const lng = e.latlng.lng.toFixed(6);
          setMousePosition({ lat, lng });
        });

        mapInstanceRef.current.on('mouseout', () => {
          setMousePosition(null);
        });
      }

      // ✅ Add coordinate display control
      const coordControl = L.control({ position: 'bottomright' });
      coordControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-control-coordinates');
        div.innerHTML = `
          <div style="
            background: rgba(0,0,0,0.75);
            color: #fff;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255,255,255,0.1);
          ">
            <div id="coord-display" style="display: flex; gap: 12px; align-items: center;">
              <span>📍 <span id="coord-lat">${coordinates?.lat?.toFixed(6) || '---'}</span></span>
              <span>📌 <span id="coord-lng">${coordinates?.lng?.toFixed(6) || '---'}</span></span>
              <span style="color: #4ade80;">● Live</span>
            </div>
          </div>
        `;
        coordDisplayRef.current = div;
        return div;
      };
      coordControl.addTo(mapInstanceRef.current);
    }

    // Handle map click for interactive mode
    if (interactive && onMapClick && mapInstanceRef.current) {
      mapInstanceRef.current.off('click');
      mapInstanceRef.current.on('click', onMapClick);
    }

    return () => {
      if (mapInstanceRef.current && interactive && onMapClick) {
        mapInstanceRef.current.off('click', onMapClick);
      }
    };
  }, [interactive, onMapClick]);

  // Update coordinate display when coordinates change
  useEffect(() => {
    if (coordDisplayRef.current && coordinates) {
      const latDisplay = coordDisplayRef.current.querySelector('#coord-lat');
      const lngDisplay = coordDisplayRef.current.querySelector('#coord-lng');
      if (latDisplay) latDisplay.textContent = coordinates.lat?.toFixed(6) || '---';
      if (lngDisplay) lngDisplay.textContent = coordinates.lng?.toFixed(6) || '---';
    }
  }, [coordinates]);

  // Function to calculate route via backend API
  const calculateRouteViaAPI = useCallback(async (coords) => {
    if (!coords || !coords.lat || !coords.lng) {
      console.warn('No coordinates provided for route calculation');
      return null;
    }

    setIsCalculating(true);
    setApiError(null);
    
    try {
      const destinationAddress = destination || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
      
      const params = {
        origin: ORIGIN_NAME,
        destination: destinationAddress,
        vehicle_id: vehicleId || '',
        round_trip: roundTrip ? 1 : 0,
        dest_lat: coords.lat,
        dest_lng: coords.lng,
      };

      console.log('Calling locationAPI.calculateDistance with params:', params);

      const response = await locationAPI.calculateDistance(params);

      console.log('API Response:', response);

      if (response && response.data) {
        const data = response.data;
        
        if (data.success) {
          setRouteInfo({
            distance: data.distance_km || 0,
            duration: data.duration_minutes || 0,
            distanceText: (data.distance_km || 0).toFixed(1) + ' km',
            durationText: (data.duration_minutes || 0) + ' mins',
            estimatedLiters: data.estimated_liters,
            estimatedCost: data.estimated_cost,
          });

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
        } else {
          console.error('API Error:', data.message);
          setApiError(data.message || 'Failed to calculate distance');
          return null;
        }
      } else {
        console.error('Invalid API response:', response);
        setApiError('Invalid response from server');
        return null;
      }
    } catch (error) {
      console.error('API call failed:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        const errorMessage = error.response.data?.message || 'Server error';
        setApiError(errorMessage);
      } else if (error.request) {
        console.error('No response received');
        setApiError('No response from server. Please check your connection.');
      } else {
        console.error('Request error:', error.message);
        setApiError(error.message);
      }
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [destination, vehicleId, roundTrip, onRouteCalculated]);

  // Function to update route on map with OSRM
  const updateRouteOnMap = useCallback((coords) => {
    if (!mapInstanceRef.current || !mapReady) {
      console.warn('Map not ready for route update');
      return;
    }

    if (!coords || !coords.lat || !coords.lng) {
      console.warn('No coordinates for route update');
      return;
    }

    setIsRouteUpdating(true);

    // Clear existing route
    if (routingControlRef.current) {
      try {
        mapInstanceRef.current.removeControl(routingControlRef.current);
      } catch (e) {}
      routingControlRef.current = null;
    }

    // Clear existing route line
    if (routeLineRef.current) {
      try {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
      } catch (e) {}
      routeLineRef.current = null;
    }

    // Clear existing markers except origin
    markerRefs.current.forEach(marker => {
      try {
        if (marker && marker !== originMarkerRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      } catch (e) {}
    });
    markerRefs.current = [];
    destinationMarkerRef.current = null;

    const destLatLng = L.latLng(coords.lat, coords.lng);
    const originLatLng = L.latLng(ORIGIN_COORDS.lat, ORIGIN_COORDS.lng);

    // Add origin marker if not exists
    if (!originMarkerRef.current) {
      const originIcon = L.divIcon({
        className: 'custom-marker origin-marker',
        html: `
          <div style="
            background: #22c55e;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="font-size: 12px;">📍</span>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      originMarkerRef.current = L.marker(originLatLng, {
        icon: originIcon,
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(mapInstanceRef.current);
      
      // ✅ Add popup with coordinates
      originMarkerRef.current.bindPopup(`
        <b>${ORIGIN_NAME}</b><br>
        <span class="text-xs text-gray-500">Lat: ${ORIGIN_COORDS.lat.toFixed(6)}</span><br>
        <span class="text-xs text-gray-500">Lng: ${ORIGIN_COORDS.lng.toFixed(6)}</span>
      `);
      markerRefs.current.push(originMarkerRef.current);
    }

    // Add destination marker if enabled
    if (showMarker) {
      const destIcon = L.divIcon({
        className: 'custom-marker destination-marker',
        html: `
          <div style="
            background: #2563eb;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 12px rgba(37, 99, 235, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
          ">
            <span style="font-size: 16px;">📍</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker(destLatLng, {
        icon: destIcon,
        draggable: draggableMarker,
        zIndexOffset: 2000,
      }).addTo(mapInstanceRef.current);

      markerRefs.current.push(marker);
      destinationMarkerRef.current = marker;

      // ✅ Add popup with coordinates
      const popupContent = `
        <div class="p-2">
          <b class="text-blue-600">${destination || 'Destination'}</b>
          <br>
          <span class="text-xs text-gray-500">
            Lat: ${coords.lat.toFixed(6)}
            <br>
            Lng: ${coords.lng.toFixed(6)}
          </span>
          <br>
          <span class="text-xs text-gray-400">
            Distance: ${routeInfo?.distanceText || 'N/A'}
          </span>
        </div>
      `;
      marker.bindPopup(popupContent);

      // Handle drag events
      if (draggableMarker && onMarkerDrag) {
        marker.on('drag', (e) => {
          const pos = marker.getLatLng();
          // Update popup content while dragging
          marker.setPopupContent(`
            <div class="p-2">
              <b class="text-blue-600">${destination || 'Destination'}</b>
              <br>
              <span class="text-xs text-gray-500">
                Lat: ${pos.lat.toFixed(6)}
                <br>
                Lng: ${pos.lng.toFixed(6)}
              </span>
            </div>
          `);
          
          // Show temporary line while dragging
          drawTemporaryLine(originLatLng, pos);
        });

        marker.on('dragend', async (e) => {
          const pos = marker.getLatLng();
          const newCoords = { lat: pos.lat, lng: pos.lng };
          setCurrentCoords(newCoords);
          
          console.log('Marker dragged to new coordinates:', newCoords);
          
          // Call the callback with new coordinates
          if (onMarkerDrag) {
            onMarkerDrag(newCoords);
          }
          
          // 1. Calculate route via API (gets distance, fuel, cost)
          await calculateRouteViaAPI(newCoords);
          
          // 2. Update the route line on map using OSRM
          updateRouteOnMap(newCoords);
          
          // Open popup after drag
          marker.openPopup();
        });
      }

      // Open popup on click
      marker.on('click', () => {
        marker.openPopup();
      });
    }

    // Add route using Leaflet Routing Machine (OSRM)
    if (showRoute) {
      try {
        routingControlRef.current = L.Routing.control({
          waypoints: [originLatLng, destLatLng],
          routeWhileDragging: false,
          showAlternatives: false,
          fitSelectedRoutes: false,
          show: true,
          lineOptions: {
            styles: [{ 
              color: '#2563eb', 
              weight: 5, 
              opacity: 0.9,
              dashArray: null,
            }],
            extendToWaypoints: true,
            missingRouteTolerance: 0,
          },
          altLineOptions: {
            styles: [{ 
              color: '#94a3b8', 
              weight: 3, 
              opacity: 0.5, 
              dashArray: '8,8' 
            }],
          },
          createMarker: (i, waypoint, n) => {
            return null;
          },
          addWaypoints: false,
          draggableWaypoints: false,
          geocoder: null,
          router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
          }),
          summaryTemplate: `
            <div class="routing-summary p-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm">
              <div class="font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                <span>🚗</span> Route Summary
              </div>
              <div class="space-y-1.5">
                <div class="flex justify-between items-center">
                  <span class="text-gray-500 dark:text-gray-400">Distance:</span>
                  <span class="font-bold text-gray-800 dark:text-white">{distance}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-500 dark:text-gray-400">Duration:</span>
                  <span class="font-bold text-gray-800 dark:text-white">{time}</span>
                </div>
              </div>
            </div>
          `,
        }).addTo(mapInstanceRef.current);

        // Listen for route calculation
        routingControlRef.current.on('routesfound', (e) => {
          const routes = e.routes;
          if (routes && routes.length > 0) {
            const route = routes[0];
            const distance = route.summary.totalDistance / 1000;
            const duration = Math.round(route.summary.totalTime / 60);
            
            setRouteInfo(prev => ({
              ...prev,
              distance: distance,
              duration: duration,
              distanceText: distance.toFixed(1) + ' km',
              durationText: duration + ' mins',
            }));
            
            console.log('OSRM Route calculated:', { distance, duration });
          }
          setIsRouteUpdating(false);
        });

        // Handle routing errors
        routingControlRef.current.on('routingerror', (e) => {
          console.error('Routing error:', e);
          drawStraightLine(originLatLng, destLatLng);
          setIsRouteUpdating(false);
        });

      } catch (error) {
        console.error('Error creating route:', error);
        drawStraightLine(originLatLng, destLatLng);
        setIsRouteUpdating(false);
      }
    }

    // Fit bounds to show both points with padding
    const bounds = L.latLngBounds([originLatLng, destLatLng]);
    
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(bounds, { 
          padding: [80, 80],
          maxZoom: 14,
        });
      }
    }, 400);
  }, [mapReady, showMarker, draggableMarker, destination, showRoute, calculateRouteViaAPI, onMarkerDrag]);

  // Helper function to draw temporary line during drag
  const drawTemporaryLine = (origin, destination) => {
    if (routeLineRef.current) {
      try {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
      } catch (e) {}
      routeLineRef.current = null;
    }

    routeLineRef.current = L.polyline([origin, destination], {
      color: '#2563eb',
      weight: 4,
      opacity: 0.5,
      dashArray: '5,10',
    }).addTo(mapInstanceRef.current);
  };

  // Helper function to draw a straight line as fallback
  const drawStraightLine = (origin, destination) => {
    if (routeLineRef.current) {
      try {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
      } catch (e) {}
      routeLineRef.current = null;
    }

    routeLineRef.current = L.polyline([origin, destination], {
      color: '#2563eb',
      weight: 4,
      opacity: 0.7,
      dashArray: '8,8',
    }).addTo(mapInstanceRef.current);
  };

  // Update route when coordinates change from parent
  useEffect(() => {
    if (!mapReady || !isInitialized) return;
    
    if (coordinates && coordinates.lat && coordinates.lng) {
      console.log('Parent coordinates updated:', coordinates);
      setCurrentCoords(coordinates);
      
      // Update the route on map
      updateRouteOnMap(coordinates);
      
      // Calculate route via API for estimates
      calculateRouteViaAPI(coordinates);
    }
  }, [coordinates, mapReady, isInitialized, updateRouteOnMap, calculateRouteViaAPI]);

  // Initial route setup
  useEffect(() => {
    if (!mapReady || !isInitialized || !coordinates) return;
    
    const timer = setTimeout(() => {
      if (coordinates && coordinates.lat && coordinates.lng) {
        console.log('Initial route setup with:', coordinates);
        setCurrentCoords(coordinates);
        updateRouteOnMap(coordinates);
        calculateRouteViaAPI(coordinates);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [mapReady, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (routingControlRef.current) {
        try {
          mapInstanceRef.current?.removeControl(routingControlRef.current);
        } catch (e) {}
        routingControlRef.current = null;
      }
      if (routeLineRef.current) {
        try {
          mapInstanceRef.current?.removeLayer(routeLineRef.current);
        } catch (e) {}
        routeLineRef.current = null;
      }
      markerRefs.current.forEach(marker => {
        try {
          mapInstanceRef.current?.removeLayer(marker);
        } catch (e) {}
      });
      markerRefs.current = [];
      destinationMarkerRef.current = null;
      originMarkerRef.current = null;
      
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Invalidate map size when container changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 200);
    }
  }, [height]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapRef} 
        className={`rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-700/60 ${className}`}
        style={{ height, width: '100%' }}
      />
      
      {/* ✅ Mouse position coordinates display */}
      {interactive && mousePosition && (
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-10 bg-black/75 text-white px-4 py-1.5 rounded-lg text-xs font-mono pointer-events-none">
          <span>📍 {mousePosition.lat}, {mousePosition.lng}</span>
        </div>
      )}

      {interactive && (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className={`animate-pulse ${isCalculating || isRouteUpdating ? 'text-yellow-400' : 'text-green-400'}`}>
              {isCalculating || isRouteUpdating ? '⏳' : '🟢'}
            </span>
            {isCalculating || isRouteUpdating 
              ? 'Updating route...' 
              : draggableMarker 
                ? 'Drag marker to adjust destination' 
                : 'Click map to place destination'}
          </div>
        </div>
      )}
      
      {apiError && (
        <div className="absolute top-3 right-3 z-10 bg-red-500/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg max-w-xs pointer-events-none">
          <span className="font-bold">⚠️ Error:</span> {apiError}
        </div>
      )}
      
      {routeInfo && showRoute && (
        <div className="absolute bottom-3 right-3 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-slate-200 dark:border-slate-700 pointer-events-none">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Distance</span>
              <div className="font-bold text-blue-600 dark:text-blue-400">
                {routeInfo.distanceText}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-gray-500 dark:text-gray-400">Duration</span>
              <div className="font-bold text-blue-600 dark:text-blue-400">
                {routeInfo.durationText}
              </div>
            </div>
            {routeInfo.estimatedLiters && (
              <>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Fuel</span>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    {routeInfo.estimatedLiters} L
                  </div>
                </div>
              </>
            )}
            {routeInfo.estimatedCost && (
              <>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cost</span>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₱{routeInfo.estimatedCost}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteMap;