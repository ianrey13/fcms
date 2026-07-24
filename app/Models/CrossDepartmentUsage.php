<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CrossDepartmentUsage extends Model
{
    protected $table = 'cross_department_usage';
    protected $primaryKey = 'usage_id';
    
    protected $fillable = [
        'from_department_id',
        'to_department_id',
        'gas_slip_id',
        'amount',
        'reason',
    ];
    
    protected $casts = [
        'amount' => 'decimal:2',
    ];
    
    public function fromDepartment()
    {
        return $this->belongsTo(Department::class, 'from_department_id', 'department_id');
    }
    
    public function toDepartment()
    {
        return $this->belongsTo(Department::class, 'to_department_id', 'department_id');
    }
    
    public function gasSlip()
    {
        return $this->belongsTo(GasSlip::class, 'gas_slip_id', 'gas_slip_id');
    }
}