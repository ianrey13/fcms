<?php

namespace App\Http\Controllers;

use App\Models\GasSlip;
use App\Models\FuelLog;
use App\Models\TripTicket;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ReconciliationController extends Controller
{
    /**
     * Get pending reconciliation items for MO
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        if (!$user->isMayorsOffice() && !$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $gasSlips = GasSlip::with([
            'tripTicket' => function($q) {
                $q->with(['department', 'driver.user', 'vehicle', 'gsoVerifications.verifiedBy']);
            },
            'fuelLog',
            'fundIssuance'
        ])->pendingReconciliation()
          ->whereHas('tripTicket', function($q) {
              $q->where('status', TripTicket::STATUS_PENDING_RECONCILIATION);
          })
          ->orderBy('created_at', 'desc')
          ->paginate(15);
        
        return response()->json($gasSlips);
    }
    
    /**
     * Get reconciliation details for a specific gas slip
     */
    public function show($id)
    {
        $gasSlip = GasSlip::with([
            'tripTicket' => function($q) {
                $q->with([
                    'department',
                    'driver.user',
                    'vehicle',
                    'deptOfficeUser',
                    'gsoVerifications.verifiedBy',
                    'moReviews.reviewedBy',
                    'gpsDistanceResult'
                ]);
            },
            'fuelLog',
            'fundIssuance' => function($q) {
                $q->with(['issuedBy', 'acknowledgedBy', 'budgetPeriod']);
            }
        ])->findOrFail($id);
        
        // Add computed data from view
        $computedData = DB::table('v_fuel_log_computed')
            ->where('gas_slip_id', $id)
            ->first();
        
        $gasSlip->computed_data = $computedData;
        
        return response()->json($gasSlip);
    }
    
    /**
     * Verify reconciliation (no discrepancy)
     */
    public function verify(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'note' => 'nullable|string'
        ]);
        
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $gasSlip = GasSlip::findOrFail($id);
        $user = $request->user();
        
        if (!$user->isMayorsOffice() && !$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        if (!$gasSlip->isPending()) {
            return response()->json(['message' => 'Reconciliation already processed'], 400);
        }
        
        DB::beginTransaction();
        
        try {
            $gasSlip->verify($user->user_id, $request->note);
            
            // Close the trip ticket
            $tripTicket = $gasSlip->tripTicket;
            $tripTicket->status = TripTicket::STATUS_CLOSED;
            $tripTicket->save();
            
            // Send notification to driver
            $this->sendReconciliationClosedNotification($tripTicket);
            
            DB::commit();
            
            return response()->json([
                'message' => 'Reconciliation verified and trip closed',
                'gas_slip' => $gasSlip
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to verify reconciliation', 'error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Mark discrepancy in reconciliation
     */
    public function markDiscrepancy(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'note' => 'required|string'
        ]);
        
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $gasSlip = GasSlip::findOrFail($id);
        $user = $request->user();
        
        if (!$user->isMayorsOffice() && !$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        if (!$gasSlip->isPending()) {
            return response()->json(['message' => 'Reconciliation already processed'], 400);
        }
        
        DB::beginTransaction();
        
        try {
            $gasSlip->markDiscrepancy($user->user_id, $request->note);
            
            DB::commit();
            
            return response()->json([
                'message' => 'Discrepancy recorded - further investigation required',
                'gas_slip' => $gasSlip
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to record discrepancy', 'error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Acknowledge receipt return (physical handover)
     */
    public function acknowledgeReceipt(Request $request, $id)
    {
        $gasSlip = GasSlip::findOrFail($id);
        $user = $request->user();
        
        if (!$user->isMayorsOffice() && !$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        if ($gasSlip->isReceiptAcknowledged()) {
            return response()->json(['message' => 'Receipt already acknowledged'], 400);
        }
        
        $gasSlip->acknowledgeReceipt($user->user_id);
        
        return response()->json([
            'message' => 'Receipt acknowledged successfully',
            'gas_slip' => $gasSlip
        ]);
    }
    
    private function sendReconciliationClosedNotification(TripTicket $tripTicket)
    {
        $driver = $tripTicket->driver;
        Notification::create([
            'recipient_user_id' => $driver->user_id,
            'notification_type' => Notification::TYPE_RECONCILIATION_CLOSED,
            'entity_type' => Notification::ENTITY_TRIP_TICKET,
            'entity_id' => $tripTicket->trip_ticket_id,
            'message' => "Trip ticket {$tripTicket->trip_ticket_number} has been closed",
            'channel' => Notification::CHANNEL_IN_APP
        ]);
    }
}