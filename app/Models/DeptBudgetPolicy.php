<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeptBudgetPolicy extends Model
{
    protected $table = 'dept_budget_policy';

    // ✅ New auto-increment PK
    protected $primaryKey = 'dept_policy_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'department_id',
        'fiscal_year',
        'default_weekly_allocation',
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
     * Prefers the active fiscal year (from fiscal_years table), falls back to calendar year
     */
    public static function getCurrent($departmentId)
    {
        // Try the active fiscal year first
        $active = \App\Models\FiscalYear::where('is_active', true)->first();
        $year = $active?->year ?? date('Y');

        return self::getForFiscalYear($departmentId, $year);
    }
}