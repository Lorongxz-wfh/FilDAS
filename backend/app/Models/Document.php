<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use App\Models\Comment;


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
        'status',
        'approved_by',
        'assigned_to',
        'approved_at',
    ];

    protected $casts = [
        'uploaded_at' => 'datetime',
        'size_bytes'  => 'integer',
        'trashed_at'  => 'datetime',
        'approved_at' => 'datetime',
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

    // QA reviewer who made the decision
    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    // QA user currently responsible for reviewing this document
    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
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

    public function comments()
    {
        return $this->morphMany(Comment::class, 'commentable')->latest();
    }

    public function scopeTrashed($query)
    {
        return $query->whereNotNull('trashed_at');
    }

    public function scopeNotTrashed($query)
    {
        return $query->whereNull('trashed_at');
    }

    // in App\Models\Document
    public function originalOwner()
    {
        return $this->belongsTo(User::class, 'original_owner_id');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }
}
