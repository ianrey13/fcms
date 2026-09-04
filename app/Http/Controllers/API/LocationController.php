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
        try {
            Log::info('Location search request received', ['query' => $request->input('query')]);
            
            $request->validate([
                'query' => 'required|string|min:2',
            ]);

            $query = $request->input('query');
            Log::info('Search request', ['query' => $query]);

            $result = $this->ors->searchPlaces($query);

            // Always return a consistent response structure
            return response()->json([
                'success' => $result['success'] ?? false,
                'predictions' => $result['predictions'] ?? [],
                'total' => $result['total'] ?? 0,
                'message' => $result['message'] ?? null,
                'source' => $result['source'] ?? 'unknown',
            ]);

        } catch (\Exception $e) {
            Log::error('Search error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'predictions' => [],
                'total' => 0,
                'message' => 'Search error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate distance between locations
     */
    

public function calculateDistance(Request $request)
{
    try {
        Log::info('Calculate distance request received', $request->all());

        $request->validate([
            'origin' => 'required|string',
            'destination' => 'required|string',
            'vehicle_id' => 'nullable|exists:vehicles,vehicle_id',
            'round_trip' => 'nullable|boolean',
        ]);

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
        } else {
            Log::warning('Trip estimate failed', ['result' => $result]);
        }

        return response()->json($result);

    } catch (\Exception $e) {
        Log::error('Calculate distance error: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Error calculating distance: ' . $e->getMessage()
        ], 500);
    }
}

    /**
     * Geocode a single address
     */
    public function geocode(Request $request)
    {
        try {
            Log::info('Geocode request received', $request->all());
            
            $request->validate([
                'address' => 'required|string',
            ]);

            $result = $this->ors->geocode($request->address);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Geocode error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Geocode error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all barangays with coordinates
     */
    public function getBarangays()
    {
        try {
            $barangays = config('locations.barangays', []);
            return response()->json([
                'success' => true,
                'data' => $barangays
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all municipalities
     */
    public function getMunicipalities()
    {
        try {
            $municipalities = config('locations.municipalities', []);
            return response()->json([
                'success' => true,
                'data' => $municipalities
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
}