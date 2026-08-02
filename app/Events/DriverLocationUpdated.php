<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DriverLocationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $location;
    public $tripId;

    public function __construct($location, $tripId)
    {
        $this->location = $location;
        $this->tripId = $tripId;
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel('trip.' . $this->tripId),
            new PrivateChannel('gso.dashboard'),
        ];
    }

    public function broadcastAs()
    {
        return 'driver.location.updated';
    }

    public function broadcastWith()
    {
        return [
            'trip_id' => $this->tripId,
            'location' => $this->location,
        ];
    }
}