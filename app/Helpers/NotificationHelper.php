<?php

namespace App\Helpers;

use App\Models\Notification;
use App\Events\NewNotification;
use App\Models\User;
use App\Services\ExpoPushService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class NotificationHelper
{
    /**
     * Send notification to a single user with real-time broadcast
     * and (if the user has a push token) an Expo push.
     *
     * Push dispatch is best-effort and NEVER blocks the notification insert.
     */
    public static function send($userId, $type, $entityType, $entityId, $message, $channel = 'in_app', $delay = 0)
    {
        $startTime = microtime(true);
        Log::info('🔔 NotificationHelper::send START at ' . now()->toDateTimeString());

        try {
            DB::beginTransaction();

            $notification = Notification::create([
                'recipient_user_id' => $userId,
                'notification_type' => $type,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'message' => $message,
                'channel' => $channel,
                'is_read' => false,
                'created_at' => now(),
            ]);

            DB::commit();

            $createTime = microtime(true) - $startTime;
            Log::info('✅ Notification created in ' . round($createTime, 4) . 's', [
                'notification_id' => $notification->notification_id,
                'user_id' => $userId
            ]);

            // ✅ Broadcast in its OWN try/catch — must NEVER break the parent transaction
            try {
                broadcast(new NewNotification($userId, $notification->toArray(), $delay));

                $totalTime = microtime(true) - $startTime;
                Log::info('📡 Broadcast sent in ' . round($totalTime, 4) . 's');
            } catch (\Exception $broadcastError) {
                Log::warning('⚠️ Broadcast failed (notification still saved)', [
                    'error' => $broadcastError->getMessage(),
                    'notification_id' => $notification->notification_id,
                    'user_id' => $userId,
                ]);
                // Do NOT rethrow — the notification is already persisted
            }

            // ✅ ALSO dispatch an Expo push — works even when app is closed.
            // Wrapped in its own try/catch so a failed push never breaks the flow.
            // Users without a push_token (web GSO/MO) are silently skipped.
            try {
                $user = User::find($userId);
                if ($user && $user->push_token) {
                    $title = self::buildPushTitle($type);
                    $body = $message;
                    $data = [
                        'notification_id' => $notification->notification_id,
                        'notification_type' => $type,
                        'entity_type' => $entityType,
                        'entity_id' => $entityId,
                    ];

                    app(ExpoPushService::class)->send($user->push_token, $title, $body, $data);
                }
            } catch (\Exception $pushError) {
                Log::warning('⚠️ Expo push failed (notification still saved)', [
                    'error' => $pushError->getMessage(),
                    'notification_id' => $notification->notification_id,
                    'user_id' => $userId,
                ]);
            }

            return $notification;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ Notification error: ' . $e->getMessage(), [
                'user_id' => $userId,
                'type' => $type,
                'entity_type' => $entityType,
                'entity_id' => $entityId
            ]);
            return null;
        }
    }

    /**
     * Send fund release notification to driver
     */
    public static function sendFundRelease($driverId, $tripId, $tripNumber, $amount)
    {
        $message = "Funds of ₱{$amount} have been released for trip {$tripNumber}";

        // Get driver user ID
        $driver = \App\Models\Driver::where('driver_id', $driverId)->first();
        if (!$driver) {
            Log::error('Driver not found for fund release notification', ['driver_id' => $driverId]);
            return null;
        }

        return self::send(
            $driver->user_id,
            'fund_released',
            'trip_ticket',
            $tripId,
            $message,
            'push'  // Send as push notification
        );
    }

    /**
     * Send trip assignment notification to driver
     */
    public static function sendTripAssignment($driverId, $tripId, $tripNumber, $destination)
    {
        $message = "You have been assigned to trip {$tripNumber} to {$destination}";

        $driver = \App\Models\Driver::where('driver_id', $driverId)->first();
        if (!$driver) {
            Log::error('Driver not found for trip assignment notification', ['driver_id' => $driverId]);
            return null;
        }

        return self::send(
            $driver->user_id,
            'trip_assigned',
            'trip_ticket',
            $tripId,
            $message,
            'push'
        );
    }

    /**
     * Send notification to multiple users
     */
    public static function sendToMany($userIds, $type, $entityType, $entityId, $message, $channel = 'in_app')
    {
        $notifications = [];
        foreach ($userIds as $userId) {
            $notification = self::send($userId, $type, $entityType, $entityId, $message, $channel);
            if ($notification) {
                $notifications[] = $notification;
            }
        }
        return $notifications;
    }

    /**
     * Send notification to all users with a specific role
     */
    public static function sendToRole($role, $type, $entityType, $entityId, $message, $channel = 'in_app')
    {
        $users = User::where('role', $role)
            ->where('status', 'active')
            ->get();

        $notifications = [];
        foreach ($users as $user) {
            $notification = self::send($user->user_id, $type, $entityType, $entityId, $message, $channel);
            if ($notification) {
                $notifications[] = $notification;
            }
        }
        return $notifications;
    }

    /**
     * Send notification to all users in a department
     */
    public static function sendToDepartment($departmentId, $type, $entityType, $entityId, $message, $channel = 'in_app')
    {
        $users = User::where('department_id', $departmentId)
            ->where('status', 'active')
            ->get();

        $notifications = [];
        foreach ($users as $user) {
            $notification = self::send($user->user_id, $type, $entityType, $entityId, $message, $channel);
            if ($notification) {
                $notifications[] = $notification;
            }
        }
        return $notifications;
    }

    /**
     * Mark notification as read
     */
    public static function markAsRead($notificationId, $userId)
    {
        $notification = Notification::where('notification_id', $notificationId)
            ->where('recipient_user_id', $userId)
            ->first();

        if ($notification) {
            $notification->is_read = true;
            $notification->read_at = now();
            $notification->save();
            return true;
        }

        return false;
    }

    /**
     * Mark all notifications as read for a user
     */
    public static function markAllAsRead($userId)
    {
        return Notification::where('recipient_user_id', $userId)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now()
            ]);
    }

    /**
     * Get unread notification count for a user
     */
    public static function getUnreadCount($userId)
    {
        return Notification::where('recipient_user_id', $userId)
            ->where('is_read', false)
            ->count();
    }

    /**
     * Get all notifications for a user with pagination
     */
    public static function getNotifications($userId, $limit = 20, $offset = 0)
    {
        return Notification::where('recipient_user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->skip($offset)
            ->take($limit)
            ->get();
    }

    /**
     * Map notification_type → human-friendly push title
     */
    private static function buildPushTitle(string $type): string
    {
        $titles = [
            'fund_released' => 'Funds Released',
            'fund_issued' => 'Funds Issued',
            'trip_assigned' => 'New Trip Assigned',
            'trip_created' => 'Trip Created',
            'trip_started' => 'Trip Started',
            'trip_completed' => 'Trip Completed',
            'trip_cancelled' => 'Trip Cancelled',
            'trip_closed' => 'Trip Closed',
            'driver_acknowledged' => 'Acknowledged',
            'receipt_uploaded' => 'Receipt Uploaded',
            'mo_approved' => 'Approved by MO',
            'mo_rejected' => 'Rejected by MO',
            'gso_rejected' => 'Rejected by GSO',
            'budget_low_warning' => 'Budget Low',
            'trip_pending_validation' => 'Pending Validation',
        ];

        return $titles[$type] ?? 'FCMS Notification';
    }
}