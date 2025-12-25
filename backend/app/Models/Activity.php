<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    // Point to the actual table
    protected $table = 'activities';

    protected $fillable = [
        'user_id',
        'subject_type',
        'subject_id',
        'action',
        'details',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Polymorphic inverse
    public function subject()
    {
        return $this->morphTo();
    }
}
