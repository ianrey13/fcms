// src/pages/gso/GsoDashboard.jsx
import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { gsoAPI, vehicleAPI, gpsAPI, departmentAPI } from "../../services/api";
import {
    MapContainer,
    TileLayer,
    Marker,
    ZoomControl,
    Polyline,
    useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
    Car,
    CheckCircle,
    AlertTriangle,
    Wrench,
    RefreshCw,
    MapPin,
    Search,
    Activity,
    PlusCircle,
    Fuel,
    Clock,
    FileCheck,
    Loader2,
    Check,
    X,
    Truck,
    Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ============================================
// HELPERS & MAP ICONS
// ============================================
const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data))
        return response.data.data;
    return [];
};

const formatDateShort = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const StatusPill = ({ status }) => {
    let label = "Pending";
    let color = "bg-orange-500/20 text-orange-400 border-orange-500/30";
    let Icon = Clock;

    if (status === "pending_mayors_office") {
        label = "Pending";
        color = "bg-orange-500/20 text-orange-400 border-orange-500/30";
        Icon = Clock;
    } else if (status === "funds_issued" || status === "acknowledged") {
        label = "Ready";
        color = "bg-blue-500/20 text-blue-400 border-blue-500/30";
        Icon = CheckCircle;
    } else if (status === "in_transit" || status === "paused") {
        label = status === "paused" ? "Paused" : "In Transit";
        color = "bg-purple-500/20 text-purple-400 border-purple-500/30";
        Icon = Truck;
    } else if (status === "completed" || status === "pending_gso_validation") {
        label = "Completed";
        color = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        Icon = CheckCircle;
    } else if (status === "closed") {
        label = "Closed";
        color = "bg-slate-600/50 text-slate-300 border-slate-500/50";
        Icon = CheckCircle;
    } else if (status === "cancelled") {
        label = "Cancelled";
        color = "bg-red-500/20 text-red-400 border-red-500/30";
        Icon = X;
    }

    return (
        <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1.5 w-fit ${color}`}
        >
            <Icon className="h-3 w-3" /> {label}
        </span>
    );
};

const createVehicleIcon = (plateNumber, vehicleModel) => {
    return L.divIcon({
        className: "custom-vehicle-icon",
        html: `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; transform:translate(-50%,-50%); position:relative; width:120px;">
            <div style="background-color:#3b82f6; width:32px; height:32px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 6px rgba(0,0,0,0.3); z-index:2;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <div style="position:absolute; top:38px; background-color:rgba(255,255,255,0.95); color:#0f172a; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.2); border:1px solid #cbd5e1; z-index:1;">
                ${plateNumber || "Unknown"}
                <span style="font-weight:400; font-size:9px; color:#64748b; display:block; text-align:center;">${vehicleModel || ""}</span>
            </div>
        </div>`,
        iconSize: [120, 80],
        iconAnchor: [60, 40],
        popupAnchor: [0, -30],
    });
};

const createSvgIcon = (color, iconPath) => {
    return L.divIcon({
        className: "custom-svg-icon",
        html: `<div style="
            background-color: ${color}; width: 28px; height: 28px; border-radius: 50%;
            border: 2px solid white; display: flex; align-items: center; justify-content: center;
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
    start: createSvgIcon(
        "#22c55e",
        '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
    ),
    end: createSvgIcon(
        "#ef4444",
        '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>',
    ),
    vehicle: createSvgIcon(
        "#3b82f6",
        '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    ),
};

const MapBounds = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && coords.length > 0) {
            map.fitBounds(coords, { padding: [50, 50], maxZoom: 16 });
        }
    }, [coords, map]);
    return null;
};

const ReplayMarker = ({ segments, replayIndex, icon }) => {
    const map = useMap();
    
    const getReplayPosition = () => {
        let count = 0;
        for (let seg of segments) {
            if (replayIndex < count + seg.coords.length) {
                return seg.coords[replayIndex - count];
            }
            count += seg.coords.length;
        }
        return null;
    };

    const position = getReplayPosition();

    useEffect(() => {
        if (position && position.length === 2) {
            map.panTo(position, { animate: true, duration: 0.5 });
        }
    }, [position, map]);

    return position ? <Marker position={position} icon={icon} /> : null;
};

const SEGMENT_COLORS = [
    "#3b82f6", 
    "#8b5cf6", 
    "#10b981", 
    "#f59e0b", 
    "#ef4444", 
];

