<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\MorphMany;

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
        'owner_id',
        'uploaded_at',
    ];

    protected $casts = [
        'uploaded_at' => 'datetime',
        'size_bytes'  => 'integer',
        'archived_at' => 'datetime',
    ];

    protected $appends = ['file_size_formatted'];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

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

    // NEW: polymorphic activities
    public function activities(): MorphMany
    {
        return $this->morphMany(Activity::class, 'subject');
    }

    // Only non-archived documents
    public function scopeNotArchived($query)
    {
        return $query->whereNull('archived_at');
    }

    // Only archived documents
    public function scopeArchived($query)
    {
        return $query->whereNotNull('archived_at');
    }

    // in App\Models\Document
    public function originalOwner()
    {
        return $this->belongsTo(User::class, 'original_owner_id');
    }
}
