<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\User;
use App\Models\Driver;
use App\Models\TripTicket;
use Illuminate\Support\Facades\Log;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| NOTE: Channels are currently PUBLIC (no 'private-' prefix).
| For production, prefix each channel with 'private-' and update the
| frontend subscriptions accordingly (Echo will use the auth endpoint).
|
*/

// ============================================
// USER CHANNELS
// ============================================

Broadcast::channel('user.{userId}', function ($user, $userId) {
    Log::info('🔔 User channel auth check', [
        'authenticated_user_id' => $user->user_id,
        'requested_user_id' => $userId,
        'match' => (int) $user->user_id === (int) $userId,
    ]);
    return (int) $user->user_id === (int) $userId;
});

Broadcast::channel('notifications.{userId}', function ($user, $userId) {
    Log::info('🔔 Notification channel auth check', [
        'user_id' => $user->user_id,
        'userId' => $userId,
        'match' => (int) $user->user_id === (int) $userId,
    ]);
    return (int) $user->user_id === (int) $userId;
});

// ============================================
// DRIVER CHANNELS
// ============================================

Broadcast::channel('driver.{driverId}', function ($user, $driverId) {
    $driver = Driver::where('driver_id', $driverId)->first();

    $isOwner = $driver && (int) $driver->user_id === (int) $user->user_id;  // ✅ Cast both sides
    $isMonitor = in_array($user->role, ['gso_office', 'mayors_office']);

    Log::info('🚗 Driver channel auth check', [
        'user_id' => $user->user_id,
        'driver_id' => $driverId,
        'is_owner' => $isOwner,
        'is_monitor' => $isMonitor,
    ]);

    return $isOwner || $isMonitor;
});

// ============================================
// TRIP CHANNELS
// ============================================

Broadcast::channel('trip.{tripId}', function ($user, $tripId) {
    $trip = TripTicket::with(['driver'])->find($tripId);

    if (!$trip) {
        Log::warning('Trip not found for channel auth', ['trip_id' => $tripId]);
        return false;
    }

    $isDriver = $trip->driver && (int) $trip->driver->user_id === (int) $user->user_id;
    $isGSO = $user->role === 'gso_office';
    $isMayor = $user->role === 'mayors_office';
    $isSubmitter = (int) $trip->submitted_by === (int) $user->user_id;

    $authorized = $isDriver || $isGSO || $isMayor || $isSubmitter;

    Log::info('🚗 Trip channel auth check', [
        'trip_id' => $tripId,
        'user_id' => $user->user_id,
        'role' => $user->role,
        'authorized' => $authorized,
    ]);

    return $authorized;
});

Broadcast::channel('trips.active', function ($user) {
    $authorized = in_array($user->role, ['gso_office', 'mayors_office']);
    Log::info('📊 Active trips channel auth check', [
        'user_id' => $user->user_id,
        'role' => $user->role,
        'authorized' => $authorized,
    ]);
    return $authorized;
});

// ============================================
// DEPARTMENT CHANNELS
// ============================================

Broadcast::channel('department.{departmentId}', function ($user, $departmentId) {
    $isMember = (int) $user->department_id === (int) $departmentId;
    $isGSO = $user->role === 'gso_office';
    $isMayor = $user->role === 'mayors_office';

    $authorized = $isMember || $isGSO || $isMayor;

    Log::info('🏢 Department channel auth check', [
        'user_id' => $user->user_id,
        'department_id' => $departmentId,
        'authorized' => $authorized,
    ]);

    return $authorized;
});

// ============================================
// BUDGET CHANNELS
// ============================================

Broadcast::channel('budget.{departmentId}', function ($user, $departmentId) {
    $authorized = in_array($user->role, ['gso_office', 'mayors_office']);
    Log::info('💰 Budget channel auth check', [
        'user_id' => $user->user_id,
        'authorized' => $authorized,
    ]);
    return $authorized;
});

// ============================================
// GSO & MAYOR CHANNELS
// ============================================

Broadcast::channel('gso.dashboard', function ($user) {
    $authorized = $user->role === 'gso_office';
    Log::info('📋 GSO dashboard channel auth check', [
        'user_id' => $user->user_id,
        'authorized' => $authorized,
    ]);
    return $authorized;
});

Broadcast::channel('mayor.dashboard', function ($user) {
    $authorized = $user->role === 'mayors_office';
    Log::info('📋 Mayor dashboard channel auth check', [
        'user_id' => $user->user_id,
        'authorized' => $authorized,
    ]);
    return $authorized;
});

// ============================================
// ✅ GSO LIVE TRACKING (NEW — was missing)
// ============================================

Broadcast::channel('gso-live-tracking', function ($user) {
    // GSO only — drivers publish pings, GSO watches
    $authorized = $user->role === 'gso_office';

    Log::info('🗺️ GSO live tracking channel auth check', [
        'user_id' => $user->user_id,
        'role' => $user->role,
        'authorized' => $authorized,
    ]);

    return $authorized;
});

// ============================================
// SYSTEM CHANNELS
// ============================================

Broadcast::channel('system', function ($user) {
    $authorized = $user->role === 'gso_office';
    Log::info('🔔 System channel auth check', [
        'user_id' => $user->user_id,
        'authorized' => $authorized,
    ]);
    return $authorized;
});