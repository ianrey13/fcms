<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Driver extends Model
{
    protected $table = 'drivers';
    protected $primaryKey = 'driver_id';
    
    protected $fillable = [
        'user_id', 'license_number', 'license_expiry', 'status'
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'license_expiry' => 'date',
    ];
    
    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
    
    public function tripTickets()
    {
        return $this->hasMany(TripTicket::class, 'driver_id', 'driver_id');
    }
    
    // Helper methods
    public function isActive()
    {
        return $this->status === 'active';
    }
    
    public function hasValidLicense()
    {
        return $this->license_expiry && $this->license_expiry->isFuture();
    }
}