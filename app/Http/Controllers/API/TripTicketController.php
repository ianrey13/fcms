<?php

namespace App\Http\Controllers\API;

use Illuminate\Support\Facades\Cache;
use App\Http\Controllers\Controller;
use App\Models\TripTicket;
use App\Models\GasSlip;
use App\Models\Notification;
use App\Models\Driver;
use App\Models\Vehicle;
use App\Models\Department;
use App\Models\User;
use App\Models\DeptBudgetPeriod;
use App\Models\TripTicketVehicleSnapshot;
use App\Models\TripTicketReturn;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Events\NewNotification;  // ✅ ADD THIS


class TripTicketController extends Controller
{
    /**
     * Display trip tickets based on user role
     * ✅ Updated for new roles: gso_office, mayors_office, driver
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = TripTicket::with(['department', 'driver.user', 'vehicle', 'gasSlip']);

        // ✅ Driver can see trips assigned to them (including trips they requested)
        if ($user->isDriver()) {
            $driver = Driver::where('user_id', $user->user_id)->first();
            if ($driver) {
                $query->where('driver_id', $driver->driver_id)
                    ->orWhere('submitted_by', $user->user_id);
            } else {
                $query->where('submitted_by', $user->user_id);
            }
        } elseif ($user->isGsoOffice()) {
            // GSO can see all trips
            $query->whereIn('status', [
                TripTicket::STATUS_PENDING_MAYORS_OFFICE,
                TripTicket::STATUS_RETURNED_FOR_REVISION,
                TripTicket::STATUS_FUNDS_ISSUED,
                TripTicket::STATUS_IN_TRANSIT,
                TripTicket::STATUS_PENDING_RECONCILIATION,
                TripTicket::STATUS_CLOSED,
                TripTicket::STATUS_REJECTED,
                TripTicket::STATUS_CANCELLED,
                TripTicket::STATUS_ACKNOWLEDGED,
                TripTicket::STATUS_DRAFT,
            ]);
        } elseif ($user->isMayorsOffice()) {
            $query->whereIn('status', [
                TripTicket::STATUS_PENDING_MAYORS_OFFICE,
                TripTicket::STATUS_FUNDS_ISSUED,
                TripTicket::STATUS_PENDING_RECONCILIATION
            ]);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('submitted_at', [$request->start_date, $request->end_date]);
        }

        $tripTickets = $query->orderBy('submitted_at', 'desc')->paginate(15);

        return response()->json($tripTickets);
    }

    /**
     * Get my requests for driver
     * ✅ Updated: drivers now request trips too
     */
    public function myRequests(Request $request)
    {
        $user = $request->user();

        $tripTickets = TripTicket::with(['vehicle', 'driver.user', 'department', 'gasSlip'])
            ->where('submitted_by', $user->user_id)
            ->orderBy('submitted_at', 'desc')
            ->get()
            ->map(function ($ticket) {
                return [
                    'id' => $ticket->trip_ticket_id,
                    'ticket_number' => $ticket->trip_ticket_number,
                    'trip_date' => $ticket->trip_date,
                    'destination' => $ticket->destination,
                    'status' => $ticket->status,
                    'submitted_at' => $ticket->submitted_at,
                    'submitted_by_driver' => $ticket->submitted_by_staff ?? true, // Renamed concept
                    'amount_released' => $ticket->gasSlip ? $ticket->gasSlip->amount_released : null,
                    'vehicle' => $ticket->vehicle ? [
                        'plate_number' => $ticket->vehicle->plate_number,
                    ] : null,
                    'driver' => $ticket->driver && $ticket->driver->user ? [
                        'full_name' => $ticket->driver->user->full_name,
                    ] : null,
                ];
            });

        return response()->json($tripTickets);
    }

