<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class WeeklyBudgetUsage extends Model
{
    protected $table = 'weekly_budget_usage';
    protected $primaryKey = 'usage_id';
    
    protected $fillable = [
        'department_id',
        'week_number',
        'year',
        'week_start',
        'week_end',
        'amount_used',
        'weekly_allocation',  // ✅ ADD THIS
    ];
    
    protected $casts = [
        'amount_used' => 'decimal:2',
        'weekly_allocation' => 'decimal:2',  // ✅ ADD THIS
        'week_start' => 'date',
        'week_end' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
    
    // ============ RELATIONSHIPS ============
    
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }
    
    // ============ ACCESSORS ============
    
    /**
     * ✅ Compute remaining (allocation - used)
     */
    public function getRemainingAttribute()
    {
        return $this->weekly_allocation - $this->amount_used;
    }
    
    /**
     * ✅ Compute utilization percentage
     */
    public function getUtilizationPercentageAttribute()
    {
        if ($this->weekly_allocation <= 0) return 0;
        return round(($this->amount_used / $this->weekly_allocation) * 100, 2);
    }
    
    /**
     * ✅ Get status
     */
    public function getStatusAttribute()
    {
        if ($this->weekly_allocation <= 0) return 'not_set';
        if ($this->remaining <= 0) return 'exhausted';
        if ($this->utilization_percentage >= 80) return 'near_limit';
        return 'active';
    }
    
    /**
     * ✅ Get status color
     */
    public function getStatusColorAttribute()
    {
        $status = $this->status;
        if ($status === 'not_set') return 'bg-slate-400';
        if ($status === 'exhausted') return 'bg-red-500';
        if ($status === 'near_limit') return 'bg-yellow-500';
        return 'bg-green-500';
    }
    
    /**
     * ✅ Get status label
     */
    public function getStatusLabelAttribute()
    {
        $status = $this->status;
        if ($status === 'not_set') return 'Not Set';
        if ($status === 'exhausted') return 'Exhausted';
        if ($status === 'near_limit') return 'Near Limit';
        return 'On Track';
    }
    
    // ============ SCOPES ============
    
    public function scopeActive($query)
    {
        return $query->where('amount_used', '<', DB::raw('weekly_allocation'));
    }
    
    public function scopeExhausted($query)
    {
        return $query->where('amount_used', '>=', DB::raw('weekly_allocation'));
    }
    
    public function scopeByWeek($query, $weekNumber, $year)
    {
        return $query->where('week_number', $weekNumber)
            ->where('year', $year);
    }
    
    public function scopeCurrentWeek($query)
    {
        $week = Carbon::now()->weekOfYear;
        $year = Carbon::now()->year;
        return $query->byWeek($week, $year);
    }
    
    public function scopeByDepartment($query, $departmentId)
    {
        return $query->where('department_id', $departmentId);
    }
    
    // ============ HELPER METHODS ============
    
    /**
     * ✅ Add usage amount
     */
    public function addUsage($amount)
    {
        $this->amount_used += $amount;
        $this->save();
        return $this;
    }
    
    /**
     * ✅ Check if allocation is sufficient
     */
    public function hasEnoughAllocation($amount)
    {
        return $this->remaining >= $amount;
    }
    
    /**
     * ✅ Get or create for current week
     */
    public static function getOrCreateForCurrentWeek($departmentId)
    {
        $week = Carbon::now()->weekOfYear;
        $year = Carbon::now()->year;
        $weekStart = Carbon::now()->startOfWeek()->toDateString();
        $weekEnd = Carbon::now()->endOfWeek()->toDateString();
        
        // Get policy for allocation
        $policy = DeptBudgetPolicy::where('department_id', $departmentId)->first();
        $allocation = $policy ? $policy->default_weekly_allocation : 0;
        
        return self::firstOrCreate(
            [
                'department_id' => $departmentId,
                'week_number' => $week,
                'year' => $year,
            ],
            [
                'week_start' => $weekStart,
                'week_end' => $weekEnd,
                'weekly_allocation' => $allocation,
                'amount_used' => 0,
            ]
        );
    }
}