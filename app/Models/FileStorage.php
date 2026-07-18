<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
//use Illuminate\Database\Eloquent\SoftDeletes;

class FileStorage extends Model
{
//use SoftDeletes;
    
    protected $table = 'file_storage';
    protected $primaryKey = 'file_id';
    
    protected $fillable = [
        'file_uuid', 'original_filename', 'stored_filename', 'mime_type',
        'file_size', 'file_hash', 'storage_path_hash', 'encryption_key_id',
        'uploaded_by', 'uploaded_at', 'is_malware_scanned', 'is_quarantined',
        'accessed_count', 'last_accessed_at', 'retention_until', 'deleted_by'
    ];
    
    protected $casts = [
        'uploaded_at' => 'datetime',
        'last_accessed_at' => 'datetime',
        'retention_until' => 'date',
        'file_size' => 'integer',
        'accessed_count' => 'integer',
        'is_malware_scanned' => 'boolean',
        'is_quarantined' => 'boolean'
    ];
    
    public function uploadedBy()
    {
        return $this->belongsTo(User::class, 'uploaded_by', 'user_id');
    }
    
    public function deletedBy()
    {
        return $this->belongsTo(User::class, 'deleted_by', 'user_id');
    }
}