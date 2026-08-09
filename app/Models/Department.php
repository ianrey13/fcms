<?php

namespace App\Models;
use App\Traits\LogsActivity;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    use LogsActivity;
    protected $table = 'departments';
    protected $primaryKey = 'department_id';
    
    protected $fillable = [
        'department_name', 
        'department_code', 
        'head_of_office',  // ✅ ADD THIS
        'is_active', 
        'deleted_at'
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'is_active' => 'boolean',
    ];
    
    // Relationships
    public function users()
    {
        return $this->hasMany(User::class, 'department_id', 'department_id');
    }
    
    public function vehicles()
    {
        return $this->hasMany(Vehicle::class, 'department_id', 'department_id');
    }
    
    public function tripTickets()
    {
        return $this->hasMany(TripTicket::class, 'department_id', 'department_id');
    }
    
    public function budgetPolicy()
    {
        return $this->hasOne(DeptBudgetPolicy::class, 'department_id', 'department_id');
    }
    
    public function budgetPeriods()
    {
        return $this->hasMany(DeptBudgetPeriod::class, 'department_id', 'department_id');
    }
    
    // Helper methods
    public function getCurrentBudgetPeriod()
    {
        return $this->budgetPeriods()
            ->where('status', 'active')
            ->where('week_start', '<=', now())
            ->where('week_end', '>=', now())
            ->first();
    }
    
    public function getRemainingBudget()
    {
        $currentPeriod = $this->getCurrentBudgetPeriod();
        if (!$currentPeriod) {
            return 0;
        }
        
        $spent = $currentPeriod->gasSlips()->sum('amount_released');
        return $currentPeriod->allocated_amount - $spent;
    }
}