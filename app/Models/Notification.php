<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $table = 'notifications';
    protected $primaryKey = 'notification_id';
    public $timestamps = false;
    
    protected $fillable = [
        'recipient_user_id', 
        'notification_type', 
        'entity_type', 
        'entity_id',
        'message', 
        'channel', 
        'is_read', 
        'created_at', 
        'read_at'
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'read_at' => 'datetime',
        'is_read' => 'boolean'
    ];

    // ============ TO ARRAY (for broadcasting) ============
    
    public function toArray()
    {
        return [
            'notification_id' => $this->notification_id,
            'recipient_user_id' => $this->recipient_user_id,
            'notification_type' => $this->notification_type,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'message' => $this->message,
            'channel' => $this->channel,
            'is_read' => $this->is_read,
            'created_at' => $this->created_at?->toDateTimeString(),
            'read_at' => $this->read_at?->toDateTimeString(),
        ];
    }
    
    // ============ SCOPES ============
    
    public function scopeForUser($query, $userId)
    {
        return $query->where('recipient_user_id', $userId);
    }
    
    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }
    
    public function scopeRead($query)
    {
        return $query->where('is_read', true);
    }
    
    public function scopeOfType($query, $type)
    {
        return $query->where('notification_type', $type);
    }
    
    public function scopeOfEntity($query, $entityType, $entityId = null)
    {
        $query->where('entity_type', $entityType);
        if ($entityId) {
            $query->where('entity_id', $entityId);
        }
        return $query;
    }
    
    public function scopeBudgetAssistance($query)
    {
        return $query->where('notification_type', 'budget_assistance_request');
    }
    
    public function scopeTripRelated($query)
    {
        return $query->whereIn('notification_type', [
            'trip_submitted',
            'trip_created',
            'gso_approved',
            'gso_rejected',
            'mo_approved',
            'mo_rejected',
            'fund_issued',
            'trip_started',
            'trip_completed'
        ]);
    }
    
    // ============ METHODS ============
    
    public function markAsRead()
    {
        $this->is_read = true;
        $this->read_at = now();
        $this->save();
        return $this;
    }
    
    public function markAsUnread()
    {
        $this->is_read = false;
        $this->read_at = null;
        $this->save();
        return $this;
    }
    
    public function isRead()
    {
        return $this->is_read === true;
    }
    
    public function isUnread()
    {
        return $this->is_read === false;
    }
    
    public function getTimeAgoAttribute()
    {
        $now = now();
        $created = $this->created_at;
        $diff = $now->diffInMinutes($created);
        
        if ($diff < 1) {
            return 'Just now';
        } elseif ($diff < 60) {
            return $diff . ' minute' . ($diff > 1 ? 's' : '') . ' ago';
        } elseif ($diff < 1440) {
            $hours = floor($diff / 60);
            return $hours . ' hour' . ($hours > 1 ? 's' : '') . ' ago';
        } else {
            $days = floor($diff / 1440);
            return $days . ' day' . ($days > 1 ? 's' : '') . ' ago';
        }
    }
    
    public function getShortMessageAttribute($length = 100)
    {
        if (strlen($this->message) <= $length) {
            return $this->message;
        }
        return substr($this->message, 0, $length) . '...';
    }
    
    // ============ RELATIONSHIPS ============
    
    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_user_id', 'user_id');
    }
    
    public function getEntity()
    {
        switch ($this->entity_type) {
            case 'trip_ticket':
                return TripTicket::find($this->entity_id);
            case 'gas_slip':
                return GasSlip::find($this->entity_id);
            case 'mo_request':
                return null;
            default:
                return null;
        }
    }
    
    // ============ PUSH NOTIFICATION HELPERS ============
    
    /**
     * Get push tokens for the recipient
     */
    public function getRecipientPushTokens()
    {
        if (!$this->recipient) {
            return collect();
        }
        
        return PushToken::where('user_id', $this->recipient_user_id)
            ->where('is_active', true)
            ->get();
    }
    
    /**
     * Check if notification should send push
     */
    public function shouldSendPush()
    {
        // Notification types that should trigger push
        $pushTypes = [
            'fund_released',
            'fund_issued',
            'trip_assigned',
            'trip_started',
            'trip_completed',
            'mo_approved',
            'budget_low_warning',
            'trip_created',
            'trip_submitted',
        ];
        
        return in_array($this->notification_type, $pushTypes) && 
               ($this->channel === 'push' || $this->channel === 'both');
    }
    
    /**
     * Get push notification title based on type
     */
    public function getPushTitle()
    {
        $titles = [
            'fund_released' => '💰 Fund Released',
            'fund_issued' => '💰 Fund Issued',
            'trip_assigned' => '🚗 New Trip Assigned',
            'trip_started' => '🚗 Trip Started',
            'trip_completed' => '✅ Trip Completed',
            'mo_approved' => '✅ Trip Approved',
            'mo_rejected' => '❌ Trip Rejected',
            'budget_low_warning' => '⚠️ Budget Low',
            'trip_created' => '📄 New Trip',
            'trip_submitted' => '📋 Trip Submitted',
        ];

        return $titles[$this->notification_type] ?? '📨 New Notification';
    }
    
    /**
     * Get push notification data payload
     */
    public function getPushData()
    {
        return [
            'notification_id' => $this->notification_id,
            'type' => $this->notification_type,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'message' => $this->message,
        ];
    }
    
    // ============ ICON & COLOR HELPERS ============
    
    public function getIconAttribute()
    {
        $icons = [
            'trip_submitted' => '📋',
            'trip_created' => '📄',
            'gso_approved' => '✅',
            'gso_rejected' => '❌',
            'mo_approved' => '💰',
            'mo_rejected' => '🚫',
            'fund_issued' => '💵',
            'fund_released' => '💵',
            'trip_assigned' => '🚗',
            'trip_started' => '🚗',
            'trip_completed' => '🏁',
            'budget_low_warning' => '⚠️',
            'budget_assistance_request' => '🆘',
            'fund_return_pending' => '↩️',
            'mo_created_ticket' => '📝',
        ];
        
        return $icons[$this->notification_type] ?? '🔔';
    }
    
    public function getColorClassAttribute()
    {
        $colors = [
            'trip_submitted' => 'blue',
            'trip_created' => 'green',
            'gso_approved' => 'green',
            'gso_rejected' => 'red',
            'mo_approved' => 'green',
            'mo_rejected' => 'red',
            'fund_issued' => 'green',
            'fund_released' => 'green',
            'trip_assigned' => 'blue',
            'trip_started' => 'blue',
            'trip_completed' => 'green',
            'budget_low_warning' => 'yellow',
            'budget_assistance_request' => 'orange',
            'fund_return_pending' => 'yellow',
            'mo_created_ticket' => 'purple',
        ];
        
        return $colors[$this->notification_type] ?? 'gray';
    }
}