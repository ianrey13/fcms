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
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

// ============================================
// USER CHANNELS
// ============================================

/**
 * ✅ User-specific channel (using user_id as primary key)
 */
Broadcast::channel('user.{userId}', function ($user, $userId) {
    Log::info('🔔 User channel auth check', [
        'authenticated_user_id' => $user->user_id,
        'requested_user_id' => $userId,
        'match' => (int) $user->user_id === (int) $userId,
        'role' => $user->role
    ]);
    
    return (int) $user->user_id === (int) $userId;
});

/**
 * ✅ Notification channel (alias for user channel)
 */
Broadcast::channel('notifications.{userId}', function ($user, $userId) {
    Log::info('🔔 Notification channel auth check', [
        'user_id' => $user->user_id,
        'userId' => $userId,
        'match' => (int) $user->user_id === (int) $userId
    ]);
    return (int) $user->user_id === (int) $userId;
});

// ============================================
// DRIVER CHANNELS
// ============================================

/**
 * ✅ Driver-specific channel
 */
Broadcast::channel('driver.{driverId}', function ($user, $driverId) {
    $driver = Driver::where('driver_id', $driverId)->first();
    
    Log::info('🚗 Driver channel auth check', [
        'user_id' => $user->user_id,
        'driver_id' => $driverId,
        'is_driver' => $driver && $driver->user_id === $user->user_id,
        'role' => $user->role
    ]);
    
    // Allow if user is the driver OR is GSO/Mayor's Office
    if ($driver && $driver->user_id === $user->user_id) {
        return true;
    }
    
    // GSO and Mayor's Office can monitor driver channels
    if (in_array($user->role, ['gso_office', 'mayors_office'])) {
        return true;
    }
    
    return false;
});

// ============================================
// TRIP CHANNELS
// ============================================

/**
 * ✅ Trip-specific channel for real-time updates
 */
Broadcast::channel('trip.{tripId}', function ($user, $tripId) {
    $trip = TripTicket::with(['driver'])->find($tripId);
    
    if (!$trip) {
        Log::warning('Trip not found for channel auth', ['trip_id' => $tripId]);
        return false;
    }
    
    // Check if user is the driver assigned to this trip
    $isDriver = $trip->driver && $trip->driver->user_id === $user->user_id;
    
    // Check if user is GSO or Mayor's Office
    $isGSO = $user->role === 'gso_office';
    $isMayor = $user->role === 'mayors_office';
    
    // Check if user submitted the trip
    $isSubmitter = $trip->submitted_by === $user->user_id;
    
    $authorized = $isDriver || $isGSO || $isMayor || $isSubmitter;
    
    Log::info('🚗 Trip channel auth check', [
        'trip_id' => $tripId,
        'user_id' => $user->user_id,
        'role' => $user->role,
        'is_driver' => $isDriver,
        'is_gso' => $isGSO,
        'is_mayor' => $isMayor,
        'is_submitter' => $isSubmitter,
        'authorized' => $authorized
    ]);
    
    return $authorized;
});

/**
 * ✅ Trip updates channel (all active trips)
 */
Broadcast::channel('trips.active', function ($user) {
    // Only GSO and Mayor's Office can monitor all active trips
    $authorized = in_array($user->role, ['gso_office', 'mayors_office']);
    
    Log::info('📊 Active trips channel auth check', [
        'user_id' => $user->user_id,
        'role' => $user->role,
        'authorized' => $authorized
    ]);
    
    return $authorized;
});

// ============================================
// DEPARTMENT CHANNELS
// ============================================

/**
 * ✅ Department-specific channel
 */
Broadcast::channel('department.{departmentId}', function ($user, $departmentId) {
    // User belongs to the department OR is GSO/Mayor's Office
    $isMember = (int) $user->department_id === (int) $departmentId;
    $isGSO = $user->role === 'gso_office';
    $isMayor = $user->role === 'mayors_office';
    
    $authorized = $isMember || $isGSO || $isMayor;
    
    Log::info('🏢 Department channel auth check', [
        'user_id' => $user->user_id,
        'department_id' => $departmentId,
        'user_department_id' => $user->department_id,
        'is_member' => $isMember,
        'is_gso' => $isGSO,
        'is_mayor' => $isMayor,
        'authorized' => $authorized
    ]);
    
    return $authorized;
});

// ============================================
// BUDGET CHANNELS
// ============================================

/**
 * ✅ Budget updates channel
 */
Broadcast::channel('budget.{departmentId}', function ($user, $departmentId) {
    // Only GSO and Mayor's Office can monitor budget
    $authorized = in_array($user->role, ['gso_office', 'mayors_office']);
    
    Log::info('💰 Budget channel auth check', [
        'user_id' => $user->user_id,
        'role' => $user->role,
        'department_id' => $departmentId,
        'authorized' => $authorized
    ]);
    
    return $authorized;
});

// ============================================
// GSO & MAYOR CHANNELS
// ============================================

/**
 * ✅ GSO dashboard channel
 */
Broadcast::channel('gso.dashboard', function ($user) {
    $authorized = $user->role === 'gso_office';
    
    Log::info('📋 GSO dashboard channel auth check', [
        'user_id' => $user->user_id,
        'role' => $user->role,
        'authorized' => $authorized
    ]);
    
    return $authorized;
});

/**
 * ✅ Mayor's Office dashboard channel
 */
Broadcast::channel('mayor.dashboard', function ($user) {
    $authorized = $user->role === 'mayors_office';
    
    Log::info('📋 Mayor dashboard channel auth check', [
        'user_id' => $user->user_id,
        'role' => $user->role,
        'authorized' => $authorized
    ]);
    
    return $authorized;
});

// ============================================
// SYSTEM CHANNELS
// ============================================

/**
 * ✅ System-wide broadcast (admin only)
 */
Broadcast::channel('system', function ($user) {
    // Only GSO can broadcast system-wide messages
    $authorized = $user->role === 'gso_office';
    
    Log::info('🔔 System channel auth check', [
        'user_id' => $user->user_id,
        'role' => $user->role,
        'authorized' => $authorized
    ]);
    
    return $authorized;
});