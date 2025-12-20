<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Share extends Model
{
    protected $fillable = [
        'owner_id',
        'target_user_id',
        'document_id',
        'folder_id',
        'permission',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function targetUser()
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function folder()
    {
        return $this->belongsTo(Folder::class);
    }
}
