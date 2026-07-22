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

        // ✅ FIXED: Get the 'query' parameter correctly
        $query = $request->input('query');
        
        Log::info('Search request', ['query' => $query]);

        $result = $this->ors->searchPlaces($query);

        return response()->json($result);
    }

    /**
     * Calculate distance between locations
     */
    public function calculateDistance(Request $request)
{
    $request->validate([
        'origin' => 'required|string',
        'destination' => 'required|string',
        'vehicle_id' => 'nullable|exists:vehicles,vehicle_id',
    ]);

    $result = $this->ors->calculateTripEstimate(
        $request->origin,
        $request->destination,
        $request->vehicle_id
    );

    // ✅ Add the fuel type to the response
    if ($result['success']) {
        $result['fuel_type_used'] = $result['fuel_type'] ?? 'regular';
        $result['price_source'] = 'database';
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