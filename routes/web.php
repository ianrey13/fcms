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
// ✅ REACT SPA - Catch all other routes
// ============================================
Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api).*$');