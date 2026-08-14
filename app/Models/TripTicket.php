<?php

namespace App\Models;
use App\Traits\LogsActivity;

use Illuminate\Database\Eloquent\Model;

class TripTicket extends Model
{
    use LogsActivity;
    protected $table = 'trip_ticket';
    protected $primaryKey = 'trip_ticket_id';
    public $timestamps = false;

    protected $fillable = [
        'trip_ticket_number',
        'department_id',
        'driver_id',
        'vehicle_id',
        'submitted_by',        // GSO user who creates the trip
        'created_by_mo_user_id',
        'submitted_by_staff',  // ✅ Replaced submitted_by_head
        'submitted_at',
        'trip_date',
        'purpose',
        'destination',
        'charge_to',
        'passenger_name',
        'status',
        'updated_at',
        'estimated_distance_km',
        'estimated_fuel_liters',
        'original_charge_to',
        'charge_to_modified_by',
        'charge_to_modified_at',
        'charge_to_modification_reason',
        'odometer_exception',
        'odometer_exception_note',
        'odometer_exception_approved_by',
        'odometer_exception_approved_at',
        'has_insufficient_budget',
        'budget_shortage',
        'original_department_id',
         'actual_distance_km',
        'actual_fuel_used',
        'fuel_balance_before',
        'fuel_balance_after',
        'odometer_start',
        'odometer_end',
        'is_fuel_issued_without_trip',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'updated_at' => 'datetime',
        'trip_date' => 'date',
        'submitted_by_staff' => 'boolean',  // ✅ Changed from submitted_by_head
        'odometer_exception' => 'boolean',
        'has_insufficient_budget' => 'boolean',
        'estimated_distance_km' => 'decimal:2',
        'estimated_fuel_liters' => 'decimal:2',
        'budget_shortage' => 'decimal:2',
         'actual_distance_km' => 'decimal:2',
        'actual_fuel_used' => 'decimal:2',
        'fuel_balance_before' => 'decimal:2',
        'fuel_balance_after' => 'decimal:2',
        'odometer_start' => 'decimal:2',
        'odometer_end' => 'decimal:2',
        'is_fuel_issued_without_trip' => 'boolean',
    ];

    // ============ STATUS CONSTANTS ============
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_MAYORS_OFFICE = 'pending_mayors_office';  // ✅ GSO creates directly
    public const STATUS_RETURNED_FOR_REVISION = 'returned_for_revision';
    public const STATUS_FUNDS_ISSUED = 'funds_issued';
    public const STATUS_IN_TRANSIT = 'in_transit';
    public const STATUS_COMPLETED = 'completed';  

    // public const STATUS_PENDING_RECONCILIATION = 'pending_reconciliation';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_ACKNOWLEDGED = 'acknowledged';

public const STATUS_PENDING_GSO_VALIDATION = 'pending_gso_validation';


    // ❌ REMOVED: STATUS_PENDING_HEAD_APPROVAL, STATUS_PENDING_GSO_REVIEW, STATUS_WITH_MAYORS_OFFICE

