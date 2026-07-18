<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GoogleMapsService
{
    protected $apiKey;
    
    public function __construct()
    {
        $this->apiKey = config('services.google.maps_api_key');
    }
    
    /**
     * Calculate distance between origin and destination
     */
    public function getDistance($origin, $destination)
    {
        $cacheKey = "google_distance_" . md5($origin . $destination);
        
        return Cache::remember($cacheKey, now()->addHours(6), function () use ($origin, $destination) {
            try {
                $response = Http::get('https://maps.googleapis.com/maps/api/distancematrix/json', [
                    'origins' => $origin,
                    'destinations' => $destination,
                    'key' => $this->apiKey,
                    'units' => 'metric',
                ]);
                
                Log::info('Google Distance Matrix API called', [
                    'origin' => $origin,
                    'destination' => $destination,
                    'status' => $response->status()
                ]);
                
                if ($response->successful() && $response->json('status') === 'OK') {
                    $element = $response->json('rows.0.elements.0');
                    
                    if ($element && $element['status'] === 'OK') {
                        return [
                            'distance_km' => round($element['distance']['value'] / 1000, 1),
                            'distance_text' => $element['distance']['text'],
                            'duration_min' => round($element['duration']['value'] / 60),
                            'duration_text' => $element['duration']['text'],
                            'success' => true
                        ];
                    }
                }
                
                Log::warning('Google Distance Matrix failed', [
                    'response' => $response->json()
                ]);
                
                return null;
                
            } catch (\Exception $e) {
                Log::error('Google Maps API error: ' . $e->getMessage());
                return null;
            }
        });
    }
    
    /**
     * Search for places (autocomplete)
     */
    public function searchPlaces($query)
    {
        if (strlen($query) < 2) {
            return [];
        }
        
        $cacheKey = "google_places_" . md5($query);
        
        return Cache::remember($cacheKey, now()->addHours(24), function () use ($query) {
            try {
                $response = Http::get('https://maps.googleapis.com/maps/api/place/autocomplete/json', [
                    'input' => $query,
                    'types' => 'geocode|establishment',
                    'components' => 'country:ph',
                    'key' => $this->apiKey,
                ]);
                
                if ($response->successful() && $response->json('status') === 'OK') {
                    $predictions = $response->json('predictions', []);
                    
                    return array_map(function($prediction) {
                        return [
                            'name' => $prediction['description'],
                            'place_id' => $prediction['place_id'],
                        ];
                    }, $predictions);
                }
                
                return [];
                
            } catch (\Exception $e) {
                Log::error('Google Places API error: ' . $e->getMessage());
                return [];
            }
        });
    }
    
    /**
     * Get coordinates from address (geocoding)
     */
    public function geocode($address)
    {
        $cacheKey = "google_geocode_" . md5($address);
        
        return Cache::remember($cacheKey, now()->addDays(7), function () use ($address) {
            try {
                $response = Http::get('https://maps.googleapis.com/maps/api/geocode/json', [
                    'address' => $address,
                    'key' => $this->apiKey,
                ]);
                
                if ($response->successful() && $response->json('status') === 'OK') {
                    $results = $response->json('results');
                    if (!empty($results)) {
                        $location = $results[0]['geometry']['location'];
                        return [
                            'lat' => $location['lat'],
                            'lng' => $location['lng'],
                            'formatted_address' => $results[0]['formatted_address'],
                            'success' => true
                        ];
                    }
                }
                
                return null;
                
            } catch (\Exception $e) {
                Log::error('Google Geocode API error: ' . $e->getMessage());
                return null;
            }
        });
    }
    
    /**
     * Get directions with polyline (for map display)
     */
    public function getDirections($origin, $destination)
    {
        try {
            $response = Http::get('https://maps.googleapis.com/maps/api/directions/json', [
                'origin' => $origin,
                'destination' => $destination,
                'key' => $this->apiKey,
                'alternatives' => false,
            ]);
            
            if ($response->successful() && $response->json('status') === 'OK') {
                $route = $response->json('routes.0');
                if ($route && isset($route['legs'][0])) {
                    $leg = $route['legs'][0];
                    return [
                        'distance_km' => round($leg['distance']['value'] / 1000, 1),
                        'distance_text' => $leg['distance']['text'],
                        'duration_min' => round($leg['duration']['value'] / 60),
                        'duration_text' => $leg['duration']['text'],
                        'polyline' => $route['overview_polyline']['points'],
                        'start_address' => $leg['start_address'],
                        'end_address' => $leg['end_address'],
                        'success' => true
                    ];
                }
            }
            
            return null;
            
        } catch (\Exception $e) {
            Log::error('Google Directions API error: ' . $e->getMessage());
            return null;
        }
    }
}