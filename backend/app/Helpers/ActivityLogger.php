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
        $user = $userId ? \App\Models\User::find($userId) : Auth::user();

        // Try to infer department from subject first, then from user.
        $departmentId = null;

        // If the subject has a department_id column, use it.
        if (isset($subject->department_id)) {
            $departmentId = $subject->department_id;
        } elseif (method_exists($subject, 'department') && $subject->relationLoaded('department') && $subject->department) {
            // Or from loaded department relation if available.
            $departmentId = $subject->department->id ?? null;
        } elseif ($user && isset($user->department_id)) {
            // Fallback: from the acting user.
            $departmentId = $user->department_id;
        }

        Activity::create([
            'user_id'       => $user?->id,
            'department_id' => $departmentId,
            'subject_type'  => get_class($subject),
            'subject_id'    => $subject->id,
            'action'        => $action,
            'details'       => $details,
        ]);
    }
}