    // ============ RELATIONSHIPS ============
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'driver_id', 'driver_id');
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'vehicle_id');
    }

    public function submittedBy()
    {
        return $this->belongsTo(User::class, 'submitted_by', 'user_id');
    }

    public function createdByMO()
    {
        return $this->belongsTo(User::class, 'created_by_mo_user_id', 'user_id');
    }

    // ❌ REMOVED: headApprovals(), latestHeadApproval() - Head approval removed
    // ❌ REMOVED: gsoVerifications(), latestGsoVerification() - GSO verification removed
    // ❌ REMOVED: moReviews(), latestMoReview() - MO Review merged into gas_slip

    public function gasSlip()
    {
        return $this->hasOne(GasSlip::class, 'trip_ticket_id', 'trip_ticket_id');
    }

    public function vehicleSnapshot()
    {
        return $this->hasOne(TripTicketVehicleSnapshot::class, 'trip_ticket_id', 'trip_ticket_id');
    }

    public function returns()
    {
        return $this->hasMany(TripTicketReturn::class, 'trip_ticket_id', 'trip_ticket_id');
    }

    public function cancellation()
    {
        return $this->hasOne(TripTicketCancellation::class, 'trip_ticket_id', 'trip_ticket_id');
    }

    public function chargeToModifiedBy()
    {
        return $this->belongsTo(User::class, 'charge_to_modified_by', 'user_id');
    }

    public function odometerExceptionApprovedBy()
    {
        return $this->belongsTo(User::class, 'odometer_exception_approved_by', 'user_id');
    }

    // ============ SCOPES ============
    public function scopePendingMO($query)
    {
        return $query->where('status', self::STATUS_PENDING_MAYORS_OFFICE);
    }

    public function scopeFundsIssued($query)
    {
        return $query->where('status', self::STATUS_FUNDS_ISSUED);
    }

    public function scopeInTransit($query)
    {
        return $query->where('status', self::STATUS_IN_TRANSIT);
    }

    public function scopeClosed($query)
    {
        return $query->where('status', self::STATUS_CLOSED);
    }

    // ============ HELPER METHODS ============
    
    public function canAcknowledge()
    {
        return $this->status === self::STATUS_FUNDS_ISSUED;
    }

    public function canStartTrip()
    {
        return $this->status === self::STATUS_FUNDS_ISSUED || $this->status === self::STATUS_ACKNOWLEDGED;
    }

    public function canCompleteTrip()
    {
        return $this->status === self::STATUS_IN_TRANSIT;
    }

    public function isGsoCreated()
    {
        return !$this->submitted_by_staff;  // ✅ GSO created if not submitted by staff
    }

    public function isStaffCreated()
    {
        return $this->submitted_by_staff;
    }

   public function getStatusLabelAttribute()
{
    $labels = [
        self::STATUS_DRAFT => 'Draft',
        self::STATUS_PENDING_MAYORS_OFFICE => 'Pending Mayor\'s Office',
        self::STATUS_RETURNED_FOR_REVISION => 'Returned for Revision',
        self::STATUS_FUNDS_ISSUED => 'Funds Issued',
        self::STATUS_IN_TRANSIT => 'In Transit',
        self::STATUS_PENDING_GSO_VALIDATION => 'Pending GSO Validation',  // ✅ NEW
                self::STATUS_COMPLETED => 'Completed (Pending GSO)',  // ✅ NEW

        self::STATUS_CLOSED => 'Closed',
        self::STATUS_REJECTED => 'Rejected',
        self::STATUS_CANCELLED => 'Cancelled',
        self::STATUS_ACKNOWLEDGED => 'Acknowledged',
    ];
    return $labels[$this->status] ?? $this->status;
}

public function getStatusColorAttribute()
{
    $colors = [
        self::STATUS_DRAFT => 'gray',
        self::STATUS_PENDING_MAYORS_OFFICE => 'yellow',
        self::STATUS_RETURNED_FOR_REVISION => 'purple',
        self::STATUS_FUNDS_ISSUED => 'green',
        self::STATUS_IN_TRANSIT => 'blue',
        // self::STATUS_PENDING_RECONCILIATION => 'teal',
        self::STATUS_PENDING_GSO_VALIDATION => 'indigo',  // ✅ NEW
        self::STATUS_CLOSED => 'dark-green',
        self::STATUS_REJECTED => 'red',
        self::STATUS_CANCELLED => 'gray',
        self::STATUS_ACKNOWLEDGED => 'cyan',
    ];
    return $colors[$this->status] ?? 'gray';
}
    /**
 * Calculate fuel efficiency (km per liter)
 */
public function getFuelEfficiencyAttribute(): ?float
{
    if ($this->actual_fuel_used > 0 && $this->actual_distance_km > 0) {
        return round($this->actual_distance_km / $this->actual_fuel_used, 2);
    }
    return null;
}

/**
 * Check if trip has odometer readings
 */
public function hasOdometerReadings(): bool
{
    return !is_null($this->odometer_start) && !is_null($this->odometer_end);
}

/**
 * Check if trip has movement (distance > 0)
 */
public function hasMovement(): bool
{
    if ($this->hasOdometerReadings()) {
        return $this->odometer_end > $this->odometer_start;
    }
    return $this->actual_distance_km > 0;
}

/**
 * Check if fuel was issued without movement
 */
public function isFuelWithoutTrip(): bool
{
    return $this->is_fuel_issued_without_trip || 
           (!$this->hasMovement() && $this->gasSlip?->amount_released > 0);
}

/**
 * Get movement status label
 */
public function getMovementStatusAttribute(): string
{
    if (!$this->hasOdometerReadings()) {
        return 'No Odometer Reading';
    }
    
    $distance = $this->odometer_end - $this->odometer_start;
    
    if ($distance == 0) {
        return 'No Movement';
    }
    
    if ($distance < 1) {
        return 'Minimal Movement (<1km)';
    }
    
    return 'Normal Trip';
}

}