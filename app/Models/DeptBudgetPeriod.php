<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class DeptBudgetPeriod extends Model
{
    protected $table = 'dept_budget_period';
    protected $primaryKey = 'period_id';
    
    protected $fillable = [
        'department_id', 
        'week_start', 
        'allocated_amount', 
        'remaining_balance',  // ✅ ADD THIS
        'status', 
        'closed_at'
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'closed_at' => 'datetime',
        'week_start' => 'date',
        'week_end' => 'date',
        'allocated_amount' => 'decimal:2',
        'remaining_balance' => 'decimal:2',  // ✅ ADD THIS
    ];
    
    // ============ RELATIONSHIPS ============
    
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }
    
    public function gasSlips()
    {
        return $this->hasMany(GasSlip::class, 'period_id', 'period_id');
    }
    
    // ============ ACCESSORS ============
    
    /**
     * week_end is GENERATED, but Laravel needs an accessor to read it
     */
    public function getWeekEndAttribute($value)
    {
        if ($value === null && $this->week_start) {
            return $this->week_start->copy()->addDays(4);
        }
        return $value;
    }
    
    /**
     * Get remaining balance (from database column)
     */
    public function getRemainingBalanceAttribute($value)
    {
        return $value ?? $this->allocated_amount;
    }
    
    /**
     * Get spent amount (calculated from gas slips)
     */
    public function getSpentAmountAttribute()
    {
        return $this->gasSlips()->sum('amount_released') ?? 0;
    }
    
    /**
     * Get available amount (allocated - spent)
     */
    public function getAvailableAmountAttribute()
    {
        return $this->allocated_amount - $this->spent_amount;
    }
    
    // ============ HELPER METHODS ============
    
    public function getRemainingAmount()
    {
        $spent = $this->gasSlips()->sum('amount_released');
        return $this->allocated_amount - $spent;
    }
    
    public function isActive()
    {
        return $this->status === 'active';
    }
    
    public function isClosed()
    {
        return $this->status === 'closed';
    }
    
    public function getUtilizationPercentageAttribute()
    {
        if ($this->allocated_amount <= 0) {
            return 0;
        }
        $spent = $this->gasSlips()->sum('amount_released');
        return round(($spent / $this->allocated_amount) * 100, 2);
    }
    
    // ============================================================
    // ✅ NEW METHODS FOR BUDGET DEDUCTION
    // ============================================================
    
    /**
     * ✅ Check if enough balance
     */
    public function hasEnoughBalance($amount)
    {
        return $this->remaining_balance >= $amount;
    }
    
    /**
     * ✅ Deduct amount from remaining balance
     */
    public function deduct($amount)
    {
        $this->remaining_balance = $this->remaining_balance - $amount;
        $this->save();
        return $this;
    }
    
    /**
     * ✅ Add amount to remaining balance
     */
    public function add($amount)
    {
        $this->remaining_balance = $this->remaining_balance + $amount;
        $this->save();
        return $this;
    }
    
    /**
     * ✅ Get the current remaining balance
     */
    public function getBalance()
    {
        return $this->remaining_balance;
    }
}