<?php
// app/Models/Document.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\User;

class Document extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'description',
        'file_path',
        'preview_path',
        'original_filename',
        'mime_type',
        'size_bytes',
        'department_id',
        'document_type_id',
        'folder_id',
        'uploaded_by',
        'owner_id',      // <-- added
        'uploaded_at',
    ];

    protected $casts = [
        'uploaded_at' => 'datetime',
        'size_bytes'  => 'integer',
    ];

    protected $appends = ['file_size_formatted'];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    // renamed to match with() call: uploadedBy
    public function uploadedBy()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function folder()
    {
        return $this->belongsTo(Folder::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function getFileSizeFormattedAttribute()
    {
        $bytes = $this->size_bytes;
        $units = ['B', 'KB', 'MB', 'GB'];

        $i = 0;
        while ($bytes > 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }
}