// ============================================
// MAIN COMPONENT
// ============================================
const GsoDashboard = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showValidateDialog, setShowValidateDialog] = useState(false);
    const [hasWatchedReplay, setHasWatchedReplay] = useState(false);

    const [detailTicket, setDetailTicket] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);

    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [routeSegments, setRouteSegments] = useState([]);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const replayIntervalRef = useRef(null);

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["gso-dashboard-vehicles"] });
        queryClient.invalidateQueries({ queryKey: ["gso-dashboard-trips"] });
        queryClient.invalidateQueries({ queryKey: ["gps-active-trips"] });
        queryClient.invalidateQueries({ queryKey: ["gso-pending-validation"] });
    }, [queryClient]);

    useAutoRefresh(
        ["gso-trip-updated", "gps-active-trips", "trip-completed", "trip-created"],
        fetchAllData,
    );

    // ============ QUERIES ============
    const { data: vehiclesRaw = [], isLoading: vehiclesLoading } =
        useOptimizedQuery({
            queryKey: ["gso-dashboard-vehicles"],
            queryFn: async () => extractArray(await vehicleAPI.getAll()),
        });
    const vehicles = useMemo(
        () => (Array.isArray(vehiclesRaw) ? vehiclesRaw : []),
        [vehiclesRaw],
    );

    const { data: departmentsRaw = [] } = useOptimizedQuery({
        queryKey: ["gso-dashboard-departments"],
        queryFn: async () => extractArray(await departmentAPI.getAll()),
    });
    const departments = useMemo(
        () => (Array.isArray(departmentsRaw) ? departmentsRaw : []),
        [departmentsRaw],
    );

    const { data: activeTripsRaw = [], isLoading: activeTripsLoading } =
        useQuery({
            queryKey: ["gps-active-trips"],
            queryFn: async () => {
                try {
                    const res = await gpsAPI.getActiveTrips();
                    return Array.isArray(res.data?.data) ? res.data.data : [];
                } catch {
                    return [];
                }
            },
            refetchInterval: 15000,
        });
    const activeTrips = useMemo(
        () => (Array.isArray(activeTripsRaw) ? activeTripsRaw : []),
        [activeTripsRaw],
    );

        const { data: allTripsRaw = [], isLoading: tripsLoading } =
        useOptimizedQuery({
            queryKey: ["gso-dashboard-trips"],
            queryFn: async () => {
                const trips = extractArray(await gsoAPI.getAllTrips());
                return trips.filter((trip) => {
                    const status = (trip.status || "").toLowerCase();

                  
                    if (["cancelled", "rejected", "returned_for_revision"].includes(status)) {
                        return false;
                    }

                   
                    return true; 
                });
            },
        });

    const allTrips = useMemo(
        () => (Array.isArray(allTripsRaw) ? allTripsRaw : []),
        [allTripsRaw],
    );

    const { data: pendingValidationRaw = [], isLoading: validationLoading } =
        useOptimizedQuery({
            queryKey: ["gso-pending-validation"],
            queryFn: async () => {
                const trips = extractArray(await gsoAPI.getPendingValidation());
                return trips;
            },
        });

    const pendingValidation = useMemo(
        () =>
            Array.isArray(pendingValidationRaw) ? pendingValidationRaw : [],
        [pendingValidationRaw],
    );

    // ============ MUTATIONS ============
    const validateMutation = useMutation({
        mutationFn: async ({ ticketId }) => {
            if (!ticketId) throw new Error("Ticket ID is missing");
            const response = await gsoAPI.validateTrip(ticketId, {});
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Trip validated successfully!");
            queryClient.invalidateQueries({
                queryKey: ["gso-pending-validation"],
            });
            queryClient.invalidateQueries({
                queryKey: ["gso-dashboard-trips"],
            });
            setShowValidateDialog(false);
            setSelectedTicket(null);
            setHasWatchedReplay(false);
        },
        onError: (error) => {
            toast.error(
                error?.response?.data?.message ||
                    error.message ||
                    "Failed to validate trip",
            );
        },
    });

    // ============ DERIVED DATA ============
    const totalVehicles = vehicles.length;
    const serviceable = vehicles.filter(
        (v) => v.status === "active" && !v.maintenance_flag,
    ).length;
    const unserviceable = vehicles.filter((v) => v.status !== "active").length;
    const maintenance = vehicles.filter((v) => v.maintenance_flag).length;

    const inUse = activeTrips.length;
    const available = totalVehicles - inUse;
    const utilizationPct =
        totalVehicles > 0 ? Math.round((inUse / totalVehicles) * 100) : 0;

      const recentTrips = useMemo(() => {
        return [...allTrips]
            .sort((a, b) => {
                const dateA = new Date(a.created_at || a.trip_date || a.submitted_at || 0).getTime();
                const dateB = new Date(b.created_at || b.trip_date || b.submitted_at || 0).getTime();
                return dateB - dateA; // Latest first
            })
            .slice(0, 5); 
    }, [allTrips]);

    const filteredVehicles = useMemo(() => {
        let result = vehicles;
        if (deptFilter !== "all") {
            result = result.filter(
                (v) => v.department_id?.toString() === deptFilter,
            );
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(
                (v) =>
                    v.plate_number?.toLowerCase().includes(lower) ||
                    v.vehicle_model?.toLowerCase().includes(lower) ||
                    v.department?.department_name
                        ?.toLowerCase()
                        .includes(lower),
            );
        }
        return result.slice(0, 5);
    }, [vehicles, searchTerm, deptFilter]);

    // ============================================
    // FUEL LEDGER (forward chain per vehicle)
    // ============================================
    const ledgerRows = useMemo(() => {
        const r2 = (n) => parseFloat(toNum(n).toFixed(2));

        const ledgerTrips = allTrips.filter(trip => {
            const status = (trip.status || "").toLowerCase();
            // Only exclude truly incomplete/cancelled trips
            if (["cancelled", "rejected", "returned_for_revision", "pending_mayors_office"].includes(status)) {
                return false;
            }
            return true;
        });

        const rows = ledgerTrips.map((trip) => {
            const vehicle =
                vehicles.find((v) => v.vehicle_id === trip.vehicle_id) ||
                vehicles.find(
                    (v) => v.plate_number === trip.vehicle?.plate_number,
                ) ||
                trip.vehicle;

            // ✅ FIXED: Tangtangon ang estimate fallback. 
            // Kung wala pay input, mahimong null (dili 0)
            const rawFuelIn = 
                trip.gasSlip?.fuelReceipt?.liters_availed ??
                trip.gas_slip?.fuel_receipt?.liters_availed ??
                trip.liters_availed;

            const hasFuelInput = rawFuelIn !== undefined && rawFuelIn !== null && rawFuelIn !== "";
            const fuelIn = hasFuelInput ? toNum(rawFuelIn) : null;

            const status = (trip.status || "").toLowerCase();
            const isCompleted = [
                "completed",
                "pending_gso_validation",
                "closed",
            ].includes(status);

            const distance = isCompleted
                ? toNum(trip.actual_distance_km || trip.gps_distance_km)
                : 0;

            let efficiency = toNum(vehicle?.reference_efficiency) || 10;
            if (efficiency < 6 || efficiency > 20) {
                efficiency = 10; 
            }

            const rawFuelOut = distance > 0 ? distance / efficiency : 0;

            return {
                trip,
                vehicle,
                vehicleKey:
                    trip.vehicle_id ??
                    trip.vehicle?.vehicle_id ??
                    trip.vehicle?.plate_number ??
                    "unknown",
                fuelIn: fuelIn !== null ? r2(fuelIn) : null, // Keep null kung wala
                fuelOut: r2(rawFuelOut),
                distance,
                efficiency,
                sortTime: new Date(
                    trip.created_at ||
                        trip.submitted_at ||
                        trip.trip_date ||
                        0,
                ).getTime(),
            };
        });

        const groups = {};
        rows.forEach((r) => {
            (groups[r.vehicleKey] = groups[r.vehicleKey] || []).push(r);
        });

        Object.values(groups).forEach((list) => {
            list.sort((a, b) => a.sortTime - b.sortTime);

            const first = list[0];
            // Kung null ang fuelIn, i-treat as 0 para sa math calculation sa balance
            const totalIn = list.reduce((s, r) => s + (r.fuelIn ?? 0), 0);
            const totalOut = list.reduce((s, r) => s + r.fuelOut, 0);

            const initialRaw = first.vehicle?.initial_estimated_fuel;
            const hasInitial =
                initialRaw !== undefined &&
                initialRaw !== null &&
                initialRaw !== "";

            let anchor;
            if (hasInitial) {
                anchor = toNum(initialRaw);
            } else {
                anchor =
                    toNum(first.vehicle?.current_fuel_balance) -
                    totalIn +
                    totalOut;
            }

            let prev = r2(anchor);
            list.forEach((r) => {
                r.beginning = prev;
                // ✅ Kung null ang fuelIn, 0 ang idungag sa balance (walay kausaban)
                r.balance = r2(r.beginning + (r.fuelIn ?? 0) - r.fuelOut);
                prev = r.balance;
            });
        });

        return [...rows]
            .sort((a, b) => b.sortTime - a.sortTime)
            .map((r) => ({
                ...r.trip,
                driver_name:
                    r.trip.driver_name ||
                    r.trip.driver?.user?.full_name ||
                    r.trip.driver?.full_name ||
                    r.trip.driver?.name ||
                    "N/A",
                beginning: r.beginning.toFixed(2),
                fuelIn: r.fuelIn !== null ? r.fuelIn.toFixed(2) : null, // ✅ Null imbes 0.00
                fuelOut: r.fuelOut.toFixed(2),
                distanceKm: r.distance,
                efficiencyUsed: r.efficiency,
                balance: r.balance.toFixed(2),
                vehicleString: r.trip.vehicle
                    ? `${r.trip.vehicle.vehicle_model} - ${r.trip.vehicle.plate_number}`
                    : "N/A",
                displayTicketNo:
                    r.trip.ticket_number || r.trip.trip_ticket_number,
                displayId: r.trip.id || r.trip.trip_ticket_id,
                displayDate: r.trip.trip_date || r.trip.submitted_at,
            }));
    }, [allTrips, vehicles]);

    // ============================================
    // SHARED: load route + segments
    // ============================================
    const loadRoute = useCallback(async (trip) => {
        setRouteCoordinates([]);
        setRouteSegments([]);
        setLoadingRoute(true);
        setReplayIndex(0);

        try {
            const tripId = trip.displayId || trip.id || trip.trip_ticket_id;
            if (!tripId) throw new Error("Invalid Trip ID");

            const res = await gpsAPI.getTripRoute(tripId);
            const data = res?.data?.data || {};

            const rawSegments = Array.isArray(data.segments) ? data.segments : [];
            const segments = rawSegments
                .map((seg) => ({
                    historyId: seg.history_id,
                    tripNumber: seg.trip_number,
                    status: seg.status,
                    startedAt: seg.started_at,
                    endedAt: seg.ended_at,
                    distanceKm: toNum(seg.distance_km),
                    pingCount: seg.ping_count ?? 0,
                    coords: (seg.track || [])
                        .map((p) => [
                            parseFloat(p.latitude),
                            parseFloat(p.longitude),
                        ])
                        .filter((c) => !isNaN(c[0]) && !isNaN(c[1])),
                }))
                .filter((seg) => seg.coords.length > 0);

            const flatCoords = segments.flatMap((s) => s.coords);
            const fallback = (data.track || [])
                .map((p) => [parseFloat(p.latitude), parseFloat(p.longitude)])
                .filter((c) => !isNaN(c[0]) && !isNaN(c[1]));

            const coords = flatCoords.length > 0 ? flatCoords : fallback;

            setRouteSegments(segments);
            setRouteCoordinates(coords);

            return { segments, coords };
        } catch (e) {
            console.error("Failed to load route", e);
            toast.error("Could not load route data.");
            return { segments: [], coords: [] };
        } finally {
            setLoadingRoute(false);
        }
    }, []);

    const startReplay = useCallback((segmentsData) => {
        if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current);
            replayIntervalRef.current = null;
        }
        setIsReplaying(true);
        setReplayIndex(0);
        setHasWatchedReplay(false);

        const flatWithBreaks = [];
        segmentsData.forEach((seg, i) => {
            if (i > 0) flatWithBreaks.push(null); 
            flatWithBreaks.push(...seg.coords);
        });

        let currentIdx = 0;
        replayIntervalRef.current = setInterval(() => {
            currentIdx++;
            if (currentIdx >= flatWithBreaks.length) {
                clearInterval(replayIntervalRef.current);
                replayIntervalRef.current = null;
                setIsReplaying(false);
                setReplayIndex(flatWithBreaks.length - 1);
                setHasWatchedReplay(true);
                return;
            }
            
            if (flatWithBreaks[currentIdx] === null) {
                return; 
            }
            setReplayIndex(currentIdx);
        }, 80);
    }, []);

    const handleStopReplay = useCallback(() => {
        setIsReplaying(false);
        setReplayIndex(0);
        if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current);
            replayIntervalRef.current = null;
        }
    }, []);

    // ============================================
    // VALIDATE HANDLER
    // ============================================
    const handleOpenValidateDialog = useCallback(
        async (trip) => {
            setSelectedTicket(trip);
            setShowValidateDialog(true);
            setHasWatchedReplay(false);

            const { segments, coords } = await loadRoute(trip);

            if (coords.length >= 2) {
                const replayData = segments.length > 0 
                    ? segments 
                    : [{ coords }];
                setTimeout(() => startReplay(replayData), 500);
            } else {
                setHasWatchedReplay(true);
                toast.error("No route points available for replay.");
            }
        },
        [loadRoute, startReplay],
    );

    const handleOpenDetailDialog = useCallback(
        async (trip) => {
            setDetailTicket(trip);
            setShowDetailDialog(true);
            
            const { segments, coords } = await loadRoute(trip);

            if (coords.length >= 2) {
                const replayData = segments.length > 0 
                    ? segments 
                    : [{ coords }];
                setTimeout(() => startReplay(replayData), 500);
            } else {
                toast.error("No route points available for replay.");
            }
        },
        [loadRoute, startReplay],
    );

    useEffect(() => {
        return () => {
            if (replayIntervalRef.current)
                clearInterval(replayIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (!showValidateDialog) {
            handleStopReplay();
        }
    }, [showValidateDialog, handleStopReplay]);

    useEffect(() => {
        if (!showDetailDialog) {
            handleStopReplay();
            setRouteCoordinates([]);
            setRouteSegments([]);
        }
    }, [showDetailDialog, handleStopReplay]);

    // ============================================
    // RENDER HELPERS
    // ============================================
    const renderSegments = () => {
        if (routeSegments.length > 0) {
            return routeSegments.map((seg, i) => {
                const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
                return (
                    <Polyline
                        key={`seg-${seg.historyId ?? i}`}
                        positions={seg.coords}
                        color={color}
                        weight={4}
                        dashArray={
                            seg.status === "in_progress" ? "6 6" : undefined
                        }
                    />
                );
            });
        }
        if (routeCoordinates.length > 0) {
            return (
                <Polyline
                    positions={routeCoordinates}
                    color="#3b82f6"
                    weight={4}
                />
            );
        }
        return null;
    };

    const renderSegmentBadges = () => {
        if (routeSegments.length <= 1) return null;
        return (
            <div className="flex flex-wrap gap-2">
                {routeSegments.map((seg, i) => {
                    const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
                    return (
                        <span
                            key={`badge-${seg.historyId ?? i}`}
                            className="text-[10px] font-bold px-2 py-1 rounded-full border"
                            style={{
                                color,
                                borderColor: color,
                                backgroundColor: color + "20",
                            }}
                        >
                            Trip {seg.tripNumber} — {seg.distanceKm.toFixed(2)} km
                            {seg.status === "in_progress" && " • in progress"}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#090e1a] p-4 md:p-6 font-sans text-slate-200">
            <div className="max-w-[1600px] mx-auto space-y-6">
                {/* 1. HERO HEADER */}
                <div className="relative overflow-hidden bg-gradient-to-r from-[#0f172a] via-[#1e3a8a] to-[#0f172a] rounded-2xl p-6 md:p-8 border border-blue-900/50 shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-none rounded-full px-3 py-1 text-[10px]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />{" "}
                                    GSO Office
                                </Badge>
                                <Badge className="bg-blue-600 text-white border-none rounded-full px-3 py-1 text-[10px]">
                                    General Services Office
                                </Badge>
                                <Badge className="bg-purple-600 text-white border-none rounded-full px-3 py-1 text-[10px]">
                                    MIS Dashboard
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">
                                GSO Dashboard
                            </h1>
                            <p className="text-blue-200/70 text-sm mt-1 max-w-lg">
                                Monitor vehicle status, fuel balance, and trip
                                activities in MIS or Laguindingan.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => navigate("/gso/create-trip")}
                                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-10 px-6 shadow-lg shadow-blue-500/20"
                            >
                                <PlusCircle className="h-4 w-4 mr-2" /> Create
                                Trip
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 2. STATS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">
                                    {totalVehicles}
                                </p>
                                <p className="text-sm font-medium text-slate-300 mt-1">
                                    Total Vehicles
                                </p>
                            </div>
                            <div className="p-3 bg-blue-600/20 rounded-xl">
                                <Car className="h-6 w-6 text-blue-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">
                                    {serviceable}
                                </p>
                                <p className="text-sm font-medium text-slate-300 mt-1">
                                    Serviceable
                                </p>
                            </div>
                            <div className="p-3 bg-emerald-600/20 rounded-xl">
                                <CheckCircle className="h-6 w-6 text-emerald-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">
                                    {unserviceable}
                                </p>
                                <p className="text-sm font-medium text-slate-300 mt-1">
                                    Unserviceable
                                </p>
                            </div>
                            <div className="p-3 bg-red-600/20 rounded-xl">
                                <AlertTriangle className="h-6 w-6 text-red-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#121829] border-slate-800 shadow-lg">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-bold text-white">
                                    {maintenance}
                                </p>
                                <p className="text-sm font-medium text-slate-300 mt-1">
                                    Under Maintenance
                                </p>
                            </div>
                            <div className="p-3 bg-amber-600/20 rounded-xl">
                                <Wrench className="h-6 w-6 text-amber-500" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 3. LIVE TRACKING & FUEL BALANCE MONITORING */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 bg-[#121829] border-slate-800 shadow-lg flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-500" />{" "}
                                Live Vehicle Tracking
                            </h3>
                        </div>
                        <div className="flex-1 relative bg-[#0b101c] min-h-[350px]">
                            <MapContainer
                                center={[8.5833, 124.6667]}
                                zoom={12}
                                style={{ height: "100%", width: "100%" }}
                                zoomControl={false}
                                className="z-0"
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <ZoomControl position="bottomright" />
                                {activeTrips.map((trip) => {
                                    if (!trip.current_location) return null;
                                    return (
                                        <Marker
                                            key={trip.trip_id}
                                            position={[
                                                trip.current_location.latitude,
                                                trip.current_location.longitude,
                                            ]}
                                            icon={createVehicleIcon(
                                                trip.vehicle?.plate_number,
                                                trip.vehicle?.vehicle_model,
                                            )}
                                        />
                                    );
                                })}
                            </MapContainer>
                        </div>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg flex flex-col h-full">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Fuel className="h-4 w-4 text-blue-500" /> Fuel
                                Balance Monitoring
                            </h3>
                        </div>
                        <div className="p-3 border-b border-slate-800 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                <Input
                                    placeholder="Search vehicle..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="pl-8 h-8 text-xs bg-[#0b101c] border-slate-700 text-white rounded-lg"
                                />
                            </div>
                        </div>
                                                <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-[#0b101c] text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Date</th>
                                        <th className="px-3 py-2 font-medium">TT Number</th>
                                        <th className="px-3 py-2 font-medium">Destination</th>
                                        <th className="px-3 py-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {recentTrips.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                                                No recent trips.
                                            </td>
                                        </tr>
                                    ) : (
                                        recentTrips.map((trip) => (
                                            <tr
                                                key={trip.trip_ticket_id || trip.id}
                                                className="hover:bg-[#1a2235] cursor-pointer"
                                                onClick={() =>
                                                    navigate(
                                                        `/gso/tickets/${trip.trip_ticket_id || trip.id}`,
                                                    )
                                                }
                                            >
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {formatDateShort(trip.trip_date || trip.created_at)}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-white">
                                                    {trip.trip_ticket_number || trip.ticket_number}
                                                </td>
                                                <td className="px-3 py-2 truncate max-w-[100px]" title={trip.destination}>
                                                    {trip.destination}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <StatusPill status={trip.status} />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* 4. VEHICLE UTILIZATION & RECENT TRIPS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-[#121829] border-slate-800 shadow-lg p-4">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-blue-500" />{" "}
                            Vehicle Utilization
                        </h3>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex flex-col items-center">
                                <span className="text-2xl font-bold text-white">
                                    {inUse}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    In Use
                                </span>
                            </div>
                            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden flex">
                                <div
                                    className="bg-emerald-500 h-full"
                                    style={{ width: `${utilizationPct}%` }}
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-2xl font-bold text-white">
                                    {available}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    Available
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2 mt-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Vehicles Currently in Use
                            </p>
                            <table className="w-full text-xs text-left">
                                <thead className="text-slate-500 border-b border-slate-800">
                                    <tr>
                                        <th className="pb-2 font-medium">
                                            Vehicle
                                        </th>
                                        <th className="pb-2 font-medium text-right">
                                            Destination
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {activeTrips
                                        .slice(0, 3)
                                        .map((trip, idx) => (
                                            <tr key={idx}>
                                                <td className="py-2 text-white truncate max-w-[100px]">
                                                    {
                                                        trip.vehicle
                                                            ?.vehicle_model
                                                    }
                                                </td>
                                                <td className="py-2 text-right text-slate-300 truncate max-w-[100px]">
                                                    {trip.destination || "N/A"}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card className="bg-[#121829] border-slate-800 shadow-lg flex flex-col">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-500" />{" "}
                                Recent Trip Tickets
                            </h3>
                            <button
                                onClick={() => navigate("/gso/alltrips")}
                                className="text-[10px] text-blue-400 hover:text-blue-300"
                            >
                                View All →
                            </button>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-[#0b101c] text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">
                                            Date
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                            TT Number
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                            Destination
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {recentTrips.map((trip) => (
                                        <tr
                                            key={trip.trip_ticket_id}
                                            className="hover:bg-[#1a2235] cursor-pointer"
                                            onClick={() =>
                                                navigate(
                                                    `/gso/tickets/${trip.trip_ticket_id}`,
                                                )
                                            }
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {formatDateShort(
                                                    trip.trip_date,
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-white">
                                                {trip.trip_ticket_number}
                                            </td>
                                            <td className="px-3 py-2 truncate max-w-[100px]">
                                                {trip.destination}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusPill
                                                    status={trip.status}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* 5. PENDING VALIDATION TABLE */}
                <Card className="bg-[#121829] border-slate-800 shadow-lg">
                    <CardHeader className="border-b border-slate-800 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <FileCheck className="h-5 w-5 text-blue-500" />{" "}
                                    Pending Validation
                                </CardTitle>
                                <p className="text-xs text-slate-400 mt-1">
                                    Trips completed by the driver, awaiting GSO
                                    validation.
                                </p>
                            </div>
                            <Badge className="bg-blue-600 text-white">
                                {pendingValidation.length} tickets
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-[#0b101c] text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            TT No.
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Vehicle
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Destination
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Driver
                                        </th>
                                        <th className="px-4 py-3 font-medium text-right">
                                            Distance (km)
                                        </th>
                                        <th className="px-4 py-3 font-medium text-center">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {validationLoading ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="text-center py-6"
                                            >
                                                <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-500" />
                                            </td>
                                        </tr>
                                    ) : pendingValidation.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="text-center py-6 text-slate-500"
                                            >
                                                No pending validations.
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingValidation.map((trip) => (
                                            <tr
                                                key={
                                                    trip.id ||
                                                    trip.trip_ticket_id
                                                }
                                                className="hover:bg-[#1a2235]"
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {formatDateShort(
                                                        trip.trip_date,
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-white">
                                                    {trip.ticket_number ||
                                                        trip.trip_ticket_number}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {trip.vehicle
                                                        ?.plate_number || "N/A"}
                                                </td>
                                                <td className="px-4 py-3 truncate max-w-[150px]">
                                                    {trip.destination}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {trip.driver_name ||
                                                        trip.driver?.user
                                                            ?.full_name ||
                                                        "N/A"}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-white">
                                                    {trip.actual_distance_km ||
                                                        0}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            handleOpenValidateDialog(
                                                                trip,
                                                            )
                                                        }
                                                        className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs"
                                                    >
                                                        <Check className="h-3.5 w-3.5 mr-1" />{" "}
                                                        Review & Validate
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* 6. FUEL LEDGER TABLE (READ-ONLY) */}
                <Card className="bg-[#121829] border-slate-800 shadow-lg">
                    <CardHeader className="border-b border-slate-800 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Fuel className="h-5 w-5 text-blue-500" />{" "}
                                    Fuel Ledger
                                </CardTitle>
                                <p className="text-xs text-slate-400 mt-1">
                                    Trip fuel consumption history. Click a row
                                    to view details & route.
                                </p>
                            </div>
                            <Badge className="bg-slate-700 text-slate-200">
                                {ledgerRows.length} entries
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-[#0b101c] text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            TT No.
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Vehicle
                                        </th>
                                        <th className="px-4 py-3 font-medium text-right">
                                            Beginning (L)
                                        </th>
                                        <th className="px-4 py-3 font-medium text-right">
                                            Fuel In (L)
                                        </th>
                                        <th className="px-4 py-3 font-medium text-right">
                                            Fuel Out (L)
                                        </th>
                                        <th className="px-4 py-3 font-medium text-right">
                                            Balance (L)
                                        </th>
                                        <th className="px-4 py-3 font-medium text-center">
                                            View
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {tripsLoading ? (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                className="text-center py-6"
                                            >
                                                <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-500" />
                                            </td>
                                        </tr>
                                    ) : ledgerRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                className="text-center py-6 text-slate-500"
                                            >
                                                No trip history yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        ledgerRows.map((computed) => (
    <tr
        key={computed.displayId}
        className="hover:bg-[#1a2235] transition-colors"
    >
        <td className="px-4 py-3 whitespace-nowrap">
            {formatDateShort(
                computed.displayDate,
            )}
        </td>
        <td className="px-4 py-3 font-mono text-white">
            {computed.displayTicketNo}
        </td>
        <td className="px-4 py-3">
            {computed.vehicleString}
        </td>
        <td className="px-4 py-3 text-right text-slate-400">
            {computed.beginning}
        </td>
        {/* ✅ DASH KUNG WALAY INPUT */}
        <td className="px-4 py-3 text-right text-emerald-400">
            {computed.fuelIn !== null ? computed.fuelIn : "-"}
        </td>
        <td className="px-4 py-3 text-right text-red-400">
            {computed.fuelOut}
        </td>
        <td className="px-4 py-3 text-right font-bold text-white">
            {computed.balance}
        </td>
        <td className="px-4 py-3 text-center">
            <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                    handleOpenDetailDialog(
                        computed,
                    )
                }
                className="h-8 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-600/10"
            >
                <Eye className="h-3.5 w-3.5 mr-1" />{" "}
                View
            </Button>
        </td>
    </tr>
))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* 7. VALIDATE DIALOG (Pending Validation ONLY) */}
                <Dialog
                    open={showValidateDialog}
                    onOpenChange={setShowValidateDialog}
                >
                    <DialogContent className="max-w-4xl bg-[#121829] border-slate-800 text-white">
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <FileCheck className="h-5 w-5 text-emerald-500" />
                                Review & Validate Trip
                            </h2>

                            {renderSegmentBadges()}

                            {selectedTicket && (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-400">TT No.</p>
                                        <p className="font-mono text-white">
                                            {selectedTicket.displayTicketNo ||
                                                selectedTicket.ticket_number ||
                                                selectedTicket.trip_ticket_number}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Destination
                                        </p>
                                        <p className="text-white">
                                            {selectedTicket.destination || "N/A"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Driver
                                        </p>
                                        <p className="text-white">
                                            {selectedTicket.driver_name ||
                                                selectedTicket.driver?.user
                                                    ?.full_name ||
                                                "N/A"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Distance
                                        </p>
                                        <p className="text-white">
                                            {selectedTicket.actual_distance_km ||
                                                selectedTicket.distanceKm ||
                                                0}{" "}
                                            km
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="h-[300px] rounded-lg overflow-hidden border border-slate-700">
                                {loadingRoute ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                    </div>
                                ) : routeCoordinates.length > 0 ? (
                                    <MapContainer
                                        center={routeCoordinates[0]}
                                        zoom={14}
                                        style={{
                                            height: "100%",
                                            width: "100%",
                                        }}
                                    >
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                        <MapBounds coords={routeCoordinates} />
                                        {renderSegments()}
                                        {routeCoordinates.length > 0 && (
                                            <>
                                                <Marker
                                                    position={
                                                        routeCoordinates[0]
                                                    }
                                                    icon={icons.start}
                                                />
                                                <Marker
                                                    position={
                                                        routeCoordinates[
                                                            routeCoordinates.length -
                                                                1
                                                        ]
                                                    }
                                                    icon={icons.end}
                                                />
                                            </>
                                        )}
                                      {isReplaying && (
    <ReplayMarker
        segments={routeSegments.length > 0 ? routeSegments : [{ coords: routeCoordinates }]}
        replayIndex={replayIndex}
        icon={icons.vehicle}
    />
)}
                                    </MapContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-500">
                                        No route data available
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setShowValidateDialog(false)
                                    }
                                    className="border-slate-700 text-white hover:bg-slate-800"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        const ticketId =
                                            selectedTicket?.displayId ||
                                            selectedTicket?.id ||
                                            selectedTicket?.trip_ticket_id;
                                        if (!ticketId) {
                                            toast.error("Invalid ticket ID");
                                            return;
                                        }
                                        validateMutation.mutate({ ticketId });
                                    }}
                                    disabled={
                                        validateMutation.isPending ||
                                        !hasWatchedReplay
                                    }
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {validateMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Validating...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4 mr-2" />
                                            Validate & Close
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* 8. DETAIL DIALOG (Ledger — READ ONLY) */}
                <Dialog
                    open={showDetailDialog}
                    onOpenChange={setShowDetailDialog}
                >
                    <DialogContent className="max-w-4xl bg-[#121829] border-slate-800 text-white">
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Eye className="h-5 w-5 text-blue-500" />
                                Trip Details & Route
                            </h2>

                            {renderSegmentBadges()}

                            {detailTicket && (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-400">TT No.</p>
                                        <p className="font-mono text-white">
                                            {detailTicket.displayTicketNo ||
                                                detailTicket.ticket_number ||
                                                detailTicket.trip_ticket_number}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Destination
                                        </p>
                                        <p className="text-white">
                                            {detailTicket.destination || "N/A"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Driver
                                        </p>
                                        <p className="text-white">
                                            {detailTicket.driver_name ||
                                                detailTicket.driver?.user
                                                    ?.full_name ||
                                                "N/A"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Distance
                                        </p>
                                        <p className="text-white">
                                            {detailTicket.actual_distance_km ||
                                                detailTicket.distanceKm ||
                                                0}{" "}
                                            km
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Fuel In
                                        </p>
                                        {/* ✅ DASH KUNG WALAY INPUT */}
                                        <p className="text-emerald-400 font-bold">
                                            {detailTicket.fuelIn !== null ? `${detailTicket.fuelIn} L` : "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Fuel Out
                                        </p>
                                        <p className="text-red-400 font-bold">
                                            {detailTicket.fuelOut} L
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">
                                            Balance
                                        </p>
                                        <p className="text-white font-bold">
                                            {detailTicket.balance} L
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">Status</p>
                                        <StatusPill
                                            status={detailTicket.status}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="h-[350px] rounded-lg overflow-hidden border border-slate-700">
                                {loadingRoute ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                    </div>
                                ) : routeCoordinates.length > 0 ? (
                                    <MapContainer
                                        center={routeCoordinates[0]}
                                        zoom={14}
                                        style={{
                                            height: "100%",
                                            width: "100%",
                                        }}
                                    >
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                        <MapBounds coords={routeCoordinates} />
                                        {renderSegments()}
                                        <Marker
                                            position={routeCoordinates[0]}
                                            icon={icons.start}
                                        />
                                        <Marker
                                            position={
                                                routeCoordinates[
                                                    routeCoordinates.length - 1
                                                ]
                                            }
                                            icon={icons.end}
                                        />
                                        {/* ✅ IDUGANG KINI NGA REPLAY MARKER */}
                                        {isReplaying && (
                                            <ReplayMarker
                                                segments={routeSegments.length > 0 ? routeSegments : [{ coords: routeCoordinates }]}
                                                replayIndex={replayIndex}
                                                icon={icons.vehicle}
                                            />
                                        )}
                                    </MapContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-500">
                                        No route data available
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setShowDetailDialog(false)
                                    }
                                    className="border-slate-700 text-white hover:bg-slate-800"
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default GsoDashboard;