<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'ors' => [
        'key' => env('OPENROUTESERVICE_API_KEY', ''),
    ],
    'fuel_rates' => [
        'car' => env('FUEL_RATE_CAR', 0.10),
        'truck' => env('FUEL_RATE_TRUCK', 0.15),
        'motorcycle' => env('FUEL_RATE_MOTORCYCLE', 0.05),
        'van' => env('FUEL_RATE_VAN', 0.12),
    ],
    'google' => [
        'maps_api_key' => env('GOOGLE_MAPS_API_KEY', ''),
    ],
     'graphhopper' => [
        'key' => env('GRAPHOPPER_API_KEY', ''),
        'url' => 'https://graphhopper.com/api/1',
    ],
    'locations' => [
    'config_source' => 'local_database',
    'version' => '1.0.0',
],

];
