<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Reverb Server
    |--------------------------------------------------------------------------
    |
    | This option controls the default server used by Reverb to handle
    | incoming connections as well as broadcasting messages to your
    | connected clients. You may set this to any of the servers defined
    | in the "servers" array below.
    |
    */

    'default' => env('REVERB_SERVER', 'reverb'),

    /*
    |--------------------------------------------------------------------------
    | Reverb Servers
    |--------------------------------------------------------------------------
    |
    | Here you may define all of the servers used by Reverb as well as their
    | respective configuration options. The "host" and "port" options are
    | used to define the address that Reverb will listen on. The "app_id",
    | "key", and "secret" options are used to authenticate clients.
    |
    */

    'servers' => [

        'main' => [
            'host' => env('REVERB_SERVER_HOST', '0.0.0.0'),
            'port' => env('REVERB_SERVER_PORT', 8080),
            'hostname' => env('REVERB_HOST', 'localhost'),
            'options' => [
                'tls' => [],
            ],
            'max_request_size' => env('REVERB_MAX_REQUEST_SIZE', 10_000),
            'scaling' => [
                'enabled' => env('REVERB_SCALING_ENABLED', false),
                'channel' => env('REVERB_SCALING_CHANNEL', 'reverb'),
            ],
            'pulse_ingest_interval' => env('REVERB_PULSE_INGEST_INTERVAL', 10),
            'telescope_ingest_interval' => env('REVERB_TELESCOPE_INGEST_INTERVAL', 60),
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Reverb Applications
    |--------------------------------------------------------------------------
    |
    | Here you may define all of the applications that Reverb will handle.
    | Each application must have a unique app_id, key, and secret. The
    | app_id is used to identify the application, while the key and
    | secret are used to authenticate the client.
    |
    */

    'apps' => [

        [
            'id' => env('REVERB_APP_ID'),
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'client' => null,
            'capacity' => null,
            'enable_client_messages' => env('REVERB_ENABLE_CLIENT_MESSAGES', false),
        ],

    ],

];