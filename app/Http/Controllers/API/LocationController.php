<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\OpenRouteService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LocationController extends Controller
{
    protected $ors;

    public function __construct(OpenRouteService $ors)
    {
        $this->ors = $ors;
    }

    /**
     * Search for places (autocomplete)
     */
    public function search(Request $request)
    {
        $request->validate([
            'query' => 'required|string|min:2',
        ]);

        $query = $request->input('query');
        Log::info('Search request', ['query' => $query]);

        $result = $this->ors->searchPlaces($query);

        return response()->json($result);
    }

    /**
     * Calculate distance between locations
     * ✅ UPDATED: Added round_trip parameter
     */
    public function calculateDistance(Request $request)
    {
        $request->validate([
            'origin' => 'required|string',
            'destination' => 'required|string',
            'vehicle_id' => 'nullable|exists:vehicles,vehicle_id',
            'round_trip' => 'nullable|boolean',
        ]);

        // ✅ Default to true for round trip (back and forth)
        $roundTrip = $request->boolean('round_trip', true);

        $result = $this->ors->calculateTripEstimate(
            $request->origin,
            $request->destination,
            $request->vehicle_id,
            $roundTrip
        );

        if ($result['success']) {
            $result['fuel_type_used'] = $result['fuel_type'] ?? 'regular';
            $result['price_source'] = 'database';
            $result['is_round_trip'] = $roundTrip;
        }

        return response()->json($result);
    }

    /**
     * Geocode a single address
     */
    public function geocode(Request $request)
    {
        $request->validate([
            'address' => 'required|string',
        ]);

        $result = $this->ors->geocode($request->address);

        return response()->json($result);
    }
}