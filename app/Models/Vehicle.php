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
        'current_fuel_balance',
        'last_odometer_reading',
        'fuel_capacity',
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deactivated_at' => 'datetime',
        'maintenance_flag' => 'boolean',
        'odometer_broken_since' => 'date',
        'odometer_repair_requested' => 'boolean',
        'odometer_repair_completed_at' => 'datetime',
        'current_fuel_balance' => 'decimal:2',
        'last_odometer_reading' => 'decimal:2',
        'fuel_capacity' => 'decimal:2',
    ];
    
    // ============ RELATIONSHIPS ============
    
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
    
    // ============ ✅ 1 VEHICLE = 1 ACTIVE TRIP POLICY ============
    
    /**
     * ✅ Get all active trip statuses
     */
    public static function getActiveTripStatuses(): array
    {
        return [
            TripTicket::STATUS_PENDING_MAYORS_OFFICE,
            TripTicket::STATUS_FUNDS_ISSUED,
            TripTicket::STATUS_ACKNOWLEDGED,
            TripTicket::STATUS_IN_TRANSIT,
           
            // TripTicket::STATUS_PENDING_RECONCILIATION,
        ];
    }
    
    /**
     * ✅ Check if vehicle has an active trip
     */
    public function hasActiveTrip(): bool
    {
        return $this->tripTickets()
            ->whereIn('status', self::getActiveTripStatuses())
            ->exists();
    }
    
    /**
     * ✅ Get the active trip of this vehicle
     */
    public function getActiveTrip(): ?TripTicket
    {
        return $this->tripTickets()
            ->whereIn('status', self::getActiveTripStatuses())
            ->first();
    }
    
    /**
     * ✅ Check if vehicle is available for new trip
     */
    public function isAvailableForTrip(): bool
    {
        return !$this->hasActiveTrip() && $this->status === 'active';
    }
    
    /**
     * ✅ Get vehicle availability status with details
     */
    public function getAvailabilityStatus(): array
    {
        $activeTrip = $this->getActiveTrip();
        
        return [
            'is_available' => $this->isAvailableForTrip(),
            'has_active_trip' => $this->hasActiveTrip(),
            'active_trip_id' => $activeTrip ? $activeTrip->trip_ticket_id : null,
            'active_trip_number' => $activeTrip ? $activeTrip->trip_ticket_number : null,
            'active_trip_status' => $activeTrip ? $activeTrip->status : null,
            'reason' => $this->hasActiveTrip() 
                ? 'Vehicle is currently assigned to trip #' . ($activeTrip ? $activeTrip->trip_ticket_number : '')
                : ($this->status !== 'active' 
                    ? 'Vehicle is not active' 
                    : 'Available'),
        ];
    }
    
    // ============ HELPER METHODS ============
    
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

    /**
     * Update fuel balance
     */
    public function updateFuelBalance(float $litersUsed): void
    {
        $this->current_fuel_balance = max(0, $this->current_fuel_balance - $litersUsed);
        $this->save();
    }

    /**
     * Add fuel to vehicle
     */
    public function addFuel(float $liters): void
    {
        $this->current_fuel_balance = min($this->fuel_capacity, $this->current_fuel_balance + $liters);
        $this->save();
    }

    /**
     * Get fuel percentage
     */
    public function getFuelPercentageAttribute(): float
    {
        if ($this->fuel_capacity == 0) return 0;
        return round(($this->current_fuel_balance / $this->fuel_capacity) * 100, 2);
    }

    /**
     * Get fuel status (Sufficient, Low, Critical)
     */
    public function getFuelStatusAttribute(): string
    {
        $percentage = $this->fuel_percentage;
        
        if ($percentage > 50) return 'Sufficient';
        if ($percentage > 25) return 'Low';
        return 'Critical';
    }

    /**
     * Get fuel status color
     */
    public function getFuelStatusColorAttribute(): string
    {
        $percentage = $this->fuel_percentage;
        
        if ($percentage > 50) return 'green-500';
        if ($percentage > 25) return 'yellow-500';
        return 'red-500';
    }
}