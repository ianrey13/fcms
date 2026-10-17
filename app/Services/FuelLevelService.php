<?php

namespace App\Services;

use App\Models\Vehicle;
use App\Models\FuelReceipt;
use App\Models\GasSlip;
use App\Models\TripTicket;
use Illuminate\Support\Facades\Log;

class FuelLevelService
{
    /**
     * Recalculate and persist current_fuel_balance for a vehicle.
     *
     * Formula (PM-confirmed):
     *   current = initial_estimated_fuel
     *           + Σ(fuel purchases liters_availed)
     *           − Σ(actual_distance_km / reference_efficiency)
     */
    public function recalculate(Vehicle $vehicle): array
    {
        $initial = (float) ($vehicle->initial_estimated_fuel ?? 0);
        $tank    = (float) ($vehicle->tank_capacity ?? 60);
        $eff     = (float) ($vehicle->reference_efficiency ?? 10);

        if ($eff <= 0) $eff = 10;

        // Sum of all liters purchased for this vehicle
        $purchasedLiters = (float) FuelReceipt::query()
            ->join('gas_slip as gs', 'fuel_receipt.gas_slip_id', '=', 'gs.gas_slip_id')
            ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
            ->where('tt.vehicle_id', $vehicle->vehicle_id)
            ->whereNotNull('fuel_receipt.liters_availed')
            ->sum('fuel_receipt.liters_availed');

        // Sum of actual distances across all trips for this vehicle
        $totalDistance = (float) TripTicket::where('vehicle_id', $vehicle->vehicle_id)
            ->whereNotNull('actual_distance_km')
            ->where('actual_distance_km', '>', 0)
            ->sum('actual_distance_km');

        $consumedLiters = $totalDistance / $eff;

        $rawBalance = $initial + $purchasedLiters - $consumedLiters;

        // Clamp for display
        $clamped = max(0, min($rawBalance, $tank));

        $vehicle->current_fuel_balance = $clamped;
        $vehicle->save();

        $result = [
            'vehicle_id'        => $vehicle->vehicle_id,
            'initial'           => round($initial, 2),
            'purchased_liters'  => round($purchasedLiters, 2),
            'total_distance_km' => round($totalDistance, 2),
            'efficiency'        => round($eff, 2),
            'consumed_liters'   => round($consumedLiters, 2),
            'raw_balance'       => round($rawBalance, 2),
            'clamped_balance'   => round($clamped, 2),
            'tank_capacity'     => round($tank, 2),
            'percentage'        => $tank > 0 ? round(($clamped / $tank) * 100, 2) : 0,
            'anomaly'           => $this->detectAnomaly($rawBalance, $tank),
        ];

        Log::info('Fuel level recalculated', $result);

        return $result;
    }

    private function detectAnomaly(float $rawBalance, float $tank): ?string
    {
        if ($rawBalance < -1) return 'below_zero';
        if ($rawBalance > $tank + 1) return 'exceeds_tank';
        return null;
    }
}