<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeptBudgetPeriod extends Model
{
    protected $table = 'dept_budget_period';
    protected $primaryKey = 'period_id';
    
    protected $fillable = [
        'department_id', 
        'week_start', 
        'allocated_amount', 
        'status', 
        'closed_at'
        // ✅ week_end is VIRTUAL/GENERATED - NOT included in fillable
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'closed_at' => 'datetime',
        'week_start' => 'date',
        'week_end' => 'date',  // ✅ Added for accessor
        'allocated_amount' => 'decimal:2',
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
     * ✅ week_end is GENERATED, but Laravel needs an accessor to read it
     */
    public function getWeekEndAttribute($value)
    {
        // If value is null but week_start exists, calculate it
        if ($value === null && $this->week_start) {
            return $this->week_start->addDays(4);
        }
        return $value;
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
    
    public function getSpentAmountAttribute()
    {
        return $this->gasSlips()->sum('amount_released');
    }
}