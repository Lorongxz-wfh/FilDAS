<?php

namespace App\Helpers;

use App\Models\Activity;

class ActivityLogger
{
    public static function log($subject, string $action, ?string $details = null): void
    {
        Activity::create([
            'user_id'      => auth()->id(),
            'subject_type' => get_class($subject),
            'subject_id'   => $subject->id,
            'action'       => $action,
            'details'      => $details,
        ]);
    }
}
