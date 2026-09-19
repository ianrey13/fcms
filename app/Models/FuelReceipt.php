<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FuelReceipt extends Model
{
    protected $table = 'fuel_receipt';
    protected $primaryKey = 'fuel_receipt_id';

    protected $fillable = [
        'gas_slip_id',
        'invoice_number',
        'liters_availed',
        'amount_on_receipt',
        'unit_price',
        'receipt_photo_path',
        'receipt_uploaded_at',
        'trip_elapsed_minutes',
        'trip_started_at',
        'trip_ended_at',
        'trip_start_gps_lat',
        'trip_start_gps_lng',
        'trip_end_gps_lat',
        'trip_end_gps_lng',
        'trip_start_gps_accuracy',
        'gps_distance_km',
        'created_at',
        'updated_at',
         'verification_status',
    'verified_at',
    'verified_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'trip_started_at' => 'datetime',
        'trip_ended_at' => 'datetime',
        'receipt_uploaded_at' => 'datetime',
        'liters_availed' => 'decimal:2',
        'amount_on_receipt' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'trip_start_gps_lat' => 'decimal:7',
        'trip_start_gps_lng' => 'decimal:7',
        'trip_end_gps_lat' => 'decimal:7',
        'trip_end_gps_lng' => 'decimal:7',
        'trip_start_gps_accuracy' => 'decimal:2',
        'gps_distance_km' => 'decimal:2',
        'verified_at' => 'datetime',
    'receipt_uploaded_at' => 'datetime',
    ];

    // ============ RELATIONSHIPS ============

    public function gasSlip()
    {
        return $this->belongsTo(GasSlip::class, 'gas_slip_id', 'gas_slip_id');
    }

    public function tripTicket()
    {
        return $this->hasOneThrough(
            TripTicket::class,
            GasSlip::class,
            'gas_slip_id',
            'trip_ticket_id',
            'gas_slip_id',
            'trip_ticket_id'
        );
    }

    // ============ HELPER METHODS ============

    public function isCompleted(): bool
    {
        return $this->trip_ended_at !== null;
    }

    public function hasReceipt(): bool
    {
        return $this->receipt_photo_path !== null;
    }

    /**
     * ✅ Check if GSO/MO has entered the fuel details yet
     */
    public function hasFuelDetails(): bool
    {
        return $this->liters_availed !== null
            && (float) $this->liters_availed > 0
            && $this->amount_on_receipt !== null
            && (float) $this->amount_on_receipt > 0;
    }

    public function getEffectiveDistanceAttribute(): ?float
    {
        if ($this->gps_distance_km !== null && (float) $this->gps_distance_km > 0) {
            return (float) $this->gps_distance_km;
        }
        return null;
    }

    public function getKmPerLiterAttribute(): ?float
    {
        $distance = $this->effective_distance;
        $liters = (float) ($this->liters_availed ?? 0);
        if ($distance > 0 && $liters > 0) {
            return round($distance / $liters, 2);
        }
        return null;
    }

    public function getCostPerKmAttribute(): ?float
    {
        $distance = $this->effective_distance;
        $amount = (float) ($this->amount_on_receipt ?? 0);
        if ($distance > 0 && $amount > 0) {
            return round($amount / $distance, 2);
        }
        return null;
    }

    public function getDurationMinutesAttribute(): ?int
    {
        if ($this->trip_started_at && $this->trip_ended_at) {
            return $this->trip_started_at->diffInMinutes($this->trip_ended_at);
        }
        return null;
    }

    public function isVerified(): bool
    {
        return $this->gasSlip && $this->gasSlip->reconciliation_status === 'verified';
    }

    public function verifiedBy()
{
    return $this->belongsTo(\App\Models\User::class, 'verified_by', 'user_id');
}
}