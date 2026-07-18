<?php

namespace App\Http\Controllers;

use App\Models\DepartmentRequest;
use App\Models\Vehicle;
use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class DepartmentRequestController extends Controller
{
    /**
     * List department requests (based on role)
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = DepartmentRequest::with(['department', 'submittedBy', 'reviewedBy']);
        
        if ($user->isSuperAdmin()) {
            // Superadmin sees all pending requests
            $query->pending();
        } elseif ($user->isDeptOffice() || $user->isDeptHead()) {
            // Department users see their department's requests
            $query->where('department_id', $user->department_id);
        } else {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $requests = $query->orderBy('submitted_at', 'desc')->paginate(15);
        
        return response()->json($requests);
    }
    
    /**
     * Create a department request
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'request_type' => 'required|in:vehicle_breakdown,vehicle_repaired,odometer_non_functional,odometer_restored,new_vehicle_registration,driver_activation,driver_deactivation,other',
            'affected_vehicle_id' => 'required_if:request_type,vehicle_breakdown,vehicle_repaired,odometer_non_functional,odometer_restored|exists:vehicles,vehicle_id',
            'affected_driver_id' => 'required_if:request_type,driver_activation,driver_deactivation|exists:drivers,driver_id',
            'date_noticed' => 'nullable|date',
            'reason' => 'required|string',
            'attachment' => 'nullable|file|max:10240' // 10MB max
        ]);
        
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $user = $request->user();
        
        if (!$user->isDeptOffice() && !$user->isDeptHead()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('department_requests', 'public');
        }
        
        $departmentRequest = DepartmentRequest::create([
            'department_id' => $user->department_id,
            'submitted_by' => $user->user_id,
            'request_type' => $request->request_type,
            'affected_vehicle_id' => $request->affected_vehicle_id,
            'affected_driver_id' => $request->affected_driver_id,
            'date_noticed' => $request->date_noticed,
            'reason' => $request->reason,
            'attachment_path' => $attachmentPath,
            'status' => DepartmentRequest::STATUS_PENDING_SUPERADMIN
        ]);
        
        return response()->json([
            'message' => 'Request submitted successfully',
            'request' => $departmentRequest
        ], 201);
    }
    
    /**
     * Superadmin approves a request
     */
    public function approve(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'note' => 'nullable|string'
        ]);
        
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $departmentRequest = DepartmentRequest::findOrFail($id);
        $user = $request->user();
        
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        if (!$departmentRequest->isPending()) {
            return response()->json(['message' => 'Request already processed'], 400);
        }
        
        DB::beginTransaction();
        
        try {
            $departmentRequest->approve($user->user_id, $request->note);
            
            // Perform the actual action based on request type
            $this->executeApprovedAction($departmentRequest);
            
            DB::commit();
            
            return response()->json([
                'message' => 'Request approved successfully',
                'request' => $departmentRequest
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to approve request', 'error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Superadmin rejects a request
     */
    public function reject(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'note' => 'required|string'
        ]);
        
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $departmentRequest = DepartmentRequest::findOrFail($id);
        $user = $request->user();
        
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        if (!$departmentRequest->isPending()) {
            return response()->json(['message' => 'Request already processed'], 400);
        }
        
        $departmentRequest->reject($user->user_id, $request->note);
        
        return response()->json([
            'message' => 'Request rejected',
            'request' => $departmentRequest
        ]);
    }
    
    private function executeApprovedAction(DepartmentRequest $request)
    {
        switch ($request->request_type) {
            case DepartmentRequest::TYPE_VEHICLE_BREAKDOWN:
                Vehicle::where('vehicle_id', $request->affected_vehicle_id)
                    ->update(['status' => Vehicle::STATUS_INACTIVE]);
                break;
                
            case DepartmentRequest::TYPE_VEHICLE_REPAIRED:
                Vehicle::where('vehicle_id', $request->affected_vehicle_id)
                    ->update(['status' => Vehicle::STATUS_ACTIVE]);
                break;
                
            case DepartmentRequest::TYPE_ODOMETER_NON_FUNCTIONAL:
                Vehicle::where('vehicle_id', $request->affected_vehicle_id)
                    ->update(['odometer_status' => Vehicle::ODOMETER_NON_FUNCTIONAL]);
                break;
                
            case DepartmentRequest::TYPE_ODOMETER_RESTORED:
                Vehicle::where('vehicle_id', $request->affected_vehicle_id)
                    ->update(['odometer_status' => Vehicle::ODOMETER_FUNCTIONAL]);
                break;
                
            case DepartmentRequest::TYPE_DRIVER_ACTIVATION:
                Driver::where('driver_id', $request->affected_driver_id)
                    ->update(['status' => Driver::STATUS_ACTIVE]);
                break;
                
            case DepartmentRequest::TYPE_DRIVER_DEACTIVATION:
                Driver::where('driver_id', $request->affected_driver_id)
                    ->update(['status' => Driver::STATUS_INACTIVE]);
                break;
        }
    }
}