<?php

namespace App\Services;

use App\Models\TripTicket;
use App\Models\FuelReceipt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FuelPredictionService
{
    protected $locationService;

    public function __construct(FallbackLocationService $locationService)
    {
        $this->locationService = $locationService;
    }

    public function suggestFor(TripTicket $trip): array
    {
        $vehicle = $trip->vehicle;
        
        if (!$vehicle) {
            return $this->emptyResponse('Vehicle not found.');
        }

        // 1. Get Expected Round-trip Distance gikan sa FallbackLocationService
        $distanceData = $this->getExpectedDistance($trip->destination);
        $oneWayDistance = $distanceData['distance'];
        $roundTripDistance = $oneWayDistance * 2; 

        if ($roundTripDistance <= 0) {
            return $this->emptyResponse('Cannot calculate distance for this destination.');
        }

        // 2. Get Reference Efficiency
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

        $basis = $this->getRecentReceiptsBasis($vehicle->fuel_type);

        return [
            'available'          => true,
            'confidence'         => 'high',
            'tier'               => 'route',
            'sample_size'        => $weightedPriceData['sample_size'],
            'suggested_amount'   => round($suggestedAmount, 2),
            'suggested_liters'   => round($estimatedLiters, 2),
            'range_min'          => round($suggestedAmount * 0.9, 2), 
            'range_max'          => round($suggestedAmount * 1.1, 2), 
            'avg_amount'         => round($suggestedAmount, 2),
            'avg_liters'         => round($estimatedLiters, 2),
            'unit_price_hint'    => round($weightedPrice, 2),
            'basis'              => $basis,
            'message'            => sprintf(
                "Based on Fallback Route (%.1f km round-trip) ÷ %.1f km/L × ₱%.2f/L.",
                $roundTripDistance,
                $efficiency,
                $weightedPrice
            ),
        ];
    }

    /**
     * Get Expected Distance gikan sa FallbackLocationService
     */
    private function getExpectedDistance($destination): array
    {
        // Origin permi kay Laguindingan Municipal Hall
        $origin = 'Laguindingan Municipal Hall'; 
        
        try {
            // Tawgon ang FallbackLocationService
            $result = $this->locationService->calculateDistance($origin, [$destination]);

            if ($result && isset($result['success']) && $result['success'] && isset($result['distance_km'])) {
                return [
                    'distance' => (float) $result['distance_km'],
                    'source' => 'fallback'
                ];
            }

            return ['distance' => 20.0, 'source' => 'default'];
            
        } catch (\Exception $e) {
            Log::error('Fallback Distance Calculation Error: ' . $e->getMessage());
            return ['distance' => 20.0, 'source' => 'default'];
        }
    }

    private function calculateWeightedAveragePrice($fuelType): array
    {
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