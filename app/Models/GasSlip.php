<?php

namespace App\Models;
use App\Traits\LogsActivity;

use Illuminate\Database\Eloquent\Model;

class GasSlip extends Model
{   
    use LogsActivity;
    protected $table = 'gas_slip';
    protected $primaryKey = 'gas_slip_id';
    
    public $timestamps = true;
    
    protected $fillable = [
        'trip_ticket_id',
        'created_by',
        'amount_released',
        'budget_before',
        'budget_after',
        'period_id',
        'acknowledged_by',
        'acknowledged_at',
        'reconciliation_status',
        'reconciliation_note',
        'reconciled_by',
        'reconciled_at',
        'is_cross_department',
        'original_department_id',
        'cross_department_reason',
        'created_at',
        'updated_at',
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'reconciled_at' => 'datetime',
        'acknowledged_at' => 'datetime',
        'amount_released' => 'decimal:2',
        'budget_before' => 'decimal:2',
        'budget_after' => 'decimal:2',
        'is_cross_department' => 'boolean',
    ];

    // ============ RELATIONSHIPS ============
    public function period()
    {
        return $this->belongsTo(DeptBudgetPeriod::class, 'period_id', 'period_id');
    }
    
    public function tripTicket()
    {
        return $this->belongsTo(TripTicket::class, 'trip_ticket_id', 'trip_ticket_id');
    }
    
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }
    
    public function reconciledBy()
    {
        return $this->belongsTo(User::class, 'reconciled_by', 'user_id');
    }
    
    public function acknowledgedBy()
    {
        return $this->belongsTo(User::class, 'acknowledged_by', 'user_id');
    }
    
    public function fuelReceipt()
    {
        return $this->hasOne(FuelReceipt::class, 'gas_slip_id', 'gas_slip_id');
    }

    // ============ HELPER METHODS ============
    
    public function isPending()
    {
        return $this->reconciliation_status === 'pending';
    }
    
    public function isVerified()
    {
        return $this->reconciliation_status === 'verified';
    }
    
    public function hasDiscrepancy()
    {
        return $this->reconciliation_status === 'discrepancy';
    }
}