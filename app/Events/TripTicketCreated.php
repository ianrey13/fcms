<?php
// app/Events/TripTicketCreated.php
namespace App\Events;

class TripTicketCreated extends TripTicketEvent
{
    public function __construct($tripTicket)
    {
        parent::__construct($tripTicket, 'created');
    }

    public function broadcastAs()
    {
        return 'trip-ticket.created';
    }
}