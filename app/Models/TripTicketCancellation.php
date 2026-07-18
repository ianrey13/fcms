<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TripTicketCancellation extends Model
{
    protected $table = 'trip_ticket_cancellation';
    protected $primaryKey = 'cancellation_id';
    public $timestamps = false;
    
    protected $fillable = [
        'trip_ticket_id', 'cancelled_by', 'cancellation_reason',
        'fund_return_required', 'fund_returned_at', 'fund_returned_by', 'cancelled_at'
    ];
    
    protected $casts = [
        'cancelled_at' => 'datetime',
        'fund_returned_at' => 'datetime',
        'fund_return_required' => 'boolean'
    ];
    
    public function tripTicket()
    {
        return $this->belongsTo(TripTicket::class, 'trip_ticket_id', 'trip_ticket_id');
    }
    
    public function cancelledBy()
    {
        return $this->belongsTo(User::class, 'cancelled_by', 'user_id');
    }
    
    public function fundReturnedBy()
    {
        return $this->belongsTo(User::class, 'fund_returned_by', 'user_id');
    }
}