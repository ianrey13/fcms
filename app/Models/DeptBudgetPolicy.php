<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeptBudgetPolicy extends Model
{
    protected $table = 'dept_budget_policy';
    
    protected $primaryKey = 'department_id';
    public $incrementing = false;  
    protected $keyType = 'int';     
    
    protected $fillable = [
        'department_id', 
        'default_weekly_allocation'
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'default_weekly_allocation' => 'decimal:2'
    ];
    
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }
}