<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    // ✅ ADD 'storage/*' to paths
    'paths' => [
        'api/*', 
        'sanctum/csrf-cookie', 
        'broadcasting/auth',
        'storage/*',           // ✅ ADD THIS
        'storage/receipts/*',  // ✅ ADD THIS (optional)
    ],

    'allowed_methods' => ['*'],

    // ✅ Keep specific origins for development
    'allowed_origins' => [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:8081',
        'http://127.0.0.1:5173',
        'http://192.168.1.5:5173',
        'http://localhost:8000',  // ✅ ADD THIS
        'http://127.0.0.1:8000',  // ✅ ADD THIS
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // ✅ Set to true to allow credentials (cookies, authorization headers)
    'supports_credentials' => true,

];