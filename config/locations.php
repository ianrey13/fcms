<?php

// config/locations.php
// ============================================
// Location service configuration
// ============================================

return [
    // ============ NOMINATIM ============
    'nominatim' => [
        'enabled' => env('NOMINATIM_ENABLED', true),
        'base_url' => env('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org'),
        'user_agent' => env('NOMINATIM_USER_AGENT', 'FCMS/1.0'),
        'country' => env('NOMINATIM_COUNTRY', 'ph'),
        'language' => env('NOMINATIM_LANGUAGE', 'en'),
        'rate_limit' => env('NOMINATIM_RATE_LIMIT', 1),
        'timeout' => env('NOMINATIM_TIMEOUT', 10),
    ],

    // ============ FALLBACK LOCATION DATA ============
    // Local coordinates for common Laguindingan destinations
    'fallback_locations' => [
        'laguindingan' => ['lat' => 8.6, 'lng' => 124.4333],
        'cagayan de oro' => ['lat' => 8.4822, 'lng' => 124.6472],
        'cdo' => ['lat' => 8.4822, 'lng' => 124.6472],
        'iligan' => ['lat' => 8.2281, 'lng' => 124.2452],
        'alubijid' => ['lat' => 8.5500, 'lng' => 124.4167],
        'el salvador' => ['lat' => 8.5667, 'lng' => 124.4667],
        'opon' => ['lat' => 8.4667, 'lng' => 124.5500],
        'molugan' => ['lat' => 8.5667, 'lng' => 124.4167],
        'initao' => ['lat' => 8.5167, 'lng' => 124.3167],
        'naawan' => ['lat' => 8.4333, 'lng' => 124.2833],
        'talisayan' => ['lat' => 8.9833, 'lng' => 124.8667],
        'gitagum' => ['lat' => 8.5833, 'lng' => 124.4000],
        'libertad' => ['lat' => 8.5500, 'lng' => 124.3500],
        'claveria' => ['lat' => 8.6167, 'lng' => 124.8833],
        'jasaan' => ['lat' => 8.6500, 'lng' => 124.7500],
        'villanueva' => ['lat' => 8.5833, 'lng' => 124.7667],
        'tagoloan' => ['lat' => 8.5333, 'lng' => 124.7500],
        'malitbog' => ['lat' => 8.5333, 'lng' => 124.8833],
    ],

    // ============ FALLBACK DEFAULTS ============
    'defaults' => [
        // Default center point (Laguindingan town proper)
        'default_lat' => 8.6,
        'default_lng' => 124.4333,

        // Default speed for ETA (km/h)
        'avg_speed_kmh' => 40,

        // Haversine distance multiplier (accounts for actual road distance vs straight line)
        'road_distance_factor' => 1.3,
    ],
];