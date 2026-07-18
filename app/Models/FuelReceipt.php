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
        'unit_price',          // ✅ ADD THIS
        'receipt_photo_path',
        'receipt_uploaded_at',
        'odometer_start',
        'odometer_end',
        'odometer_continuity_flag',
        'has_movement_flag',
        'duplicate_receipt_flag',
        'trip_elapsed_minutes',
        'trip_started_at',
        'trip_ended_at',
        'trip_start_gps_lat',
        'trip_start_gps_lng',
        'trip_start_gps_accuracy',
        'distance_calculation_method',
        'gps_distance_km',
        'created_at',
        'updated_at',
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'trip_started_at' => 'datetime',
        'trip_ended_at' => 'datetime',
        'receipt_uploaded_at' => 'datetime',
        'liters_availed' => 'decimal:3',
        'amount_on_receipt' => 'decimal:2',
        'unit_price' => 'decimal:2',      // ✅ ADD THIS
        'odometer_continuity_flag' => 'boolean',
        'has_movement_flag' => 'boolean',
        'duplicate_receipt_flag' => 'boolean',
        'trip_start_gps_lat' => 'decimal:7',
        'trip_start_gps_lng' => 'decimal:7',
        'trip_start_gps_accuracy' => 'decimal:2',
        'gps_distance_km' => 'decimal:2',
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
    
    public function hasOdometerReadings(): bool
    {
        return $this->odometer_start !== null && $this->odometer_end !== null;
    }
    
    public function hasReceipt(): bool
    {
        return $this->receipt_photo_path !== null;
    }
    
    public function getOdometerDistanceAttribute(): ?float
    {
        if ($this->hasOdometerReadings()) {
            return $this->odometer_end - $this->odometer_start;
        }
        return null;
    }
    
    public function getEffectiveDistanceAttribute(): ?float
    {
        if ($this->hasOdometerReadings()) {
            return $this->odometer_end - $this->odometer_start;
        }
        if ($this->gps_distance_km !== null) {
            return $this->gps_distance_km;
        }
        return null;
    }
    
    public function getDistanceSourceLabelAttribute(): string
    {
        $labels = [
            'odometer' => 'Odometer',
            'gps' => 'GPS',
            'manual_estimate' => 'Manual Estimate',
        ];
        return $labels[$this->distance_calculation_method] ?? 'Unknown';
    }
    
    public function getKmPerLiterAttribute(): ?float
    {
        $distance = $this->effective_distance;
        if ($distance > 0 && $this->liters_availed > 0) {
            return round($distance / $this->liters_availed, 2);
        }
        return null;
    }
    
    public function getCostPerKmAttribute(): ?float
    {
        $distance = $this->effective_distance;
        if ($distance > 0 && $this->amount_on_receipt > 0) {
            return round($this->amount_on_receipt / $distance, 2);
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
}