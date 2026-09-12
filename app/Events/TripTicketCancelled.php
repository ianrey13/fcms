<?php
// app/Events/TripTicketCancelled.php

namespace App\Events;

use App\Models\TripTicket;

class TripTicketCancelled extends TripTicketEvent
{
    public function __construct(TripTicket $tripTicket, $reason = null, $actor = null)
    {
        $additionalData = [
            'reason' => $reason,
            'cancelled_at' => now()->toISOString(),
            'cancelled_by' => $actor?->user_id,
        ];
        
        parent::__construct($tripTicket, 'cancelled', $actor, $additionalData);
    }

    public function broadcastAs()
    {
        return 'trip.cancelled';
    }
}