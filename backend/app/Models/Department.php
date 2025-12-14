<?php
// app/Models/Department.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
    ];

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function folders()
    {
        return $this->hasMany(Folder::class);
    }
}
