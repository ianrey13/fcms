<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class OpenRouteService
{
    protected $fallbackService;
    protected $locationService;

    public function __construct(
        FallbackLocationService $fallbackService,
        LocationService $locationService
    ) {
        $this->fallbackService = $fallbackService;
        $this->locationService = $locationService;
        Log::info('OpenRouteService is disabled. Using Nominatim + fallback instead.');
    }

    /**
     * Search for places - redirect to LocationService (Nominatim + fallback)
     */
    public function searchPlaces($query)
    {
        return $this->locationService->searchPlaces($query);
    }

    /**
     * Geocode - redirect to LocationService
     */
    public function geocode($address)
    {
        return $this->locationService->geocode($address);
    }

    /**
     * Calculate trip estimate - redirect to LocationService
     */
    public function calculateTripEstimate($originAddress, $destinationAddress, $vehicleId = null, $roundTrip = true)
    {
        return $this->locationService->calculateTripEstimate(
            $originAddress, 
            $destinationAddress, 
            $vehicleId, 
            $roundTrip
        );
    }

    /**
     * Get distance - redirect to LocationService
     */
    public function getDistance($startLng, $startLat, $endLng, $endLat)
    {
        // Try to get via LocationService
        $result = $this->locationService->calculateDistance(
            "{$startLat},{$startLng}",
            "{$endLat},{$endLng}"
        );
        
        if ($result['success']) {
            return [
                'success' => true,
                'distance_km' => $result['distance_km'],
                'duration_minutes' => $result['duration_minutes'],
                'source' => $result['source'] ?? 'local',
            ];
        }

        return [
            'success' => false,
            'message' => 'Distance calculation failed',
        ];
    }
}