    /**
     * Display a specific trip ticket
     * ✅ Removed head_approval and gso_verification references
     */
    public function show($id)
    {
        try {
            $tripTicket = TripTicket::with([
                'department',
                'driver.user',
                'vehicle',
                'gasSlip',
                'gasSlip.fuelLog',
                'vehicleSnapshot',
                'returns'
            ])->findOrFail($id);

            $response = [
                'id' => $tripTicket->trip_ticket_id,
                'ticket_number' => $tripTicket->trip_ticket_number,
                'trip_date' => $tripTicket->trip_date,
                'destination' => $tripTicket->destination,
                'purpose' => $tripTicket->purpose,
                'charge_to' => $tripTicket->charge_to,
                'passenger_name' => $tripTicket->passenger_name,
                'status' => $tripTicket->status,
                'submitted_at' => $tripTicket->submitted_at,
                'submitted_by_driver' => $tripTicket->submitted_by_staff ?? true,
                'estimated_distance_km' => $tripTicket->estimated_distance_km,
                'estimated_fuel_liters' => $tripTicket->estimated_fuel_liters,
                'amount_released' => $tripTicket->gasSlip ? $tripTicket->gasSlip->amount_released : null,
                'created_by_mo_user_id' => $tripTicket->created_by_mo_user_id,
                'has_insufficient_budget' => $tripTicket->has_insufficient_budget ?? false,
                'budget_shortage' => $tripTicket->budget_shortage ?? 0,
                'vehicle' => $tripTicket->vehicle ? [
                    'plate_number' => $tripTicket->vehicle->plate_number,
                    'vehicle_model' => $tripTicket->vehicle->vehicle_model,
                    'fuel_type' => $tripTicket->vehicle->fuel_type,
                ] : null,
                'driver' => $tripTicket->driver && $tripTicket->driver->user ? [
                    'full_name' => $tripTicket->driver->user->full_name,
                ] : null,
                'department' => $tripTicket->department ? [
                    'name' => $tripTicket->department->department_name,
                    'code' => $tripTicket->department->department_code,
                ] : null,
                'gas_slip' => $tripTicket->gasSlip ? [
                    'amount_released' => $tripTicket->gasSlip->amount_released,
                    'reconciliation_status' => $tripTicket->gasSlip->reconciliation_status,
                    'created_at' => $tripTicket->gasSlip->created_at,
                    'budget_before' => $tripTicket->gasSlip->budget_before,
                    'budget_after' => $tripTicket->gasSlip->budget_after,
                ] : null,
                'odometer_exception' => $tripTicket->odometer_exception ?? false,
                'odometer_exception_note' => $tripTicket->odometer_exception_note,
            ];

            return response()->json($response);
        } catch (\Exception $e) {
            Log::error('Show ticket error: ' . $e->getMessage());
            return response()->json(['message' => 'Trip ticket not found'], 404);
        }
    }

