<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\LocationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LocationController extends Controller
{
    protected $locationService;

    public function __construct(LocationService $locationService)
    {
        $this->locationService = $locationService;
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

            $result = $this->locationService->searchPlaces($query);

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
                'dest_lat' => 'nullable|numeric',
                'dest_lng' => 'nullable|numeric',
            ]);

            $roundTrip = $request->boolean('round_trip', true);
            $destLat = $request->input('dest_lat');
            $destLng = $request->input('dest_lng');
            $destination = $request->input('destination');

            // If coordinates are provided, use them for more accurate distance
            if ($destLat && $destLng) {
                $destination = $destination ?? "{$destLat}, {$destLng}";
            }

            $result = $this->locationService->calculateTripEstimate(
                $request->input('origin'),
                $destination,
                $request->input('vehicle_id'),
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

            $result = $this->locationService->geocode($request->input('address'));

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
     * Reverse geocode coordinates to address
     */
    public function reverseGeocode(Request $request)
    {
        try {
            $request->validate([
                'lat' => 'required|numeric',
                'lng' => 'required|numeric',
            ]);

            $result = $this->locationService->reverseGeocode(
                $request->input('lat'),
                $request->input('lng')
            );

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Reverse geocode error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Reverse geocode error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate complete trip estimate
     */
    public function calculateTripEstimate(Request $request)
    {
        try {
            $request->validate([
                'origin' => 'required|string',
                'destination' => 'required|string',
                'vehicle_id' => 'nullable|exists:vehicles,vehicle_id',
                'round_trip' => 'nullable|boolean',
                'dest_lat' => 'nullable|numeric',
                'dest_lng' => 'nullable|numeric',
            ]);

            $roundTrip = $request->boolean('round_trip', true);
            $destLat = $request->input('dest_lat');
            $destLng = $request->input('dest_lng');
            $destination = $request->input('destination');

            if ($destLat && $destLng) {
                $destination = $destination ?? "{$destLat}, {$destLng}";
            }

            $result = $this->locationService->calculateTripEstimate(
                $request->input('origin'),
                $destination,
                $request->input('vehicle_id'),
                $roundTrip
            );

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Trip estimate error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error calculating trip estimate: ' . $e->getMessage()
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