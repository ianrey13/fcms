<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class NewNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $userId;
    public $notification;
    public $delay;

    public function __construct($userId, $notification, $delay = 0)
    {
        Log::info('🎯 NewNotification EVENT CREATED', [
            'user_id' => $userId,
            'notification_id' => $notification['notification_id'] ?? null,
            'type' => $notification['notification_type'] ?? null,
            'delay' => $delay
        ]);
        
        $this->userId = $userId;
        $this->notification = $notification;
        $this->delay = $delay;
    }

    /**
     * ✅ Using notifications.{userId} channel (matches channels.php)
     */
    public function broadcastOn()
    {
        Log::info('📡 NewNotification broadcastOn called', [
            'user_id' => $this->userId,
            'channel' => 'notifications.' . $this->userId
        ]);
        
        return new PrivateChannel('notifications.' . $this->userId);
    }

    public function broadcastAs()
    {
        return 'notification.new';
    }

    public function broadcastWith()
    {
        return [
            'notification_id' => $this->notification['notification_id'] ?? null,
            'recipient_user_id' => $this->notification['recipient_user_id'] ?? null,
            'notification_type' => $this->notification['notification_type'] ?? null,
            'entity_type' => $this->notification['entity_type'] ?? null,
            'entity_id' => $this->notification['entity_id'] ?? null,
            'message' => $this->notification['message'] ?? null,
            'channel' => $this->notification['channel'] ?? null,
            'is_read' => $this->notification['is_read'] ?? false,
            'created_at' => $this->notification['created_at'] ?? now()->toDateTimeString(),
        ];
    }

    /**
     * Determine if the notification should be broadcast
     */
    public function broadcastWhen()
    {
        $user = \App\Models\User::find($this->userId);
        return $user && $user->status === 'active';
    }
}