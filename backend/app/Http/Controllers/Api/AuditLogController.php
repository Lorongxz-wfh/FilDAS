<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use Illuminate\Http\Request;

class AuditLogController extends Controller
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

        $query = Activity::with('user');

        // Optional filters: user_id, subject_type, action, date_from, date_to
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
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

        $perPage = min($request->integer('per_page', 25), 100);

        $logs = $query
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        // Normalize payload for frontend
        return response()->json([
            'data' => $logs->getCollection()->map(function (Activity $a) {
                return [
                    'id'           => $a->id,
                    'user_id'      => $a->user_id,
                    'user_name'    => $a->user?->name,
                    'subject_type' => $a->subject_type,
                    'subject_id'   => $a->subject_id,
                    'action'       => $a->action,
                    'details'      => $a->details,
                    'created_at'   => $a->created_at,
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
