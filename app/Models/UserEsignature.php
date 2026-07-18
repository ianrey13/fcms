<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserEsignature extends Model
{
    protected $table = 'user_esignature';
    protected $primaryKey = 'esig_id';
    public $timestamps = false;
    
    protected $fillable = [
        'user_id', 'signature_image', 'signature_hash', 
        'is_active', 'enrolled_at', 'enrolled_ip', 'superseded_at'
    ];
    
    protected $casts = [
        'is_active' => 'boolean',
        'enrolled_at' => 'datetime',
        'superseded_at' => 'datetime',
    ];
    
    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
    
    public function tripTicketEsignatures()
    {
        return $this->hasMany(TripTicketEsignature::class, 'esig_id', 'esig_id');
    }
}