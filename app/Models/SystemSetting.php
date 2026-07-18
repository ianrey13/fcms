<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    protected $table = 'system_setting';
    protected $primaryKey = 'setting_id';
    public $timestamps = false;
    
    protected $fillable = [
        'setting_key', 'setting_value', 'updated_by', 'updated_at'
    ];
    
    protected $casts = [
        'updated_at' => 'datetime'
    ];
    
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }
}