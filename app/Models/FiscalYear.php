<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FiscalYear extends Model
{
    protected $table = 'fiscal_years';
    protected $primaryKey = 'fiscal_year_id';
    
    protected $fillable = [
        'year',
        'is_active',
        'created_by',
    ];
    
    protected $casts = [
        'year' => 'integer',
        'is_active' => 'boolean',
    ];
    
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    
    public function annualBudgets()
    {
        return $this->hasMany(AnnualBudget::class, 'fiscal_year', 'year');
    }
    
    // Get total budget for this fiscal year
    public function getTotalBudgetAttribute()
    {
        return $this->annualBudgets()->sum('annual_amount');
    }
    
    // Get total used for this fiscal year
    public function getTotalUsedAttribute()
    {
        return $this->annualBudgets()->sum('used_amount');
    }
    
    // Get departments with budget for this year
    public function getDepartmentsWithBudgetAttribute()
    {
        return $this->annualBudgets()->with('department')->get();
    }
}