    /**
 * ✅ NEW: GSO creates trip ticket directly (no draft, no approval)
 */
public function gsoCreate(Request $request)
{
    try {
        $user = $request->user();

        if (!$user->isGsoOffice()) {
            return response()->json(['message' => 'Only GSO Office can create trip tickets'], 403);
        }

        $validator = Validator::make($request->all(), [
            'department_id' => 'required|exists:departments,department_id',
            'driver_id' => 'required|exists:drivers,driver_id',
            'vehicle_id' => 'required|exists:vehicles,vehicle_id',
            'trip_date' => 'required|date|after_or_equal:today',
            'destination' => 'required|string|max:255',
            'purpose' => 'required|string',
            'charge_to' => 'required|string|max:20',
            'passenger_name' => 'nullable|string|max:120',
            'requested_by_driver_id' => 'nullable|exists:users,user_id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $vehicle = Vehicle::find($request->vehicle_id);
        if (!$vehicle || $vehicle->status !== 'active') {
            return response()->json(['message' => 'Vehicle is not available'], 400);
        }

        $driver = Driver::find($request->driver_id);
        if (!$driver || $driver->status !== 'active') {
            return response()->json(['message' => 'Driver is not active'], 400);
        }

        $estimatedDistance = $this->calculateDistanceFromConfig($request->destination);
        $estimatedFuel = $this->calculateEstimatedFuelFromConfig($vehicle, $estimatedDistance);
        $fuelPrice = $this->getFuelPriceFromConfig($vehicle->fuel_type);
        $estimatedCost = round($estimatedFuel * $fuelPrice, 2);

        $budgetInfo = $this->getDepartmentBudgetFromConfig($request->department_id);
        $hasInsufficientBudget = $budgetInfo['remaining'] < $estimatedCost;
        $budgetShortage = $hasInsufficientBudget ? round($estimatedCost - $budgetInfo['remaining'], 2) : 0;

        $yearMonth = date('Y-m');
        $lastTicket = TripTicket::where('trip_ticket_number', 'like', $yearMonth . '-%')
            ->orderBy('trip_ticket_id', 'desc')
            ->first();

        if ($lastTicket) {
            preg_match('/' . $yearMonth . '-(\d+)/', $lastTicket->trip_ticket_number, $matches);
            $seq = isset($matches[1]) ? intval($matches[1]) + 1 : 1;
        } else {
            $seq = 1;
        }

        $ticketNumber = $yearMonth . '-' . str_pad($seq, 3, '0', STR_PAD_LEFT);

        DB::beginTransaction();

        $submittedBy = $request->requested_by_driver_id ?? $user->user_id;
        $submittedByDriver = $request->requested_by_driver_id ? true : false;

        $tripTicket = TripTicket::create([
            'trip_ticket_number' => $ticketNumber,
            'department_id' => $request->department_id,
            'driver_id' => $request->driver_id,
            'vehicle_id' => $request->vehicle_id,
            'submitted_by' => $submittedBy,
            'submitted_by_staff' => $submittedByDriver,
            'submitted_at' => now(),
            'trip_date' => $request->trip_date,
            'purpose' => $request->purpose,
            'destination' => $request->destination,
            'charge_to' => $request->charge_to,
            'passenger_name' => $request->passenger_name ?? null,
            'status' => TripTicket::STATUS_PENDING_MAYORS_OFFICE,
            'estimated_distance_km' => $estimatedDistance,
            'estimated_fuel_liters' => $estimatedFuel,
            'has_insufficient_budget' => $hasInsufficientBudget,
            'budget_shortage' => $budgetShortage,
            'original_department_id' => $request->department_id,
        ]);

        // ✅ FIXED: Create vehicle snapshot without odometer_status
        TripTicketVehicleSnapshot::create([
            'trip_ticket_id' => $tripTicket->trip_ticket_id,
            'vehicle_status' => $vehicle->status,
            'fuel_type' => is_string($vehicle->fuel_type) ? $vehicle->fuel_type : 'regular',
            'snapshot_taken_at' => now(),
        ]);

        DB::commit();

        $this->sendMONotification($tripTicket);

        if ($request->requested_by_driver_id) {
            $this->sendDriverNotification($tripTicket);
        }

        return response()->json([
            'success' => true,
            'message' => 'Trip ticket created successfully and sent to Mayor\'s Office',
            'data' => [
                'trip_ticket_id' => $tripTicket->trip_ticket_id,
                'trip_ticket_number' => $tripTicket->trip_ticket_number,
                'status' => $tripTicket->status,
                'has_insufficient_budget' => $hasInsufficientBudget,
                'budget_shortage' => $budgetShortage,
            ]
        ], 201);

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('GSO Create error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to create trip ticket: ' . $e->getMessage()
        ], 500);
    }
}

    /**
     * Send notification to Mayor's Office
     */
 private function sendMONotification($tripTicket)
{
    Log::info('🔔 sendMONotification called for trip: ' . $tripTicket->trip_ticket_number);
    
    $moStaff = User::where('role', 'mayors_office')
        ->where('status', 'active')
        ->get();

    Log::info('🔔 Found ' . $moStaff->count() . ' MO staff members');

    foreach ($moStaff as $staff) {
        try {
            // ✅ Create notification in database
            $notification = Notification::create([
                'recipient_user_id' => $staff->user_id,
                'notification_type' => 'trip_created',
                'entity_type' => 'trip_ticket',
                'entity_id' => $tripTicket->trip_ticket_id,
                'message' => "Trip ticket {$tripTicket->trip_ticket_number} is ready for fund release",
                'channel' => 'in_app',
                'is_read' => false,
                'created_at' => now(),
            ]);

            Log::info('✅ Notification created for MO staff: ' . $staff->user_id . ' (ID: ' . $notification->notification_id . ')');

            // ✅ Broadcast via Reverb
            broadcast(new \App\Events\NewNotification(
                $staff->user_id,
                $notification->toArray()
            ));

            Log::info('📡 Broadcasted to MO staff: ' . $staff->user_id);

        } catch (\Exception $e) {
            Log::error('❌ Failed to send MO notification: ' . $e->getMessage());
        }
    }
}

 

/**
 * Send notification to driver who requested the trip with Reverb broadcast
 */
private function sendDriverNotification($tripTicket)
{
    Log::info('🔔 sendDriverNotification called for trip: ' . $tripTicket->trip_ticket_number);
    
    try {
        // ✅ Create notification in database
        $notification = Notification::create([
            'recipient_user_id' => $tripTicket->submitted_by,
            'notification_type' => 'trip_submitted',
            'entity_type' => 'trip_ticket',
            'entity_id' => $tripTicket->trip_ticket_id,
            'message' => "Trip ticket {$tripTicket->trip_ticket_number} has been created and sent to Mayor's Office for fund release",
            'channel' => 'in_app',
            'is_read' => false,
            'created_at' => now(),
        ]);

        Log::info('✅ Driver notification created (ID: ' . $notification->notification_id . ')');

        // ✅ Broadcast via Reverb
        broadcast(new \App\Events\NewNotification(
            $tripTicket->submitted_by,
            $notification->toArray()
        ));

        Log::info('📡 Broadcasted to driver: ' . $tripTicket->submitted_by);

    } catch (\Exception $e) {
        Log::error('❌ Failed to send driver notification: ' . $e->getMessage());
    }
    }
    // ============ HELPER METHODS ============

    /**
     * Calculate distance from config file
     */
    private function calculateDistanceFromConfig($destination)
    {
        $destinationLower = strtolower((string) $destination);
        return 30.0; // Default fallback
    }

    /**
     * Calculate estimated fuel from config
     */
    private function calculateEstimatedFuelFromConfig($vehicle, $distanceKm)
    {
        $fuelType = 'regular';
        if ($vehicle && isset($vehicle->fuel_type)) {
            if (is_string($vehicle->fuel_type)) {
                $fuelType = strtolower($vehicle->fuel_type);
            }
        }
        // Default fuel consumption rates (liters per km)
        $rates = [
            'regular' => 0.10,
            'premium' => 0.09,
            'diesel' => 0.08,
        ];
        $rate = $rates[$fuelType] ?? 0.10;
        return round($distanceKm * $rate, 1);
    }

    /**
     * Get fuel price from config
     */
    private function getFuelPriceFromConfig($fuelType)
    {
        if (is_string($fuelType)) {
            $fuelType = strtolower($fuelType);
        }
        $prices = [
            'regular' => 88.98,
            'premium' => 85.00,
            'diesel' => 88.00,
        ];
        return isset($prices[$fuelType]) ? (float) $prices[$fuelType] : 55.00;
    }

    /**
     * Get department budget
     */
    private function getDepartmentBudgetFromConfig($departmentId)
    {
        $currentPeriod = DeptBudgetPeriod::where('department_id', $departmentId)
            ->where('status', 'active')
            ->first();

        if (!$currentPeriod) {
            return [
                'allocated' => 10000.00,
                'spent' => 0.00,
                'remaining' => 10000.00,
                'has_period' => false,
            ];
        }

        $totalSpent = GasSlip::where('period_id', $currentPeriod->period_id)
            ->sum('amount_released');

        return [
            'allocated' => round((float) $currentPeriod->allocated_amount, 2),
            'spent' => round((float) $totalSpent, 2),
            'remaining' => round((float) $currentPeriod->allocated_amount - (float) $totalSpent, 2),
            'has_period' => true,
        ];
    }
}