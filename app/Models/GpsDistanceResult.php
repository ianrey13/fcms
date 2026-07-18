<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GpsDistanceResult extends Model
{
    protected $table = 'gps_distance_result';
    protected $primaryKey = 'result_id';
    public $timestamps = false;
    
    protected $fillable = [
        'trip_ticket_id', 'gps_total_km', 'ping_count', 'computed_at'
    ];
    
    protected $casts = [
        'computed_at' => 'datetime',
        'gps_total_km' => 'decimal:2'
    ];
    
    public function tripTicket()
    {
        return $this->belongsTo(TripTicket::class, 'trip_ticket_id', 'trip_ticket_id');
    }
}