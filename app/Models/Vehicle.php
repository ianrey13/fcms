<?php

namespace App\Models;
use App\Traits\LogsActivity;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    use LogsActivity;
    protected $table = 'vehicles';
    protected $primaryKey = 'vehicle_id';
    
    protected $fillable = [
        'department_id', 'vehicle_model', 'plate_number', 'fuel_type',
        'status', 'odometer_status', 'maintenance_flag',
        'deactivated_by', 'deactivation_reason', 
        'odometer_broken_since',
        'odometer_repair_requested',
        'odometer_repair_completed_at',
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deactivated_at' => 'datetime',
        'maintenance_flag' => 'boolean',
        'odometer_broken_since' => 'date',
        'odometer_repair_requested' => 'boolean',
        'odometer_repair_completed_at' => 'datetime',
    ];
    
    // Relationships (keep all your existing relationships)
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }
    
    public function deactivatedBy()
    {
        return $this->belongsTo(User::class, 'deactivated_by', 'user_id');
    }
    
    public function tripTickets()
    {
        return $this->hasMany(TripTicket::class, 'vehicle_id', 'vehicle_id');
    }
    
    public function tripTicketSnapshots()
    {
        return $this->hasMany(TripTicketVehicleSnapshot::class, 'vehicle_id', 'vehicle_id');
    }
    
    public function departmentRequests()
    {
        return $this->hasMany(DepartmentRequest::class, 'affected_vehicle_id', 'vehicle_id');
    }
    
    public function deptCrudRequests()
    {
        return $this->hasMany(DeptCrudRequest::class, 'affected_vehicle_id', 'vehicle_id');
    }
    
    public function odometerStatuses()
    {
        return $this->hasMany(VehicleOdometerStatus::class, 'vehicle_id', 'vehicle_id');
    }
    
    // Helper methods
    public function isActive()
    {
        return $this->status === 'active';
    }
    
    public function isUnderMaintenance()
    {
        return $this->maintenance_flag;
    }
    
    public function isOdometerFunctional()
    {
        return $this->odometer_status === 'functional';
    }
}