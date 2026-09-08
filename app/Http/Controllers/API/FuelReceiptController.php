<?php

namespace App\Http\Controllers\API;  // ✅ Should be in API namespace
use App\Http\Controllers\Controller;  // ✅ Import base Controller


use App\Models\FuelReceipt;
use App\Models\GasSlip;
use App\Models\TripTicket;
use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class FuelReceiptController extends Controller  
{
    /**
     * Upload receipt photo 
     *
     */
    public function uploadReceipt(Request $request, $gasSlipId)
    {
        $validator = Validator::make($request->all(), [
            'receipt_photo' => 'required|image|max:5120', 
            'liters_availed' => 'required|numeric|min:0.01',
            'amount_on_receipt' => 'required|numeric|min:0.01',
            'odometer_start' => 'nullable|integer|min:0',  
            'odometer_end' => 'nullable|integer|min:0',    
        ]);
        
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $gasSlip = GasSlip::findOrFail($gasSlipId);
        $tripTicket = $gasSlip->tripTicket;
        $user = $request->user();
        
        // Verify user is the assigned driver
        $driver = Driver::where('user_id', $user->user_id)->first();
        if (!$driver || $tripTicket->driver_id !== $driver->driver_id) {
            return response()->json(['message' => 'Unauthorized - not the assigned driver'], 403);
        }
        
        // Check if trip is in progress
        if ($tripTicket->status !== TripTicket::STATUS_IN_TRANSIT) {
            return response()->json(['message' => 'Trip is not in progress'], 400);
        }
        
        DB::beginTransaction();
        
        try {
            // Store the receipt photo
            $photoPath = $request->file('receipt_photo')->store('receipts', 'public');
            
            // Create or update fuel receipt  
            $fuelReceipt = FuelReceipt::updateOrCreate( 
                ['gas_slip_id' => $gasSlipId],
                [
                    'liters_availed' => $request->liters_availed,
                    'amount_on_receipt' => $request->amount_on_receipt,
                    'receipt_photo_path' => $photoPath,
                    'receipt_uploaded_at' => now(),
                    'odometer_start' => $request->odometer_start, 
                    'odometer_end' => $request->odometer_end,     
                    'has_movement_flag' => $request->has('has_movement_flag') ? $request->has_movement_flag : false,
                ]
            );
            
            DB::commit();
            
            return response()->json([
                'message' => 'Receipt uploaded successfully',
                'fuel_receipt' => $fuelReceipt,  // ✅ Changed
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            // Delete uploaded file if exists
            if (isset($photoPath)) {
                Storage::disk('public')->delete($photoPath);
            }
            return response()->json(['message' => 'Failed to upload receipt', 'error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Update fuel receipt data (after upload)  // ✅ Changed comment
     * PUT /api/fuel-receipts/{gasSlipId}
     */
    public function update(Request $request, $gasSlipId)
    {
        $validator = Validator::make($request->all(), [
            'liters_availed' => 'sometimes|numeric|min:0.01',
            'amount_on_receipt' => 'sometimes|numeric|min:0.01',
            'odometer_start' => 'nullable|integer|min:0',  // ✅ Fixed field
            'odometer_end' => 'nullable|integer|min:0',    // ✅ Fixed field
        ]);
        
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlipId)->firstOrFail();  // ✅ Changed
        $tripTicket = $fuelReceipt->gasSlip->tripTicket;  // ✅ Changed
        $user = $request->user();
        
        // Verify user is the assigned driver
        $driver = Driver::where('user_id', $user->user_id)->first();
        if (!$driver || $tripTicket->driver_id !== $driver->driver_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        // Check if receipt is uploaded (gate passed)
        if (!$fuelReceipt->receipt_photo_path) {  // ✅ Changed method
            return response()->json(['message' => 'Receipt must be uploaded first'], 400);
        }
        
        $fuelReceipt->update($request->only([  // ✅ Changed
            'liters_availed',
            'amount_on_receipt',
            'odometer_start',
            'odometer_end'
        ]));
        
        return response()->json([
            'message' => 'Fuel receipt updated successfully',  // ✅ Changed
            'fuel_receipt' => $fuelReceipt,  // ✅ Changed
        ]);
    }
    
    /**
     * Get fuel receipt for a gas slip  // ✅ Changed comment
     * GET /api/fuel-receipts/{gasSlipId}
     */
    public function show($gasSlipId)
    {
        $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlipId)  // ✅ Changed
            ->with('gasSlip.tripTicket')
            ->first();
        
        if (!$fuelReceipt) {  // ✅ Changed
            return response()->json(['message' => 'Fuel receipt not found'], 404);  // ✅ Changed
        }
        
        // Add computed metrics from view (if exists)
        $computedData = DB::table('v_fuel_receipt_computed')  // ✅ Changed view name
            ->where('gas_slip_id', $gasSlipId)
            ->first();
        
        $fuelReceipt->computed_metrics = $computedData;  // ✅ Changed
        
        return response()->json($fuelReceipt);  // ✅ Changed
    }
}