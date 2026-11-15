<?php

namespace App\Services;

use App\Models\TripTicket;
use App\Models\FuelReceipt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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

        // 1. Get Expected Round-trip Distance (Using OSRM/Routing)
        $distanceData = $this->getExpectedDistance($trip->destination);
        $oneWayDistance = $distanceData['distance'];
        $roundTripDistance = $oneWayDistance * 2; 

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
                "Based on OSRM Route (%.1f km round-trip) ÷ %.1f km/L × ₱%.2f/L.",
                $roundTripDistance,
                $efficiency,
                $weightedPrice
            ),
        ];
    }

    /**
     * Get Expected Distance (1-way) using OSRM API based on destination text.
     */
    private function getExpectedDistance($destination): array
    {
        // Default coordinates sa Laguindingan (GSO / LGU Hall)
        $originLat = 8.5833;
        $originLng = 124.6667;
        
        // Fallback distance kung mapalpak ang API
        $defaultDistance = 20.0;

        try {
            // 1. Gamit ang Nominatim (OpenStreetMap) para makuha ang Coordinates sa Destination
            $geoResponse = Http::withHeaders([
                'User-Agent' => 'FCMS-Laguindingan/1.0' // Required sa Nominatim
            ])->get('https://nominatim.openstreetmap.org/search', [
                'q' => $destination . ', Misamis Oriental, Philippines',
                'format' => 'json',
                'limit' => 1
            ]);

            if ($geoResponse->failed() || empty($geoResponse->json())) {
                return ['distance' => $defaultDistance, 'source' => 'default'];
            }

            $location = $geoResponse->json()[0];
            $destLat = (float) $location['lat'];
            $destLng = (float) $location['lon'];

            // 2. Gamit ang OSRM (Open Source Routing Machine) para makuha ang Road Distance
            // (Kini mo-follow sa coastal roads, AOR, etc.)
            $osrmResponse = Http::get("https://router.project-osrm.org/route/v1/driving/{$originLng},{$originLat};{$destLng},{$destLat}?overview=false");

            if ($osrmResponse->failed() || empty($osrmResponse->json()['routes'])) {
                return ['distance' => $defaultDistance, 'source' => 'default'];
            }

            // OSRM returns distance in meters, i-convert sa km
            $distanceInMeters = $osrmResponse->json()['routes'][0]['distance'];
            $distanceInKm = $distanceInMeters / 1000;

            return [
                'distance' => $distanceInKm,
                'source' => 'osrm'
            ];

        } catch (\Exception $e) {
            Log::error('OSRM Distance Calculation Error: ' . $e->getMessage());
            return ['distance' => $defaultDistance, 'source' => 'default'];
        }
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