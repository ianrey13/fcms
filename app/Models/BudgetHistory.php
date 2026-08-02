<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BudgetHistory extends Model
{
    protected $table = 'budget_history';
    protected $primaryKey = 'id';
    
    protected $fillable = [
        'department_id',
        'department_name',
        'action',
        'previous_amount',
        'added_amount',
        'new_amount',
        'reason',
        'user_id',
        'user_name',
        'created_at',
        'updated_at',
    ];
    
    protected $casts = [
        'previous_amount' => 'decimal:2',
        'added_amount' => 'decimal:2',
        'new_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
    
    /**
     * Get the department that owns the budget history
     */
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
    
    /**
     * Get the user who made the change
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
    
    /**
     * Scope a query to filter by department
     */
    public function scopeByDepartment($query, $departmentId)
    {
        return $query->where('department_id', $departmentId);
    }
    
    /**
     * Scope a query to filter by action
     */
    public function scopeByAction($query, $action)
    {
        return $query->where('action', $action);
    }
    
    /**
     * Scope a query to filter by date range
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }
}