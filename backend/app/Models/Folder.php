<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Folder extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'parent_id',
        'department_id',
        'owner_id',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Folder::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Folder::class, 'parent_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    // NEW: polymorphic activities
    public function activities(): MorphMany
    {
        return $this->morphMany(Activity::class, 'subject');
    }

    // Only non-archived folders
    public function scopeNotArchived($query)
    {
        return $query->whereNull('archived_at');
    }

    // Only archived folders
    public function scopeArchived($query)
    {
        return $query->whereNotNull('archived_at');
    }

    protected $casts = [
        'archived_at' => 'datetime',
    ];
}
