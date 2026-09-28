<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;  
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DriverLocationUpdated implements ShouldBroadcastNow  
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $tripId;
    public $latitude;
    public $longitude;
    public $speed;
    public $accuracy;
    public $timestamp;

    public function __construct($tripId, $latitude, $longitude, $speed = null, $accuracy = null)
    {
        $this->tripId = $tripId;
        $this->latitude = $latitude;
        $this->longitude = $longitude;
        $this->speed = $speed;
        $this->accuracy = $accuracy;
        $this->timestamp = now()->toISOString();
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
        return 'location.updated';
    }

    public function broadcastWith()
    {
        return [
            'trip_id' => $this->tripId,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'speed_kmh' => (float) ($this->speed ?? 0),
            'accuracy_meters' => (float) ($this->accuracy ?? 0),
            'timestamp' => $this->timestamp,
        ];
    }
}