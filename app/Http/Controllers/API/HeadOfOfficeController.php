<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\TripTicket;
use App\Models\HeadApproval;
use App\Models\Department;
use App\Models\User;
use App\Models\OicDesignation;
use App\Models\Notification;
use App\Models\Vehicle;
use App\Models\Driver;
use App\Models\DeptBudgetPeriod;
use App\Models\GasSlip;


use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class HeadOfOfficeController extends Controller
{
    /**
     * Get dashboard statistics for Head of Office
     */
    public function getDashboard(Request $request)
    {
        $user = $request->user();

        if (!$user->isDeptHead() && !$user->isOIC()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $department = $user->getManagedDepartment();
        if (!$department) {
            return response()->json(['message' => 'No department managed'], 404);
        }

        // ✅ ADD BUDGET INFORMATION
        $budgetInfo = [
            'remaining' => 0,
            'allocated' => 0,
            'utilization' => 0,
        ];

        $currentPeriod = DeptBudgetPeriod::where('department_id', $department->department_id)
            ->where('status', 'active')
            ->first();

        if ($currentPeriod) {
            $totalSpent = GasSlip::where('period_id', $currentPeriod->period_id)
                ->whereNotNull('acknowledged_at')
                ->sum('amount_released');

            $budgetInfo['allocated'] = $currentPeriod->allocated_amount;
            $budgetInfo['remaining'] = $currentPeriod->allocated_amount - $totalSpent;
            $budgetInfo['utilization'] = $currentPeriod->allocated_amount > 0
                ? round(($totalSpent / $currentPeriod->allocated_amount) * 100, 1)
                : 0;
        }

        $stats = [
            'pending_approval' => TripTicket::where('department_id', $department->department_id)
                ->where('status', TripTicket::STATUS_PENDING_HEAD_APPROVAL)
                ->count(),
            'approved' => TripTicket::where('department_id', $department->department_id)
                ->where('status', TripTicket::STATUS_PENDING_GSO_REVIEW)
                ->count(),
            'in_transit' => TripTicket::where('department_id', $department->department_id)
                ->where('status', TripTicket::STATUS_IN_TRANSIT)
                ->count(),
            'completed' => TripTicket::where('department_id', $department->department_id)
                ->where('status', TripTicket::STATUS_CLOSED)
                ->count(),
            'rejected' => TripTicket::where('department_id', $department->department_id)
                ->where('status', TripTicket::STATUS_RETURNED_FOR_REVISION)
                ->count(),
            // ✅ NEW: Count tickets with insufficient budget warning
            'has_insufficient_budget' => TripTicket::where('department_id', $department->department_id)
                ->where('status', TripTicket::STATUS_PENDING_HEAD_APPROVAL)
                ->where('has_insufficient_budget', true)
                ->count(),

            'department_budget' => max(0, $budgetInfo['remaining']),
            'budget_allocated' => $budgetInfo['allocated'],
            'budget_utilization' => $budgetInfo['utilization'],
        ];

        // Get recent pending tickets with driver info and budget warning
        $recentTickets = TripTicket::with(['vehicle', 'driver.user', 'submittedBy'])
            ->where('department_id', $department->department_id)
            ->where('status', TripTicket::STATUS_PENDING_HEAD_APPROVAL)
            ->orderBy('submitted_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($ticket) {
                $driverName = null;
                if ($ticket->driver && $ticket->driver->user) {
                    $user = $ticket->driver->user;
                    $driverName = trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? ''));
                }

                return [
                    'id' => $ticket->trip_ticket_id,
                    'ticket_number' => $ticket->trip_ticket_number,
                    'destination' => $ticket->destination,
                    'driver_name' => $driverName,
                    // ✅ NEW: Budget warning fields
                    'has_insufficient_budget' => $ticket->has_insufficient_budget,
                    'budget_shortage' => $ticket->budget_shortage,
                ];
            });

        return response()->json([
            'success' => true,
            'department' => [
                'id' => $department->department_id,
                'name' => $department->department_name,
                'code' => $department->department_code,
            ],
            'stats' => $stats,
            'recent_tickets' => $recentTickets,
            'is_oic' => $user->isOIC(),
            'head_status' => $this->getHeadStatus($department->department_id),
        ]);
    }
    /**
     * Get pending trip tickets for Head approval - WITH BUDGET WARNING
     */
    public function getPendingTickets(Request $request)
    {
        $user = $request->user();

        // Check if user is Department Head or OIC
        if (!$user->isDeptHead() && !$user->isOIC()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get department where user is Head or OIC
        $department = $user->getManagedDepartment();
        if (!$department) {
            return response()->json(['message' => 'No department managed'], 404);
        }

        $pendingTickets = TripTicket::with(['vehicle', 'submittedBy', 'driver.user'])
            ->where('department_id', $department->department_id)
            ->where('status', TripTicket::STATUS_PENDING_HEAD_APPROVAL)
            ->orderBy('submitted_at', 'asc')
            ->get()
            ->map(function ($ticket) {
                // Build driver full name
                $driverName = null;
                if ($ticket->driver && $ticket->driver->user) {
                    $user = $ticket->driver->user;
                    $driverName = trim(
                        ($user->first_name ?? '') . ' ' .
                            ($user->middle_name ? $user->middle_name . ' ' : '') .
                            ($user->last_name ?? '')
                    );
                    if (empty($driverName)) {
                        $driverName = $user->email ?? 'Unknown';
                    }
                }

                // Build requester full name
                $requesterName = null;
                if ($ticket->submittedBy) {
                    $requester = $ticket->submittedBy;
                    $requesterName = trim(
                        ($requester->first_name ?? '') . ' ' .
                            ($requester->middle_name ? $requester->middle_name . ' ' : '') .
                            ($requester->last_name ?? '')
                    );
                    if (empty($requesterName)) {
                        $requesterName = $requester->email ?? 'Unknown';
                    }
                }

                return [
                    'id' => $ticket->trip_ticket_id,
                    'ticket_number' => $ticket->trip_ticket_number,
                    'trip_date' => $ticket->trip_date,
                    'destination' => $ticket->destination,
                    'purpose' => $ticket->purpose,
                    'charge_to' => $ticket->charge_to,
                    'passenger_name' => $ticket->passenger_name,
                    'submitted_at' => $ticket->submitted_at,
                    // ✅ NEW: Budget warning fields
                    'has_insufficient_budget' => $ticket->has_insufficient_budget ?? false,
                    'budget_shortage' => $ticket->budget_shortage ?? 0,
                    'original_department_id' => $ticket->original_department_id ?? $ticket->department_id,
                    'vehicle' => $ticket->vehicle ? [
                        'plate_number' => $ticket->vehicle->plate_number,
                        'vehicle_model' => $ticket->vehicle->vehicle_model,
                    ] : null,
                    'driver' => $driverName ? ['full_name' => $driverName] : null,
                    'requester' => $requesterName ? ['full_name' => $requesterName] : null,
                ];
            });

        return response()->json([
            'success' => true,
            'department' => [
                'id' => $department->department_id,
                'name' => $department->department_name,
                'code' => $department->department_code,
            ],
            'pending_count' => $pendingTickets->count(),
            'tickets' => $pendingTickets
        ]);
    }


    /**
     * Approve a trip ticket
     */
    public function approveTicket(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'note' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();

        if (!$user->canApproveDepartmentTickets()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tripTicket = TripTicket::where('trip_ticket_id', $id)
            ->where('status', TripTicket::STATUS_PENDING_HEAD_APPROVAL)
            ->first();

        if (!$tripTicket) {
            return response()->json(['message' => 'Trip ticket not found or already processed'], 404);
        }

        $department = $user->getManagedDepartment();
        if (!$department || $tripTicket->department_id !== $department->department_id) {
            return response()->json(['message' => 'Unauthorized - not your department'], 403);
        }

        DB::beginTransaction();

        try {
            $lastCycle = HeadApproval::where('trip_ticket_id', $id)->max('review_cycle') ?? 0;
            $reviewCycle = $lastCycle + 1;

            $headApproval = HeadApproval::create([
                'trip_ticket_id' => $id,
                'review_cycle' => $reviewCycle,
                'approved_by' => $user->user_id,
                'is_oic_action' => $user->isOIC(),
                'decision' => HeadApproval::DECISION_APPROVED,
                'review_note' => $request->note,
                'reviewed_at' => now(),
            ]);

            $tripTicket->status = TripTicket::STATUS_PENDING_GSO_REVIEW;
            $tripTicket->save();

            DB::commit();

            $this->sendGsoNotification($tripTicket);

            return response()->json([
                'success' => true,
                'message' => 'Trip ticket approved successfully',
                'data' => [
                    'id' => $tripTicket->trip_ticket_id,
                    'number' => $tripTicket->trip_ticket_number,
                    'status' => $tripTicket->status,
                    'approval' => $headApproval,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Head approve error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to approve ticket: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject a trip ticket
     */
    public function rejectTicket(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'note' => 'required|string|min:5|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();

        if (!$user->canApproveDepartmentTickets()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tripTicket = TripTicket::where('trip_ticket_id', $id)
            ->where('status', TripTicket::STATUS_PENDING_HEAD_APPROVAL)
            ->first();

        if (!$tripTicket) {
            return response()->json(['message' => 'Trip ticket not found or already processed'], 404);
        }

        $department = $user->getManagedDepartment();
        if (!$department || $tripTicket->department_id !== $department->department_id) {
            return response()->json(['message' => 'Unauthorized - not your department'], 403);
        }

        DB::beginTransaction();

        try {
            $lastCycle = HeadApproval::where('trip_ticket_id', $id)->max('review_cycle') ?? 0;
            $reviewCycle = $lastCycle + 1;

            $headApproval = HeadApproval::create([
                'trip_ticket_id' => $id,
                'review_cycle' => $reviewCycle,
                'approved_by' => $user->user_id,
                'is_oic_action' => $user->isOIC(),
                'decision' => HeadApproval::DECISION_REJECTED,
                'review_note' => $request->note,
                'reviewed_at' => now(),
            ]);

            $tripTicket->status = TripTicket::STATUS_RETURNED_FOR_REVISION;
            $tripTicket->save();

            DB::table('trip_ticket_return')->insert([
                'trip_ticket_id' => $id,
                'return_type' => 'rejected_by_head',
                'return_note' => $request->note,
                'actioned_by' => $user->user_id,
                'actioned_at' => now(),
            ]);

            DB::commit();

            $this->sendRejectionNotification($tripTicket, $request->note);

            return response()->json([
                'success' => true,
                'message' => 'Trip ticket rejected. Reason sent to department office.',
                'data' => [
                    'id' => $tripTicket->trip_ticket_id,
                    'number' => $tripTicket->trip_ticket_number,
                    'status' => $tripTicket->status,
                    'approval' => $headApproval,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Head reject error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to reject ticket: ' . $e->getMessage()
            ], 500);
        }
    }


    /**
     * Toggle Head status (Active/Inactive) - for OIC activation
     */
    public function toggleHeadStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:active,inactive',
            'reason' => 'required_if:status,inactive|string|nullable'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();

        if (!$user->isDeptHead()) {
            return response()->json(['message' => 'Only Department Head can toggle status'], 403);
        }

        $designation = OicDesignation::where('head_of_office_id', $user->user_id)
            ->where('is_active', true)
            ->first();

        if (!$designation) {
            return response()->json(['message' => 'No department assigned as Head of Office'], 404);
        }

        DB::beginTransaction();

        $user->head_active_status = $request->status;
        $user->save();

        // ✅ FIXED: Update oic_designation instead of oic_delegation_log
        DB::table('oic_designation')
            ->where('designation_id', $designation->designation_id)
            ->update([
                'reason' => $request->status === 'inactive' ? 'head_inactive' : 'head_active',
                'reason_details' => $request->reason,
            ]);

        if ($request->status === 'inactive' && $designation->head_of_office_id != $designation->oic_user_id) {
            $oicUser = User::find($designation->oic_user_id);
            if ($oicUser) {
                Notification::create([
                    'recipient_user_id' => $oicUser->user_id,
                    'notification_type' => 'oic_activated',
                    'entity_type' => 'oic_designation',
                    'entity_id' => $designation->designation_id,
                    'message' => 'You have been activated as Officer-in-Charge',
                    'channel' => 'in_app',
                    'created_at' => now(),
                ]);
            }
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => $request->status === 'active'
                ? 'You are now active. OIC privileges have been revoked.'
                : 'You are now inactive. OIC can now approve tickets.',
            'head_status' => $request->status,
            'oic_user_id' => $designation->oic_user_id,
            'has_oic' => $designation->head_of_office_id != $designation->oic_user_id,
        ]);
    }

    /**
     * Get OIC status and information
     */
    public function getOicStatus(Request $request)
    {
        // Keep your existing implementation
        $user = $request->user();

        if (!$user->isDeptHead() && !$user->isOIC()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $designation = OicDesignation::where(function ($query) use ($user) {
            $query->where('head_of_office_id', $user->user_id)
                ->orWhere('oic_user_id', $user->user_id);
        })
            ->where('is_active', true)
            ->first();

        if (!$designation) {
            return response()->json([
                'has_oic' => false,
                'head_status' => 'inactive',
                'can_approve' => false,
            ]);
        }

        $department = Department::find($designation->department_id);
        $headUser = User::find($designation->head_of_office_id);
        $oicUser = User::find($designation->oic_user_id);

        $isHeadActive = $headUser && $headUser->head_active_status === 'active';
        $hasDifferentOic = $designation->head_of_office_id != $designation->oic_user_id;

        return response()->json([
            'head_status' => $isHeadActive ? 'active' : 'inactive',
            'has_oic' => $hasDifferentOic && !$isHeadActive,
            'oic' => ($hasDifferentOic && !$isHeadActive && $oicUser) ? [
                'id' => $oicUser->user_id,
                'name' => $oicUser->full_name,
                'email' => $oicUser->email,
            ] : null,
            'can_approve' => $user->canApproveDepartmentTickets(),
            'department' => $department ? [
                'id' => $department->department_id,
                'name' => $department->department_name,
                'code' => $department->department_code,
            ] : null,
        ]);
    }

    /**
     * Get active trips for real-time monitoring
     */
    public function getActiveTrips(Request $request)
    {
        // Keep your existing implementation
        try {
            $user = $request->user();

            if (!$user->isDeptHead() && !$user->isOIC()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $department = $user->getManagedDepartment();
            if (!$department) {
                return response()->json([]);
            }

            $activeTrips = TripTicket::with(['vehicle', 'driver.user'])
                ->where('department_id', $department->department_id)
                ->where('status', TripTicket::STATUS_IN_TRANSIT)
                ->get()
                ->map(function ($trip) {
                    return [
                        'id' => $trip->trip_ticket_id,
                        'ticket_number' => $trip->trip_ticket_number,
                        'destination' => $trip->destination,
                        'status' => $trip->status,
                        'vehicle' => $trip->vehicle ? [
                            'plate_number' => $trip->vehicle->plate_number,
                        ] : null,
                        'driver' => $trip->driver && $trip->driver->user ? [
                            'full_name' => $trip->driver->user->full_name,
                        ] : null,
                    ];
                });

            return response()->json($activeTrips);
        } catch (\Exception $e) {
            Log::error('GetActiveTrips error: ' . $e->getMessage());
            return response()->json([]);
        }
    }

    /**
     * Get fuel consumption overview for the department
     */
    public function getFuelConsumption(Request $request)
    {
        // Keep your existing implementation
        try {
            $user = $request->user();

            if (!$user->isDeptHead() && !$user->isOIC()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $department = $user->getManagedDepartment();
            if (!$department) {
                return response()->json([
                    'total_liters' => 0,
                    'total_cost' => 0,
                    'trip_count' => 0,
                    'budget_utilization' => 0,
                    'weekly_allocation' => 0
                ]);
            }

            $fuelData = DB::table('fuel_log as fl')
                ->join('gas_slip as gs', 'fl.gas_slip_id', '=', 'gs.gas_slip_id')
                ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
                ->where('tt.department_id', $department->department_id)
                ->whereNotNull('fl.liters_availed')
                ->select(
                    DB::raw('SUM(fl.liters_availed) as total_liters'),
                    DB::raw('SUM(fl.amount_on_receipt) as total_cost'),
                    DB::raw('COUNT(DISTINCT tt.trip_ticket_id) as trip_count')
                )
                ->first();

            $currentPeriod = DB::table('dept_budget_period')
                ->where('department_id', $department->department_id)
                ->where('status', 'active')
                ->first();

            $totalCost = $fuelData->total_cost ?? 0;
            $weeklyAllocation = $currentPeriod->allocated_amount ?? 0;
            $budgetUtilization = $weeklyAllocation > 0 ? round(($totalCost / $weeklyAllocation) * 100) : 0;

            return response()->json([
                'total_liters' => round($fuelData->total_liters ?? 0, 2),
                'total_cost' => $totalCost,
                'trip_count' => $fuelData->trip_count ?? 0,
                'budget_utilization' => min(100, $budgetUtilization),
                'weekly_allocation' => $weeklyAllocation,
                'remaining_budget' => max(0, $weeklyAllocation - $totalCost),
            ]);
        } catch (\Exception $e) {
            Log::error('GetFuelConsumption error: ' . $e->getMessage());
            return response()->json([
                'total_liters' => 0,
                'total_cost' => 0,
                'trip_count' => 0,
                'budget_utilization' => 0,
                'weekly_allocation' => 0,
                'remaining_budget' => 0,
            ]);
        }
    }

    /**
     * Get head status for a department
     */
    private function getHeadStatus($departmentId)
    {
        $designation = OicDesignation::where('department_id', $departmentId)
            ->where('is_active', true)
            ->first();

        if (!$designation) {
            return 'inactive';
        }

        $headUser = User::find($designation->head_of_office_id);
        return ($headUser && $headUser->head_active_status === 'active') ? 'active' : 'inactive';
    }

    /**
     * Send notification to GSO
     */
    private function sendGsoNotification($tripTicket)
    {
        $gsoStaff = User::where('role', 'gso_staff')
            ->where('status', 'active')
            ->get();

        foreach ($gsoStaff as $staff) {
            Notification::create([
                'recipient_user_id' => $staff->user_id,
                'notification_type' => 'trip_submitted',
                'entity_type' => 'trip_ticket',
                'entity_id' => $tripTicket->trip_ticket_id,
                'message' => "Trip ticket {$tripTicket->trip_ticket_number} is ready for GSO review",
                'channel' => 'in_app',
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Send rejection notification to department office
     */
    private function sendRejectionNotification($tripTicket, $reason)
    {
        $deptOffice = User::find($tripTicket->submitted_by);

        if ($deptOffice) {
            Notification::create([
                'recipient_user_id' => $deptOffice->user_id,
                'notification_type' => 'head_rejected',
                'entity_type' => 'trip_ticket',
                'entity_id' => $tripTicket->trip_ticket_id,
                'message' => "Trip ticket {$tripTicket->trip_ticket_number} was rejected: {$reason}",
                'channel' => 'in_app',
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Get available vehicles for Head's department
     */
    public function getAvailableVehicles(Request $request)
    {
        $user = $request->user();
        $department = $user->getManagedDepartment();

        if (!$department) {
            return response()->json(['data' => []]);
        }

        $vehicles = Vehicle::where('department_id', $department->department_id)
            ->where('status', 'active')
            ->where('maintenance_flag', false)
            ->get();

        return response()->json(['data' => $vehicles]);
    }

    /**
     * Get active drivers for Head's department
     */
    public function getActiveDrivers(Request $request)
    {
        try {
            $user = $request->user();
            $department = $user->getManagedDepartment();

            if (!$department) {
                return response()->json(['data' => []]);
            }

            $departmentId = $request->input('department_id', $department->department_id);

            $drivers = Driver::with('user')
                ->whereHas('user', function ($query) use ($departmentId) {
                    $query->where('department_id', $departmentId);
                })
                ->where('status', 'active')
                ->get()
                ->map(function ($driver) {
                    $fullName = 'Unknown Driver';
                    if ($driver->user) {
                        $parts = [];
                        if ($driver->user->first_name) $parts[] = $driver->user->first_name;
                        if ($driver->user->middle_name) $parts[] = $driver->user->middle_name;
                        if ($driver->user->last_name) $parts[] = $driver->user->last_name;
                        $fullName = !empty($parts) ? implode(' ', $parts) : $driver->user->email;
                    }

                    return [
                        'driver_id' => $driver->driver_id,
                        'full_name' => $fullName,
                        'status' => $driver->status,
                        'user' => $driver->user ? [
                            'user_id' => $driver->user->user_id,
                            'email' => $driver->user->email,
                            'first_name' => $driver->user->first_name,
                            'last_name' => $driver->user->last_name,
                        ] : null,
                    ];
                });

            return response()->json(['data' => $drivers]);
        } catch (\Exception $e) {
            Log::error('GetActiveDrivers error: ' . $e->getMessage());
            return response()->json(['data' => []]);
        }
    }
}
