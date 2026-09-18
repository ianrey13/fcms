<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Http\Request;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// ============================================
// ✅ BROADCASTING AUTH ROUTE
// ============================================
Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware(['web', 'auth']);

// ============================================
// ✅ TEST AUTH ROUTE
// ============================================
Route::get('/test-auth', function () {
    return response()->json([
        'authenticated' => auth()->check(),
        'user' => auth()->user() ? [
            'id' => auth()->user()->user_id,
            'email' => auth()->user()->email,
            'role' => auth()->user()->role,
        ] : null,
    ]);
})->middleware(['auth']);

// ============================================
// ✅ STORAGE ROUTE (with CORS middleware)
// ============================================
Route::get('/storage/receipts/{filename}', function ($filename) {
    $path = storage_path('app/public/receipts/' . $filename);
    
    if (!file_exists($path)) {
        abort(404, 'Image not found');
    }
    
    $mimeType = mime_content_type($path) ?: 'image/jpeg';
    
    return response()->file($path, [
        'Content-Type' => $mimeType,
        'Cache-Control' => 'public, max-age=86400',
    ]);
})->where('filename', '.*\.(jpg|jpeg|png|gif|webp)$')->middleware(['cors']);  // ✅ ADDED cors middleware

// ============================================
// ✅ STORAGE ROUTE - Fallback (with CORS)
// ============================================
Route::get('/storage/{path}', function ($path) {
    $fullPath = storage_path('app/public/' . $path);
    
    if (!file_exists($fullPath)) {
        abort(404, 'File not found');
    }
    
    $mimeType = mime_content_type($fullPath) ?: 'application/octet-stream';
    
    return response()->file($fullPath, [
        'Content-Type' => $mimeType,
        'Cache-Control' => 'public, max-age=86400',
    ]);
})->where('path', '.*')->middleware(['cors']);  // ✅ ADDED cors middleware

// ============================================
// ✅ OPTIONS preflight route for storage
// ============================================
Route::options('/storage/{path}', function () {
    return response('', 200)
        ->header('Access-Control-Allow-Origin', '*')
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', '*')
        ->header('Access-Control-Max-Age', '86400');
})->where('path', '.*');

// ============================================
// ✅ REACT SPA - Catch all other routes
// ============================================
Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api).*$');