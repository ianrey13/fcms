<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class LocationService
{
    protected $municipalities;
    protected $barangays;
    protected $fuelRates;
    protected $origin;
    protected $travelSettings;
    
    public function __construct()
    {
        $this->municipalities = config('locations.municipalities', []);
        $this->barangays = config('locations.barangays', []);
        $this->fuelRates = config('locations.fuel_rates', []);
        $this->origin = config('locations.origin', []);
        $this->travelSettings = config('locations.travel', []);
    }
    
    /**
     * Search for locations by name
     */
    public function search($query)
    {
        $query = strtolower(trim($query));
        
        if (strlen($query) < 2) {
            return [];
        }
        
        $results = [];
        
        // Search municipalities
        foreach ($this->municipalities as $key => $municipality) {
            if (strpos($key, $query) !== false || strpos(strtolower($municipality['name']), $query) !== false) {
                $results[] = [
                    'name' => $municipality['name'],
                    'type' => 'municipality',
                    'region' => 'Misamis Oriental',
                    'distance_km' => $municipality['distance_km'],
                    'coordinates' => null,
                ];
            }
        }
        
        // Search barangays
        foreach ($this->barangays as $key => $barangay) {
            if (strpos($key, $query) !== false || strpos(strtolower($barangay['name']), $query) !== false) {
                $results[] = [
                    'name' => $barangay['name'] . ', Laguindingan',
                    'type' => 'barangay',
                    'region' => 'Misamis Oriental',
                    'distance_km' => $barangay['distance_km'],
                    'coordinates' => null,
                ];
            }
        }
        
        // Sort by distance (closest first)
        usort($results, function($a, $b) {
            return ($a['distance_km'] ?? 999) <=> ($b['distance_km'] ?? 999);
        });
        
        return $results;
    }
    
    /**
     * Get distance to destination
     */
    public function getDistance($destinationName)
    {
        $destinationLower = strtolower(trim($destinationName));
        
        // Check municipalities
        foreach ($this->municipalities as $key => $municipality) {
            if ($destinationLower === $key || 
                strpos($destinationLower, $key) !== false || 
                strpos($key, $destinationLower) !== false) {
                return [
                    'distance_km' => $municipality['distance_km'],
                    'name' => $municipality['name'],
                    'type' => 'municipality'
                ];
            }
        }
        
        // Check barangays
        foreach ($this->barangays as $key => $barangay) {
            if ($destinationLower === $key || 
                strpos($destinationLower, $key) !== false || 
                strpos($key, $destinationLower) !== false) {
                return [
                    'distance_km' => $barangay['distance_km'],
                    'name' => $barangay['name'],
                    'type' => 'barangay'
                ];
            }
        }
        
        // Handle special cases
        if (strpos($destinationLower, 'all barangays') !== false) {
            return ['distance_km' => 25, 'name' => 'All Barangays', 'type' => 'circuit'];
        }
        
        if (strpos($destinationLower, 'aor') !== false) {
            return ['distance_km' => 20, 'name' => 'AOR Laguindingan', 'type' => 'patrol'];
        }
        
        return null;
    }
    
    /**
     * Calculate fuel estimate
     */
    public function calculateFuel($distanceKm, $fuelType, $fuelPrice)
    {
        $fuelRate = $this->getFuelRate($fuelType);
        $estimatedFuel = round($distanceKm * $fuelRate, 1);
        $estimatedCost = round($estimatedFuel * $fuelPrice, 2);
        
        return [
            'liters' => $estimatedFuel,
            'cost' => $estimatedCost,
            'rate' => $fuelRate,
        ];
    }
    
    /**
     * Get fuel consumption rate by vehicle type
     */
    public function getFuelRate($vehicleType)
    {
        $type = strtolower($vehicleType);
        
        // Direct match
        if (isset($this->fuelRates[$type])) {
            return $this->fuelRates[$type];
        }
        
        // Check for fuel type patterns
        if (strpos($type, 'diesel') !== false && isset($this->fuelRates['car_diesel'])) {
            return $this->fuelRates['car_diesel'];
        }
        
        if (strpos($type, 'motor') !== false && isset($this->fuelRates['motorcycle'])) {
            return $this->fuelRates['motorcycle'];
        }
        
        if (strpos($type, 'truck') !== false && isset($this->fuelRates['truck'])) {
            return $this->fuelRates['truck'];
        }
        
        return $this->fuelRates['default'];
    }
    
    /**
     * Calculate travel time
     */
    public function calculateTravelTime($distanceKm)
    {
        $speed = $this->travelSettings['average_speed_kmh'] ?? 40;
        $hours = $distanceKm / $speed;
        $minutes = round($hours * 60);
        
        return [
            'minutes' => $minutes,
            'hours' => round($hours, 1),
            'text' => $minutes . ' minutes (~' . round($hours, 1) . ' hours)'
        ];
    }
    
    /**
     * Get all municipalities with details
     */
    public function getAllMunicipalities()
    {
        $municipalities = [];
        foreach ($this->municipalities as $key => $data) {
            $municipalities[] = [
                'name' => $data['name'],
                'slug' => $key,
                'distance_km' => $data['distance_km'],
                'distance_text' => $data['distance_km'] . ' km from Laguindingan',
            ];
        }
        
        // Sort by distance
        usort($municipalities, function($a, $b) {
            return $a['distance_km'] <=> $b['distance_km'];
        });
        
        return $municipalities;
    }
    
    /**
     * Get all barangays
     */
    public function getAllBarangays()
    {
        $barangays = [];
        foreach ($this->barangays as $key => $data) {
            $barangays[] = [
                'name' => $data['name'],
                'slug' => $key,
                'distance_km' => $data['distance_km'],
                'distance_text' => $data['distance_km'] . ' km from Poblacion',
            ];
        }
        
        // Sort by distance
        usort($barangays, function($a, $b) {
            return $a['distance_km'] <=> $b['distance_km'];
        });
        
        return $barangays;
    }

    /**
 * Get coordinates for a location
 */
public function getCoordinates($locationName)
{
    $locationLower = strtolower(trim($locationName));
    
    // Check barangays first (more specific)
    foreach ($this->barangays as $key => $barangay) {
        if ($locationLower === $key || 
            strpos($locationLower, $key) !== false || 
            strpos($key, $locationLower) !== false) {
            return [
                'lat' => $barangay['lat'] ?? null,
                'lng' => $barangay['lng'] ?? null,
                'coordinates' => $barangay['coordinates'] ?? null,
                'name' => $barangay['name'],
                'type' => 'barangay'
            ];
        }
    }
    
    // Check origin
    if ($locationLower === 'poblacion' || $locationLower === 'laguindingan') {
        $origin = config('locations.origin');
        return [
            'lat' => $origin['lat'],
            'lng' => $origin['lng'],
            'coordinates' => $origin['coordinates'],
            'name' => $origin['name'],
            'type' => 'origin'
        ];
    }
    
    return null;
}

/**
 * Get all barangays with coordinates
 */
public function getAllBarangaysWithCoordinates()
{
    $barangays = [];
    foreach ($this->barangays as $key => $data) {
        $barangays[] = [
            'name' => $data['name'],
            'slug' => $key,
            'distance_km' => $data['distance_km'],
            'distance_text' => $data['distance_km'] . ' km from Poblacion',
            'coordinates' => [
                'lat' => $data['lat'],
                'lng' => $data['lng'],
            ],
            'description' => $data['description'] ?? null,
        ];
    }
    
    // Sort by distance
    usort($barangays, function($a, $b) {
        return $a['distance_km'] <=> $b['distance_km'];
    });
    
    return $barangays;
}

/**
 * Reverse geocode - Get location name from coordinates
 * This finds the nearest known location from coordinates
 */
public function reverseGeocode($lat, $lng)
{
    Log::info('Reverse geocode request', ['lat' => $lat, 'lng' => $lng]);
    
    $bestMatch = null;
    $bestDistance = PHP_FLOAT_MAX;
    
    // Check origin
    $origin = config('locations.origin');
    if ($origin && isset($origin['lat']) && isset($origin['lng'])) {
        $dist = $this->haversineDistance($lat, $lng, $origin['lat'], $origin['lng']);
        if ($dist < $bestDistance) {
            $bestDistance = $dist;
            $bestMatch = [
                'name' => $origin['name'] ?? 'Laguindingan Municipal Hall',
                'type' => 'origin',
                'distance' => $dist,
            ];
        }
    }
    
    // Check barangays
    $barangays = config('locations.barangays', []);
    foreach ($barangays as $key => $barangay) {
        if (isset($barangay['lat']) && isset($barangay['lng'])) {
            $dist = $this->haversineDistance($lat, $lng, $barangay['lat'], $barangay['lng']);
            if ($dist < $bestDistance) {
                $bestDistance = $dist;
                $bestMatch = [
                    'name' => $barangay['name'] . ', Laguindingan',
                    'type' => 'barangay',
                    'distance' => $dist,
                ];
            }
        }
    }
    
    // Check municipalities
    $municipalities = config('locations.municipalities', []);
    foreach ($municipalities as $key => $municipality) {
        // If municipality has coordinates
        if (isset($municipality['lat']) && isset($municipality['lng'])) {
            $dist = $this->haversineDistance($lat, $lng, $municipality['lat'], $municipality['lng']);
            if ($dist < $bestDistance) {
                $bestDistance = $dist;
                $bestMatch = [
                    'name' => $municipality['name'] . ', Misamis Oriental',
                    'type' => 'municipality',
                    'distance' => $dist,
                ];
            }
        }
    }
    
    // If best match is within 2km, use it
    if ($bestMatch && $bestDistance < 2) {
        Log::info('Reverse geocode found nearby', ['match' => $bestMatch, 'distance' => $bestDistance]);
        return [
            'success' => true,
            'address' => $bestMatch['name'],
            'lat' => $lat,
            'lng' => $lng,
            'type' => $bestMatch['type'],
            'source' => 'fallback',
        ];
    }
    
    // Default: return coordinates as address
    Log::info('Reverse geocode fallback', ['lat' => $lat, 'lng' => $lng]);
    return [
        'success' => true,
        'address' => "{$lat}, {$lng}",
        'lat' => $lat,
        'lng' => $lng,
        'type' => 'coordinates',
        'source' => 'fallback',
    ];
}

/**
 * Haversine distance calculation
 */
private function haversineDistance($lat1, $lon1, $lat2, $lon2)
{
    $earthRadius = 6371;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) * sin($dLat / 2) +
         cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
         sin($dLon / 2) * sin($dLon / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $earthRadius * $c;
}


}