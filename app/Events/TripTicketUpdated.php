<?php
// app/Events/TripTicketUpdated.php

namespace App\Events;

use App\Models\TripTicket;

class TripTicketUpdated extends TripTicketEvent
{
    public function __construct(TripTicket $tripTicket, $oldStatus, $newStatus, $actor = null)
    {
        $additionalData = [
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
        ];
        
        parent::__construct($tripTicket, 'updated', $actor, $additionalData);
    }

    public function broadcastAs()
    {
        return 'trip.updated';
    }
}