<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'department_id',
        'status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
        ];
    }

    /**
     * Get the role that the user belongs to.
     */
    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Get the department that the user belongs to.
     */
    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    /**
     * Convenience helpers.
     */
    public function isAdmin(): bool
    {
        return optional($this->role)->name === 'Admin';
    }

    public function isStaff(): bool
    {
        return optional($this->role)->name === 'Staff';
    }

    public function ownedDepartments()
    {
        return $this->hasMany(Department::class, 'owner_id');
    }

    public function ownedFolders()
    {
        return $this->hasMany(Folder::class, 'owner_id');
    }

    public function ownedDocuments()
    {
        return $this->hasMany(Document::class, 'owner_id');
    }

    // Shares this user created
    public function outgoingShares()
    {
        return $this->hasMany(Share::class, 'owner_id');
    }

    // Items shared TO this user
    public function incomingShares()
    {
        return $this->hasMany(Share::class, 'target_user_id');
    }
}
