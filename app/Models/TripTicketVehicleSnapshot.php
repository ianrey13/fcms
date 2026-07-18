<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TripTicketVehicleSnapshot extends Model
{
    protected $table = 'trip_vehicle_snapshot';
    protected $primaryKey = 'trip_ticket_id';
    public $incrementing = false;
    public $timestamps = false;
    
    protected $fillable = [
        'trip_ticket_id', 'vehicle_status', 'fuel_type', 'snapshot_taken_at'
    ];
    
    protected $casts = [
        'snapshot_taken_at' => 'datetime'
    ];
    
    public function tripTicket()
    {
        return $this->belongsTo(TripTicket::class, 'trip_ticket_id', 'trip_ticket_id');
    }
}