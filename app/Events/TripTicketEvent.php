<?php
// app/Events/TripTicketEvent.php
namespace App\Events;

use App\Models\TripTicket;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

abstract class TripTicketEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $tripTicket;
    public $action;
    public $actor;
    public $additionalData;

    public function __construct(TripTicket $tripTicket, $action, $actor = null, $additionalData = [])
    {
        Log::info('📡 TripTicketEvent created', [
            'ticket_id' => $tripTicket->trip_ticket_id,
            'action' => $action,
            'actor' => $actor ?? auth()->user()->name ?? 'System'
        ]);
        
        $this->tripTicket = $tripTicket;
        $this->action = $action;
        $this->actor = $actor ?? auth()->user()->name ?? 'System';
        $this->additionalData = $additionalData;
    }

    public function broadcastOn()
    {
        $channels = [
            new PrivateChannel('gso.dashboard'),
            new PrivateChannel('mayor.dashboard'),
            new PrivateChannel('department.' . $this->tripTicket->department_id),
        ];

        // If driver assigned, broadcast to driver
        if ($this->tripTicket->driver_id) {
            $channels[] = new PrivateChannel('driver.' . $this->tripTicket->driver_id);
        }

        // If driver user exists, broadcast to their user channel too
        if ($this->tripTicket->driver && $this->tripTicket->driver->user) {
            $channels[] = new PrivateChannel('user.' . $this->tripTicket->driver->user->user_id);
        }

        // Broadcast to submitter
        if ($this->tripTicket->submitted_by) {
            $channels[] = new PrivateChannel('user.' . $this->tripTicket->submitted_by);
        }

        Log::info('📡 Broadcasting to channels', [
            'channels' => array_map(function($ch) {
                return $ch->name;
            }, $channels)
        ]);

        return $channels;
    }

    public function broadcastWith()
    {
        $data = [
            'trip_ticket_id' => $this->tripTicket->trip_ticket_id,
            'ticket_number' => $this->tripTicket->trip_ticket_number,
            'destination' => $this->tripTicket->destination,
            'purpose' => $this->tripTicket->purpose,
            'status' => $this->tripTicket->status,
            'action' => $this->action,
            'actor' => $this->actor,
            'department_id' => $this->tripTicket->department_id,
            'department_name' => $this->tripTicket->department?->department_name,
            'driver_name' => $this->tripTicket->driver?->user?->full_name,
            'vehicle_plate' => $this->tripTicket->vehicle?->plate_number,
            'trip_date' => $this->tripTicket->trip_date,
            'amount_released' => $this->tripTicket->gasSlip?->amount_released,
            'created_at' => $this->tripTicket->created_at->toDateTimeString(),
            'updated_at' => now()->toDateTimeString(),
        ];

        // Merge additional data
        return array_merge($data, $this->additionalData);
    }
}