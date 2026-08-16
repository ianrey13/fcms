<?php
// app/Models/TripHistory.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TripHistory extends Model
{
    protected $table = 'trip_history';
    protected $primaryKey = 'history_id';
    
    protected $fillable = [
        'trip_ticket_id',
        'trip_number',
        'start_lat',
        'start_lng',
        'started_at',
        'end_lat',
        'end_lng',
        'ended_at',
        'distance_km',
        'status',
    ];
    
    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'start_lat' => 'decimal:7',
        'start_lng' => 'decimal:7',
        'end_lat' => 'decimal:7',
        'end_lng' => 'decimal:7',
        'distance_km' => 'decimal:2',
    ];
    
    // ============ RELATIONSHIPS ============
    
    public function tripTicket()
    {
        return $this->belongsTo(TripTicket::class, 'trip_ticket_id', 'trip_ticket_id');
    }
    
    // ============ HELPERS ============
    
    public function getDurationAttribute(): ?string
    {
        if ($this->started_at && $this->ended_at) {
            $minutes = $this->started_at->diffInMinutes($this->ended_at);
            if ($minutes < 60) {
                return $minutes . ' min';
            }
            $hours = floor($minutes / 60);
            $mins = $minutes % 60;
            return $hours . 'h ' . $mins . 'm';
        }
        return null;
    }
    
    public function getStartedAtFormattedAttribute(): string
    {
        return $this->started_at ? $this->started_at->format('M d, Y h:i A') : 'N/A';
    }
    
    public function getEndedAtFormattedAttribute(): string
    {
        return $this->ended_at ? $this->ended_at->format('M d, Y h:i A') : 'In Progress';
    }
}