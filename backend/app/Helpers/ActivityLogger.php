<?php

namespace App\Helpers;

use App\Models\Activity;
use Illuminate\Support\Facades\Auth;

class ActivityLogger
{
    /**
     * @param  \Illuminate\Database\Eloquent\Model  $subject
     * @param  string  $action
     * @param  string|null  $details
     * @param  int|null  $userId  // explicitly allow overriding user_id
     */
    public static function log($subject, string $action, ?string $details = null, ?int $userId = null)
    {
        Activity::create([
            'user_id'      => $userId ?? Auth::id(),
            'subject_type' => get_class($subject),
            'subject_id'   => $subject->id,
            'action'       => $action,
            'details'      => $details,
        ]);
    }
}
