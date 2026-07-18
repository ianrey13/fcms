<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        
        <meta name="base-url" content="{{ url('/') }}">
        <meta name="api-url" content="{{ url('/api') }}">
        
        <title>{{ config('app.name', 'FCMS') }}</title>
        
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/main.jsx'])
    </head>
    <body>
        <div id="root"></div>
    </body>
</html>