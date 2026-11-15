<?php

namespace App\Services;

use App\Models\TripTicket;
use App\Models\FuelReceipt;
use Illuminate\Support\Facades\DB;

class FuelPredictionService
{
    /**
     * Suggest a release amount for a trip based on destination, efficiency, and weighted average price.
     */
    public function suggestFor(TripTicket $trip): array
    {
        $vehicle = $trip->vehicle;
        
        if (!$vehicle) {
            return $this->emptyResponse('Vehicle not found.');
        }

        // 1. Get Expected Round-trip Distance
        $distanceData = $this->getExpectedDistance($trip->destination, $trip->department_id);
        $roundTripDistance = $distanceData['distance'] * 2; // Round trip = × 2

        if ($roundTripDistance <= 0) {
            return $this->emptyResponse('Cannot calculate distance for this destination.');
        }

        // 2. Get Reference Efficiency (Default to 10 km/L if not set)
        $efficiency = (float) ($vehicle->reference_efficiency ?: 10.0);

        // 3. Calculate Estimated Liters
        $estimatedLiters = $roundTripDistance / $efficiency;

        // 4. Get Weighted Average Fuel Price
        $weightedPriceData = $this->calculateWeightedAveragePrice($vehicle->fuel_type);
        $weightedPrice = $weightedPriceData['price'];

        if ($weightedPrice <= 0) {
            return $this->emptyResponse('No historical fuel receipts found to compute weighted average price.');
        }

        // 5. Compute Suggested Release Amount
        $suggestedAmount = $estimatedLiters * $weightedPrice;

        // Build sample basis from recent receipts of this fuel type
        $basis = $this->getRecentReceiptsBasis($vehicle->fuel_type);

        return [
            'available'          => true,
            'confidence'         => $distanceData['source'] === 'historical' ? 'high' : 'low',
            'tier'               => $distanceData['source'],
            'sample_size'        => $weightedPriceData['sample_size'],
            'suggested_amount'   => round($suggestedAmount, 2),
            'suggested_liters'   => round($estimatedLiters, 2),
            'range_min'          => round($suggestedAmount * 0.9, 2), // 10% margin
            'range_max'          => round($suggestedAmount * 1.1, 2), // +10% margin
            'avg_amount'         => round($suggestedAmount, 2),
            'avg_liters'         => round($estimatedLiters, 2),
            'unit_price_hint'    => round($weightedPrice, 2),
            'basis'              => $basis,
            'message'            => sprintf(
                "Based on %s distance (%.1f km round-trip) ÷ %.1f km/L × ₱%.2f/L.",
                $distanceData['source'] === 'historical' ? 'historical' : 'default',
                $roundTripDistance,
                $efficiency,
                $weightedPrice
            ),
        ];
    }

    /**
     * Get Expected Distance (1-way) based on past trips or fallback.
     */
    private function getExpectedDistance($destination, $departmentId): array
    {
        // Try to find average distance from past trips with the same destination
        $query = TripTicket::where('destination', 'LIKE', '%' . trim($destination) . '%')
            ->whereIn('status', ['closed', 'completed', 'pending_gso_validation'])
            ->whereNotNull('actual_distance_km')
            ->where('actual_distance_km', '>', 0);

        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        $avgDistance = $query->avg('actual_distance_km');

        if ($avgDistance && $avgDistance > 0) {
            return [
                'distance' => (float) $avgDistance,
                'source' => 'historical'
            ];
        }

        // Fallback: Default estimate (e.g., 20 km one-way) if no history exists
        return [
            'distance' => 20.0,
            'source' => 'default'
        ];
    }

    /**
     * Calculate Weighted Average Fuel Price for a specific fuel type over the last 30 days.
     * Formula: Σ(Quantity × Unit Price) / Σ(Quantity)
     */
    private function calculateWeightedAveragePrice($fuelType): array
    {
        // Get receipts from the last 30 days for the specific fuel type
        $receipts = FuelReceipt::join('gas_slip as gs', 'fuel_receipt.gas_slip_id', '=', 'gs.gas_slip_id')
            ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
            ->join('vehicles as v', 'tt.vehicle_id', '=', 'v.vehicle_id')
            ->where('v.fuel_type', $fuelType)
            ->whereNotNull('fuel_receipt.liters_availed')
            ->whereNotNull('fuel_receipt.unit_price')
            ->where('fuel_receipt.liters_availed', '>', 0)
            ->where('fuel_receipt.unit_price', '>', 0)
            ->where('fuel_receipt.receipt_uploaded_at', '>=', now()->subDays(30))
            ->select('fuel_receipt.liters_availed', 'fuel_receipt.unit_price')
            ->get();

        if ($receipts->isEmpty()) {
            return ['price' => 0, 'sample_size' => 0];
        }

        $totalCost = 0;
        $totalLiters = 0;

        foreach ($receipts as $receipt) {
            $liters = (float) $receipt->liters_availed;
            $price  = (float) $receipt->unit_price;
            
            $totalCost += ($liters * $price);
            $totalLiters += $liters;
        }

        $weightedPrice = $totalLiters > 0 ? ($totalCost / $totalLiters) : 0;

        return [
            'price' => $weightedPrice,
            'sample_size' => $receipts->count()
        ];
    }

    /**
     * Get last 5 receipts to show as "basis" in the UI.
     */
    private function getRecentReceiptsBasis($fuelType)
    {
        return FuelReceipt::join('gas_slip as gs', 'fuel_receipt.gas_slip_id', '=', 'gs.gas_slip_id')
            ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
            ->join('vehicles as v', 'tt.vehicle_id', '=', 'v.vehicle_id')
            ->where('v.fuel_type', $fuelType)
            ->whereNotNull('fuel_receipt.liters_availed')
            ->whereNotNull('fuel_receipt.unit_price')
            ->select([
                'tt.trip_ticket_number as ticket_number',
                'tt.trip_date',
                'fuel_receipt.amount_on_receipt as amount',
                'fuel_receipt.liters_availed as liters',
                'fuel_receipt.unit_price',
                'tt.destination'
            ])
            ->orderBy('fuel_receipt.receipt_uploaded_at', 'desc')
            ->limit(5)
            ->get()
            ->toArray();
    }

    private function emptyResponse($message)
    {
        return [
            'available'          => false,
            'confidence'         => 'none',
            'tier'               => null,
            'sample_size'        => 0,
            'suggested_amount'   => null,
            'suggested_liters'   => null,
            'range_min'          => null,
            'range_max'          => null,
            'avg_amount'         => null,
            'avg_liters'         => null,
            'unit_price_hint'    => null,
            'basis'              => [],
            'message'            => $message,
        ];
    }
}