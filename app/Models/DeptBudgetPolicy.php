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
         'fiscal_year', 
        'default_weekly_allocation'
    ];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'default_weekly_allocation' => 'decimal:2',
         'fiscal_year' => 'integer',
    ];
    
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }

     /**
     * ✅ Get policy for specific fiscal year
     */
    public static function getForFiscalYear($departmentId, $fiscalYear)
    {
        return self::where('department_id', $departmentId)
            ->where('fiscal_year', $fiscalYear)
            ->first();
    }

    /**
     * ✅ Get current fiscal year policy
     */
    public static function getCurrent($departmentId)
    {
        $currentYear = date('Y');
        return self::getForFiscalYear($departmentId, $currentYear);
    }
}