<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GpsPing extends Model
{
    protected $table = 'gps_ping';
    protected $primaryKey = 'ping_id';
    public $timestamps = false;
    
    protected $fillable = [
        'trip_ticket_id',
        'latitude',
        'longitude',
        'accuracy_meters',
        'speed_kmh',
        'heading_degrees',
        'is_low_accuracy',
        'is_queued_upload',
        'has_mock_location_flag',
        'recorded_at',
        'received_at',
    ];
    
    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'accuracy_meters' => 'float',
        'speed_kmh' => 'float',
        'heading_degrees' => 'float',
        'is_low_accuracy' => 'boolean',
        'is_queued_upload' => 'boolean',
        'has_mock_location_flag' => 'boolean',
        'recorded_at' => 'datetime',
        'received_at' => 'datetime',
    ];
    
    public function tripTicket()
    {
        return $this->belongsTo(TripTicket::class, 'trip_ticket_id', 'trip_ticket_id');
    }
}