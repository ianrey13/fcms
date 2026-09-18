<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\FuelReceipt;
use App\Models\GasSlip;
use App\Models\TripTicket;
use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class FuelReceiptController extends Controller
{
    /**
     * Upload receipt photo + fuel data (driver-initiated)
     * POST /api/fuel-receipts/{gasSlipId}
     */
    public function uploadReceipt(Request $request, $gasSlipId)
    {
        // ✅ Removed odometer_* and has_movement_flag — not DB columns anymore
        $validator = Validator::make($request->all(), [
            'receipt_photo'      => 'required|image|max:5120',
            'liters_availed'     => 'required|numeric|min:0.01',
            'amount_on_receipt'  => 'required|numeric|min:0.01',
            'unit_price'         => 'nullable|numeric|min:0.01',
            'invoice_number'     => 'nullable|string|max:50',
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

        // ✅ Cap check: amount ≤ released
        if ($request->amount_on_receipt > $gasSlip->amount_released) {
            return response()->json([
                'success' => false,
                'message' => sprintf(
                    'Receipt amount ₱%s exceeds released amount ₱%s.',
                    number_format($request->amount_on_receipt, 2),
                    number_format($gasSlip->amount_released, 2)
                ),
            ], 422);
        }

        DB::beginTransaction();

        try {
            // ✅ Save to public/receipts/ (matches GSO + MO + driver upload)
            $file = $request->file('receipt_photo');
            $filename = 'receipt_' . time() . '_' . $gasSlipId . '.' . $file->getClientOriginalExtension();
            $file->move(public_path('receipts'), $filename);
            $photoPath = 'receipts/' . $filename;

            $fuelReceipt = FuelReceipt::updateOrCreate(
                ['gas_slip_id' => $gasSlipId],
                [
                    'liters_availed'      => $request->liters_availed,
                    'amount_on_receipt'   => $request->amount_on_receipt,
                    'unit_price'          => $request->unit_price
                        ?: round($request->amount_on_receipt / max($request->liters_availed, 0.01), 2),
                    'invoice_number'      => $request->invoice_number,
                    'receipt_photo_path'  => $photoPath,
                    'receipt_uploaded_at' => now(),
                    'updated_at'          => now(),
                ]
            );

            // ✅ Sync actuals on parent trip
            $tripTicket->syncActuals()->save();

            DB::commit();

            return response()->json([
                'message'      => 'Receipt uploaded successfully',
                'fuel_receipt' => $fuelReceipt,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Fuel receipt upload error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to upload receipt',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update fuel receipt data (after upload)
     * PUT /api/fuel-receipts/{gasSlipId}
     */
    public function update(Request $request, $gasSlipId)
    {
        // ✅ Removed odometer_* — not DB columns anymore
        $validator = Validator::make($request->all(), [
            'liters_availed'     => 'sometimes|numeric|min:0.01',
            'amount_on_receipt'  => 'sometimes|numeric|min:0.01',
            'unit_price'         => 'sometimes|numeric|min:0.01',
            'invoice_number'     => 'sometimes|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlipId)->firstOrFail();
        $tripTicket = $fuelReceipt->gasSlip->tripTicket;
        $user = $request->user();

        // Verify user is the assigned driver
        $driver = Driver::where('user_id', $user->user_id)->first();
        if (!$driver || $tripTicket->driver_id !== $driver->driver_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!$fuelReceipt->receipt_photo_path) {
            return response()->json(['message' => 'Receipt must be uploaded first'], 400);
        }

        $fuelReceipt->update($request->only([
            'liters_availed',
            'amount_on_receipt',
            'unit_price',
            'invoice_number',
        ]));

        // ✅ Sync actuals on parent trip
        $tripTicket->syncActuals()->save();

        return response()->json([
            'message'      => 'Fuel receipt updated successfully',
            'fuel_receipt' => $fuelReceipt,
        ]);
    }

    /**
     * Get fuel receipt for a gas slip
     * GET /api/fuel-receipts/{gasSlipId}
     */
    public function show($gasSlipId)
    {
        $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlipId)
            ->with('gasSlip.tripTicket')
            ->first();

        if (!$fuelReceipt) {
            return response()->json(['message' => 'Fuel receipt not found'], 404);
        }

        // ✅ Removed v_fuel_receipt_computed — view doesn't exist
        // Compute efficiency inline instead
        $fuelReceipt->computed_metrics = [
            'liters_availed'    => $fuelReceipt->liters_availed,
            'amount_on_receipt' => $fuelReceipt->amount_on_receipt,
            'unit_price'        => $fuelReceipt->unit_price,
            'gps_distance_km'   => $fuelReceipt->gps_distance_km,
            'km_per_liter'      => $fuelReceipt->gps_distance_km && $fuelReceipt->liters_availed
                ? round($fuelReceipt->gps_distance_km / $fuelReceipt->liters_availed, 2)
                : null,
            'cost_per_km'       => $fuelReceipt->gps_distance_km && $fuelReceipt->amount_on_receipt
                ? round($fuelReceipt->amount_on_receipt / $fuelReceipt->gps_distance_km, 2)
                : null,
        ];

        // ✅ Fix receipt URL path (public/receipts/, not storage/)
       if ($fuelReceipt->receipt_photo_path && !str_starts_with($fuelReceipt->receipt_photo_path, 'http')) {
    $fuelReceipt->receipt_photo_url = url('storage/' . $fuelReceipt->receipt_photo_path);
}

        return response()->json($fuelReceipt);
    }
}