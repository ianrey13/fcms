<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PushToken extends Model
{
    protected $table = 'push_tokens';
    protected $primaryKey = 'token_id';
    
    protected $fillable = [
        'user_id',
        'push_token',
        'platform',
        'device_name',
        'is_active',
        'last_used_at',
    ];
    
    protected $casts = [
        'is_active' => 'boolean',
        'last_used_at' => 'datetime',
    ];
    
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}