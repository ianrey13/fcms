<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VehicleOdometerStatus extends Model
{
    protected $table = 'vehicle_odometer_status';
    protected $primaryKey = 'status_id';
    public $timestamps = false;
    
    protected $fillable = [
        'vehicle_id', 'status', 'reported_by', 'reported_at'
    ];
    
    protected $casts = [
        'reported_at' => 'datetime'
    ];
    
    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'vehicle_id');
    }
    
    public function reportedBy()
    {
        return $this->belongsTo(User::class, 'reported_by', 'user_id');
    }
}