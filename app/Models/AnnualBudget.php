<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnnualBudget extends Model
{
    protected $table = 'annual_budgets';
    protected $primaryKey = 'budget_id';
    
    protected $fillable = [
        'department_id',
        'fiscal_year',
        'annual_amount',
        'weekly_ceiling',
        'used_amount',
        'status',
    ];
    
    protected $casts = [
        'annual_amount' => 'decimal:2',
        'weekly_ceiling' => 'decimal:2',
        'used_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'available_amount' => 'decimal:2',
    ];
    
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
    
    public function fiscalYear()
    {
        return $this->belongsTo(FiscalYear::class, 'fiscal_year', 'year');
    }
    
    /**
     * Get remaining amount (Annual - Used)
     */
    public function getRemainingAmountAttribute()
    {
        return $this->annual_amount - $this->used_amount;
    }
    
    /**
     * Get available amount (Remaining - Total Weekly Allocations)
     */
    public function getAvailableAmountAttribute()
    {
        $totalWeeklyAllocated = DB::table('weekly_budget_usage')
            ->where('department_id', $this->department_id)
            ->where('year', $this->fiscal_year)
            ->sum('weekly_allocation');
            
        return $this->remaining_amount - $totalWeeklyAllocated;
    }
    
    /**
     * Get total weekly allocations for this year
     */
    public function getTotalWeeklyAllocationsAttribute()
    {
        return DB::table('weekly_budget_usage')
            ->where('department_id', $this->department_id)
            ->where('year', $this->fiscal_year)
            ->sum('weekly_allocation');
    }
}