<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
    ];
    
    protected $casts = [
        'amount_used' => 'decimal:2',
        'week_start' => 'date',
        'week_end' => 'date',
    ];
    
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }
}