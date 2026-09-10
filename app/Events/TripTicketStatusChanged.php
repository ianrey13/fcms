<?php
// app/Events/TripTicketStatusChanged.php

namespace App\Events;

use App\Models\TripTicket;

class TripTicketStatusChanged extends TripTicketEvent
{
    public function __construct(TripTicket $tripTicket, $oldStatus, $newStatus, $actor = null)
    {
        $additionalData = [
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'status_changed' => true,
        ];
        
        parent::__construct($tripTicket, 'status_changed', $actor, $additionalData);
    }

    public function broadcastAs()
    {
        return 'trip.status_changed';
    }
}