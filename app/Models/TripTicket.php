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
        'submitted_by',
        'created_by_mo_user_id',

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

        'has_insufficient_budget',
        'budget_shortage',
        'original_department_id',
        'actual_distance_km',
        'actual_fuel_used',

        'is_fuel_issued_without_trip',
        'trip_count',
        'cancellation_reason',
        'cancelled_at',
        'cancelled_by',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'updated_at' => 'datetime',
        'trip_date' => 'date',

        'has_insufficient_budget' => 'boolean',
        'estimated_distance_km' => 'decimal:2',
        'estimated_fuel_liters' => 'decimal:2',
        'budget_shortage' => 'decimal:2',
        'actual_distance_km' => 'decimal:2',
        'actual_fuel_used' => 'decimal:2',

        'is_fuel_issued_without_trip' => 'boolean',
        'cancelled_at' => 'datetime',
    ];

    // ============ STATUS CONSTANTS ============
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_MAYORS_OFFICE = 'pending_mayors_office';
    public const STATUS_RETURNED_FOR_REVISION = 'returned_for_revision';
    public const STATUS_FUNDS_ISSUED = 'funds_issued';
    public const STATUS_IN_TRANSIT = 'in_transit';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_ACKNOWLEDGED = 'acknowledged';
    public const STATUS_PENDING_GSO_VALIDATION = 'pending_gso_validation';

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
        return !$this->submitted_by_staff;
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
            self::STATUS_PENDING_GSO_VALIDATION => 'Pending GSO Validation',
            self::STATUS_COMPLETED => 'Completed (Pending GSO)',
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
            self::STATUS_PENDING_GSO_VALIDATION => 'indigo',
            self::STATUS_CLOSED => 'dark-green',
            self::STATUS_REJECTED => 'red',
            self::STATUS_CANCELLED => 'gray',
            self::STATUS_ACKNOWLEDGED => 'cyan',
        ];
        return $colors[$this->status] ?? 'gray';
    }

    public function getFuelEfficiencyAttribute(): ?float
    {
        if ($this->actual_fuel_used > 0 && $this->actual_distance_km > 0) {
            return round($this->actual_distance_km / $this->actual_fuel_used, 2);
        }
        return null;
    }

    public function hasMovement(): bool
    {
        return ($this->actual_distance_km ?? 0) > 0;
    }

    public function isFuelWithoutTrip(): bool
    {
        return $this->is_fuel_issued_without_trip ||
               (!$this->hasMovement() && $this->gasSlip?->amount_released > 0);
    }

    public function tripHistory()
    {
        return $this->hasMany(TripHistory::class, 'trip_ticket_id', 'trip_ticket_id')
            ->orderBy('trip_number', 'desc');
    }

    public function latestTrip()
    {
        return $this->hasOne(TripHistory::class, 'trip_ticket_id', 'trip_ticket_id')
            ->where('status', 'completed')
            ->orderBy('trip_number', 'desc');
    }

    public function currentTrip()
    {
        return $this->hasOne(TripHistory::class, 'trip_ticket_id', 'trip_ticket_id')
            ->where('status', 'in_progress')
            ->orderBy('trip_number', 'desc');
    }

    public function canBeCancelled(): bool
    {
        return in_array($this->status, [
            self::STATUS_PENDING_MAYORS_OFFICE,
            self::STATUS_RETURNED_FOR_REVISION,
        ]) && !$this->gasSlip()->exists();
    }

    /**
     * Compute total GPS distance from trip_history
     */
    public function computeActualDistance(): float
    {
        return (float) TripHistory::where('trip_ticket_id', $this->trip_ticket_id)
            ->where('status', 'completed')
            ->sum('distance_km');
    }

    /**
     * Sync actual_distance_km and actual_fuel_used from related records
     *
     * ✅ UPDATED: fuel liters are now entered by GSO/MO — sync to receipt's current value
     */
    public function syncActuals(): self
    {
        $this->actual_distance_km = $this->computeActualDistance();

        $receipt = $this->gasSlip?->fuelReceipt;
        if ($receipt) {
            // ✅ Explicitly sync to receipt's current liters value (or null if not entered yet)
            $liters = (float) ($receipt->liters_availed ?? 0);
            $this->actual_fuel_used = $liters > 0 ? $liters : null;
        } else {
            $this->actual_fuel_used = null;
        }

        if ($this->gasSlip && $this->gasSlip->amount_released > 0) {
            $this->is_fuel_issued_without_trip = ($this->actual_distance_km == 0);
        }

        return $this;
    }

    /**
     * ✅ NEW: Check if this trip can be validated/closed by GSO/MO
     * Requires: status pending_gso_validation AND receipt has liters + amount
     */
    public function canBeValidated(): bool
    {
        if ($this->status !== self::STATUS_PENDING_GSO_VALIDATION) {
            return false;
        }
        $receipt = $this->gasSlip?->fuelReceipt;
        return $receipt && $receipt->hasFuelDetails();
    }
}