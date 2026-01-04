<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    protected function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if (!$user || (!$user->isAdmin() && !$user->isSuperAdmin())) {
            abort(403, 'Forbidden');
        }
    }

    public function index(Request $request)
    {
        $this->ensureAdmin($request);

        $user    = $request->user();
        $isSuper = method_exists($user, 'isSuperAdmin') ? $user->isSuperAdmin() : false;
        $isAdmin = method_exists($user, 'isAdmin') ? $user->isAdmin() : false;

        $query = Activity::with(['user', 'department']);

        // Optional filters: user_name, subject_type, subject_id, action, date_from, date_to
        if ($request->filled('user_name')) {
            $name = $request->input('user_name');
            $query->whereHas('user', function ($q) use ($name) {
                $q->where('name', 'like', '%' . $name . '%');
            });
        }

        if ($request->filled('subject_id')) {
            $query->where('subject_id', $request->integer('subject_id'));
        }



        if ($request->filled('subject_type')) {
            $query->where('subject_type', $request->input('subject_type'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        // Department scoping.
        if ($isSuper) {
            if ($request->filled('department_id')) {
                // Only apply this filter if the column exists in the table.
                $query->where('department_id', $request->integer('department_id'));
            }
        } elseif ($isAdmin) {
            // Admin always restricted to their own department if set.
            if (!empty($user->department_id)) {
                $query->where('department_id', $user->department_id);
            } else {
                // No department_id on this admin; show nothing instead of error.
                $query->whereRaw('1 = 0');
            }
        }

        $perPage = min($request->integer('per_page', 25), 100);

        $logs = $query
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'data' => $logs->getCollection()->map(function (Activity $a) {
                return [
                    'id'              => $a->id,
                    'user_id'         => $a->user_id,
                    'user_name'       => $a->user?->name,
                    'department_id'   => $a->department_id,
                    'department_name' => $a->department?->name,
                    'subject_type'    => $a->subject_type,
                    'subject_id'      => $a->subject_id,
                    'action'          => $a->action,
                    'details'         => $a->details,
                    'created_at'      => $a->created_at,
                ];
            }),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
                'last_page'    => $logs->lastPage(),
            ],
        ]);
    }
}
