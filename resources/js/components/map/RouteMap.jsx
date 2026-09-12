// src/components/map/RouteMap.jsx
// ============================================
// MULTI-WAYPOINT: Supports multiple stops with drag
// Origin → Stop 1 → Stop 2 → ... → Origin (round trip)
// ============================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ORIGIN_COORDS = { lat: 8.5731, lng: 124.4432 };
const ORIGIN_NAME = 'Laguindingan Municipal Hall';

// ============================================
// ICON CREATORS
// ============================================

const createOriginIcon = () => L.divIcon({
    className: 'origin-marker',
    html: `<div style="
        background: #22c55e;
        width: 32px; height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(34,197,94,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
    ">🏠</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
});

const createStopIcon = (index, total) => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#ef4444'];
    const color = colors[index % colors.length];
    
    return L.divIcon({
        className: 'stop-marker',
        html: `<div style="
            background: ${color};
            width: 28px; height: 28px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 12px ${color}66;
            display: flex; align-items: center; justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
            cursor: grab;
        ">${index + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
    });
};

// ============================================
// MAIN COMPONENT
// ============================================

const RouteMap = ({
    waypoints = [],           // Array of { lat, lng, name }
    origin = ORIGIN_COORDS,   // Origin coords
    height = '350px',
    showRoute = true,
    className = '',
    interactive = false,
    onMapClick = null,
    draggableMarker = true,
    onWaypointDragStart = null,
    onWaypointDrag = null,
    onWaypointDragEnd = null,
    roundTrip = true,
    // Legacy support (single coordinates)
    coordinates = null,
    destination = null,
}) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const routingControlRef = useRef(null);
    const routeLineRef = useRef(null);
    const originMarkerRef = useRef(null);
    const stopMarkersRef = useRef([]);
    const [mapReady, setMapReady] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const isMountedRef = useRef(true);

    // ✅ Normalize waypoints (support legacy single coordinate)
    const normalizedWaypoints = React.useMemo(() => {
        if (waypoints && waypoints.length > 0) return waypoints;
        if (coordinates) return [{ ...coordinates, name: destination || 'Destination' }];
        return [];
    }, [waypoints, coordinates, destination]);

    // ============================================
    // INITIALIZE MAP (once)
    // ============================================
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        isMountedRef.current = true;

        mapInstanceRef.current = L.map(mapRef.current, {
            center: [origin.lat || ORIGIN_COORDS.lat, origin.lng || ORIGIN_COORDS.lng],
            zoom: 12,
            zoomControl: true,
            dragging: true,
            scrollWheelZoom: true,
            attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(mapInstanceRef.current);

        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
        }).addTo(mapInstanceRef.current);

        setMapReady(true);
        setIsInitialized(true);

        return () => {
            isMountedRef.current = false;
            if (routingControlRef.current) {
                try { mapInstanceRef.current?.removeControl(routingControlRef.current); } catch (e) {}
                routingControlRef.current = null;
            }
            if (routeLineRef.current) {
                try { mapInstanceRef.current?.removeLayer(routeLineRef.current); } catch (e) {}
                routeLineRef.current = null;
            }
            stopMarkersRef.current.forEach(m => {
                try { mapInstanceRef.current?.removeLayer(m); } catch (e) {}
            });
            stopMarkersRef.current = [];
            if (mapInstanceRef.current) {
                try { mapInstanceRef.current.remove(); } catch (e) {}
                mapInstanceRef.current = null;
            }
            setMapReady(false);
            setIsInitialized(false);
        };
    }, []);

    // ============================================
    // MAP CLICK HANDLER
    // ============================================
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        const map = mapInstanceRef.current;

        if (interactive && onMapClick) {
            map.on('click', onMapClick);
        } else {
            map.off('click');
        }

        return () => {
            try { map.off('click'); } catch (e) {}
        };
    }, [interactive, onMapClick]);

    // ============================================
    // DRAW ORIGIN MARKER (once)
    // ============================================
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current || originMarkerRef.current) return;

        const originLatLng = L.latLng(origin.lat || ORIGIN_COORDS.lat, origin.lng || ORIGIN_COORDS.lng);
        const marker = L.marker(originLatLng, {
            icon: createOriginIcon(),
            interactive: true,
            draggable: false,
            zIndexOffset: 500,
        })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<b>🏠 ${origin.name || ORIGIN_NAME}</b><br><span style="font-size:11px;color:#666">Starting point</span>`);

        originMarkerRef.current = marker;
    }, [mapReady, origin]);

    // ============================================
    // UPDATE ROUTE & STOP MARKERS
    // ============================================
    const updateRouteAndMarkers = useCallback(() => {
        if (!mapInstanceRef.current || !mapReady || !isMountedRef.current) return;

        const map = mapInstanceRef.current;
        const originLatLng = L.latLng(origin.lat || ORIGIN_COORDS.lat, origin.lng || ORIGIN_COORDS.lng);

        // ✅ Remove existing stop markers
        stopMarkersRef.current.forEach(m => {
            try { map.removeLayer(m); } catch (e) {}
        });
        stopMarkersRef.current = [];

        // ✅ Remove old route
        if (routingControlRef.current) {
            try { map.removeControl(routingControlRef.current); } catch (e) {}
            routingControlRef.current = null;
        }
        if (routeLineRef.current) {
            try { map.removeLayer(routeLineRef.current); } catch (e) {}
            routeLineRef.current = null;
        }

        // ✅ Add stop markers
        const validStops = normalizedWaypoints.filter(w => w && w.lat && w.lng);
        
        validStops.forEach((wp, index) => {
            const latlng = L.latLng(wp.lat, wp.lng);
            const marker = L.marker(latlng, {
                icon: createStopIcon(index, validStops.length),
                draggable: draggableMarker,
                zIndexOffset: 1000 + index,
            }).addTo(map);

            marker.bindPopup(`
                <div style="min-width:180px;">
                    <b style="font-size:13px;">Stop ${index + 1}</b><br>
                    <span style="font-size:12px;color:#333;">${wp.name || 'Unnamed'}</span><br>
                    <span style="font-size:10px;color:#999;font-family:monospace;">
                        ${wp.lat.toFixed(6)}, ${wp.lng.toFixed(6)}
                    </span>
                </div>
            `);

            // ✅ Drag handlers
            if (draggableMarker) {
                marker.on('dragstart', () => {
                    if (onWaypointDragStart) onWaypointDragStart(index);
                });

                marker.on('drag', () => {
                    const pos = marker.getLatLng();
                    if (onWaypointDrag) {
                        onWaypointDrag(index, { lat: pos.lat, lng: pos.lng });
                    }
                });

                marker.on('dragend', () => {
                    const pos = marker.getLatLng();
                    if (onWaypointDragEnd) {
                        onWaypointDragEnd(index, { lat: pos.lat, lng: pos.lng });
                    }
                });
            }

            stopMarkersRef.current.push(marker);
        });

        // ✅ Draw route with all waypoints
        if (showRoute && validStops.length > 0) {
            const allPoints = [
                originLatLng,
                ...validStops.map(w => L.latLng(w.lat, w.lng)),
            ];

            // Add return to origin if round trip
            if (roundTrip) {
                allPoints.push(originLatLng);
            }

            try {
                routingControlRef.current = L.Routing.control({
                    waypoints: allPoints,
                    routeWhileDragging: false,
                    showAlternatives: false,
                    fitSelectedRoutes: false,
                    show: false,
                    lineOptions: {
                        styles: [
                            { color: '#2563eb', weight: 5, opacity: 0.9 },
                        ],
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
                }).addTo(map);
            } catch (error) {
                // Fallback: straight lines
                routeLineRef.current = L.polyline(allPoints, {
                    color: '#2563eb',
                    weight: 3,
                    opacity: 0.6,
                    dashArray: '6,6',
                }).addTo(map);
            }
        }

        // ✅ Fit bounds to include everything
        if (validStops.length > 0) {
            const boundsPoints = [originLatLng, ...validStops.map(w => L.latLng(w.lat, w.lng))];
            const bounds = L.latLngBounds(boundsPoints);
            setTimeout(() => {
                if (mapInstanceRef.current && isMountedRef.current) {
                    mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
                }
            }, 200);
        }
    }, [mapReady, normalizedWaypoints, origin, showRoute, roundTrip, draggableMarker, onWaypointDragStart, onWaypointDrag, onWaypointDragEnd]);

    // ============================================
    // TRIGGER UPDATE ON WAYPOINT CHANGE
    // ============================================
    useEffect(() => {
        if (!mapReady || !isInitialized) return;

        const timer = setTimeout(() => {
            if (isMountedRef.current) {
                updateRouteAndMarkers();
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [normalizedWaypoints, mapReady, isInitialized, updateRouteAndMarkers]);

    // ============================================
    // INVALIDATE SIZE
    // ============================================
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

            {/* Legend */}
            {normalizedWaypoints.length > 0 && (
                <div className="absolute top-3 left-3 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 border border-slate-200 dark:border-slate-700 pointer-events-none">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                            <span className="text-slate-600 dark:text-slate-400">Origin</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <span className="text-slate-600 dark:text-slate-400">{normalizedWaypoints.length} Stop{normalizedWaypoints.length !== 1 ? 's' : ''}</span>
                        </span>
                    </div>
                </div>
            )}

            {/* Interactive hint */}
            {interactive && (
                <div className="absolute bottom-3 left-3 z-10 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none">
                    {draggableMarker ? '📍 Click map to add stop • Drag markers to adjust' : '📍 Click map to add stop'}
                </div>
            )}
        </div>
    );
};

export default RouteMap;