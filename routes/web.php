<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application.
|
*/

// This serves your React app - ALL routes go to React SPA
Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api).*$');