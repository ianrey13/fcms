<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;  // ✅ Changed from ShouldBroadcast
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TripCompleted implements ShouldBroadcastNow  // ✅ Changed
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $tripId;
    public $latitude;
    public $longitude;

    public function __construct($tripId, $latitude, $longitude)
    {
        $this->tripId = $tripId;
        $this->latitude = $latitude;
        $this->longitude = $longitude;
    }

    public function broadcastOn()
    {
        return [
            new Channel('trip.' . $this->tripId),
            new Channel('gso-live-tracking'),
        ];
    }

    public function broadcastAs()
    {
        return 'trip.completed';
    }

    public function broadcastWith()
    {
        return [
            'trip_id' => $this->tripId,
            'end_latitude' => (float) $this->latitude,
            'end_longitude' => (float) $this->longitude,
            'timestamp' => now()->toISOString(),
        ];
    }
}