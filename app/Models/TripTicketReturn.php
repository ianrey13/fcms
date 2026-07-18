<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TripTicketReturn extends Model
{
    protected $table = 'trip_ticket_return';
    protected $primaryKey = 'return_id';
    public $timestamps = false;
    
    protected $fillable = [
        'trip_ticket_id', 'return_type', 'return_note', 'fields_changed',
        'actioned_by', 'actioned_at'
    ];
    
    protected $casts = [
        'actioned_at' => 'datetime',
        'fields_changed' => 'array'
    ];
    
    // ============ RETURN TYPE CONSTANTS ============
    public const TYPE_REJECTED_BY_MO = 'rejected_by_mo';
    public const TYPE_RETURNED_BY_MO = 'returned_by_mo';
    public const TYPE_RESUBMITTED_BY_STAFF = 'resubmitted_by_staff';
    
    // ============ RELATIONSHIPS ============
    public function tripTicket()
    {
        return $this->belongsTo(TripTicket::class, 'trip_ticket_id', 'trip_ticket_id');
    }
    
    public function actionedBy()
    {
        return $this->belongsTo(User::class, 'actioned_by', 'user_id');
    }
}