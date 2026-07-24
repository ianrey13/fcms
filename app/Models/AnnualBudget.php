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
        'used_amount',
        'status',
    ];
    
    protected $casts = [
        'annual_amount' => 'decimal:2',
        'used_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'fiscal_year' => 'integer',
    ];
    
    // Relationships
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }
    
    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
    
    public function scopeForYear($query, $year)
    {
        return $query->where('fiscal_year', $year);
    }
    
    // Helper Methods
    public function getUtilizationPercentageAttribute()
    {
        if ($this->annual_amount == 0) {
            return 0;
        }
        return round(($this->used_amount / $this->annual_amount) * 100, 2);
    }
    
    public function getIsOverBudgetAttribute()
    {
        return $this->used_amount > $this->annual_amount;
    }
}