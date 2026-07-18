<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Events\NewNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    /**
     * Get user's notifications
     */
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            
            $notifications = Notification::where('recipient_user_id', $user->user_id)
                ->orderBy('created_at', 'desc')
                ->paginate(20);
            
            return response()->json([
                'success' => true,
                'data' => $notifications->items(),
                'meta' => [
                    'current_page' => $notifications->currentPage(),
                    'last_page' => $notifications->lastPage(),
                    'total' => $notifications->total(),
                    'unread_count' => Notification::where('recipient_user_id', $user->user_id)
                        ->where('is_read', false)
                        ->count(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get notifications error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'data' => [],
                'message' => 'Failed to fetch notifications'
            ], 500);
        }
    }
    
    /**
     * Get unread notification count
     */
    public function unreadCount(Request $request)
    {
        try {
            $user = $request->user();
            
            $count = Notification::where('recipient_user_id', $user->user_id)
                ->where('is_read', false)
                ->count();
            
            // ✅ FIX: Return in a consistent format that works for both web and mobile
            return response()->json([
                'success' => true,
                'data' => [
                    'unread_count' => $count
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Unread count error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'data' => [
                    'unread_count' => 0
                ]
            ], 500);
        }
    }
    
    /**
     * Mark a notification as read
     */
    public function markAsRead(Request $request, $id)
    {
        try {
            $notification = Notification::findOrFail($id);
            $user = $request->user();
            
            if ($notification->recipient_user_id !== $user->user_id) {
                return response()->json([
                    'success' => false, 
                    'message' => 'Unauthorized'
                ], 403);
            }
            
            $notification->is_read = true;
            $notification->read_at = now();
            $notification->save();
            
            // ✅ Get updated unread count
            $unreadCount = Notification::where('recipient_user_id', $user->user_id)
                ->where('is_read', false)
                ->count();
            
            return response()->json([
                'success' => true,
                'message' => 'Notification marked as read',
                'data' => [
                    'unread_count' => $unreadCount
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Mark as read error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to mark as read'
            ], 500);
        }
    }
    
    /**
     * Mark all notifications as read
     */
    public function markAllAsRead(Request $request)
    {
        try {
            $user = $request->user();
            
            $count = Notification::where('recipient_user_id', $user->user_id)
                ->where('is_read', false)
                ->update(['is_read' => true, 'read_at' => now()]);
            
            return response()->json([
                'success' => true,
                'message' => "{$count} notifications marked as read",
                'data' => [
                    'marked_count' => $count,
                    'unread_count' => 0
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Mark all as read error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to mark all as read'
            ], 500);
        }
    }

    /**
     * Store a notification (Admin only)
     */
    public function store(Request $request)
    {
        try {
            $request->validate([
                'recipient_user_id' => 'required|exists:users,user_id',
                'message' => 'required|string|max:500',
                'notification_type' => 'required|string|max:50',
                'entity_type' => 'required|string|max:50',
                'entity_id' => 'required|integer',
            ]);

            $user = $request->user();
            
            // Only admins can send notifications to others
            if ($request->recipient_user_id != $user->user_id && !$user->isGsoOffice()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to send notifications to other users'
                ], 403);
            }

            $notification = Notification::create([
                'recipient_user_id' => $request->recipient_user_id,
                'notification_type' => $request->notification_type,
                'entity_type' => $request->entity_type,
                'entity_id' => $request->entity_id,
                'message' => $request->message,
                'channel' => 'in_app',
                'is_read' => false,
                'created_at' => now(),
            ]);

            Log::info('📨 Notification created via API', [
                'notification_id' => $notification->notification_id,
                'recipient_user_id' => $notification->recipient_user_id,
                'type' => $notification->notification_type
            ]);

            // ✅ Broadcast via Reverb
            broadcast(new NewNotification(
                $notification->recipient_user_id,
                $notification->toArray()
            ));

            Log::info('✅ Notification broadcasted via Reverb', [
                'notification_id' => $notification->notification_id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Notification sent successfully',
                'data' => $notification
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('❌ Store notification error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send notification: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send a test notification to test WebSocket/Reverb connection
     */
    public function testBroadcast(Request $request)
    {
        try {
            $user = $request->user();
            
            Log::info('🧪 Test broadcast requested', [
                'user_id' => $user->user_id,
                'email' => $user->email
            ]);

            // Create a test notification
            $notification = Notification::create([
                'recipient_user_id' => $user->user_id,
                'notification_type' => 'fund_released',
                'entity_type' => 'trip_ticket',
                'entity_id' => 1,
                'message' => '💰 Test fund release from backend! Tap to view trip.',
                'channel' => 'in_app',
                'is_read' => false,
                'created_at' => now(),
            ]);

            Log::info('📨 Test notification created', [
                'notification_id' => $notification->notification_id,
                'user_id' => $user->user_id
            ]);

            // ✅ Broadcast via Reverb
            broadcast(new NewNotification(
                $user->user_id,
                $notification->toArray()
            ));

            Log::info('✅ Test notification broadcasted via Reverb', [
                'notification_id' => $notification->notification_id,
                'channel' => 'notifications.' . $user->user_id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Test notification sent via Reverb! Check your mobile app.',
                'data' => $notification
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Test broadcast error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to send test notification: ' . $e->getMessage()
            ], 500);
        }
    }
}