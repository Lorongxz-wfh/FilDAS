<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    protected function ensureAdmin(Request $request): array
    {
        $user = $request->user();

        if (!$user || (!method_exists($user, 'isAdmin') && !method_exists($user, 'isSuperAdmin'))) {
            abort(403, 'Forbidden');
        }

        $isSuperAdmin = method_exists($user, 'isSuperAdmin') ? $user->isSuperAdmin() : false;
        $isAdmin = method_exists($user, 'isAdmin') ? $user->isAdmin() : false;

        if (!$isSuperAdmin && !$isAdmin) {
            abort(403, 'Forbidden');
        }

        return [$user, $isSuperAdmin, $isAdmin];
    }

    public function activitySummary(Request $request)
    {
        [$user, $isSuperAdmin, $isAdmin] = $this->ensureAdmin($request);

        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');
        $deptId   = $request->input('department_id');

        // Defaults: last 7 days if no date range specified
        if (!$dateFrom || !$dateTo) {
            $dateTo = now()->toDateString();
            $dateFrom = now()->subDays(6)->toDateString();
        }

        $query = Activity::query()
            ->with(['user', 'department'])
            ->whereDate('created_at', '>=', $dateFrom)
            ->whereDate('created_at', '<=', $dateTo);

        // Department scoping
        if ($isSuperAdmin) {
            if ($deptId) {
                $query->where('department_id', (int) $deptId);
            }
        } elseif ($isAdmin) {
            if (!empty($user->department_id)) {
                $query->where('department_id', $user->department_id);
            } else {
                // Admin with no department: show nothing
                $query->whereRaw('1 = 0');
            }
        }

        $activities = $query->get();

        // Summary numbers
        $totalActions = $activities->count();
        $totalUploads = $activities->where('action', 'uploaded')->count();

        $failedActions = $activities->whereIn('action', [
            'login_failed',
            'upload_failed',
        ])->count();

        $approvals = $activities->where('action', 'approved')->count();
        $rejections = $activities->where('action', 'rejected')->count();

        // Group by action type
        $byActionType = $activities
            ->groupBy('action')
            ->map(function ($group, $action) {
                return [
                    'action' => $action,
                    'count'  => $group->count(),
                ];
            })
            ->values()
            ->sortByDesc('count')
            ->values()
            ->all();

        // Group by department
        $byDepartment = $activities
            ->groupBy('department_id')
            ->map(function ($group, $deptId) {
                $first = $group->first();

                return [
                    'department_id'   => $deptId ? (int) $deptId : null,
                    'department_name' => $first->department->name ?? null,
                    'total_actions'   => $group->count(),
                    'uploads'         => $group->where('action', 'uploaded')->count(),
                    'approvals'       => $group->where('action', 'approved')->count(),
                ];
            })
            ->values()
            ->sortByDesc('total_actions')
            ->values()
            ->all();

        // Top users by actions
        $byUser = $activities
            ->groupBy('user_id')
            ->map(function ($group, $userId) {
                $first = $group->first();

                return [
                    'user_id'         => $userId ? (int) $userId : null,
                    'user_name'       => $first->user->name ?? null,
                    'department_name' => $first->department->name ?? null,
                    'actions_count'   => $group->count(),
                    'uploads_count'   => $group->where('action', 'uploaded')->count(),
                ];
            })
            ->values()
            ->sortByDesc('actions_count')
            ->values()
            ->all();

        return response()->json([
            'filters' => [
                'date_from'     => $dateFrom,
                'date_to'       => $dateTo,
                'department_id' => $deptId ? (int) $deptId : null,
            ],
            'summary' => [
                'total_actions'    => $totalActions,
                'total_uploads'    => $totalUploads,
                'failed_actions'   => $failedActions,
                'approvals'        => $approvals,
                'rejections'       => $rejections,
            ],
            'by_action_type' => $byActionType,
            'by_department'  => $byDepartment,
            'top_users'      => $byUser,
        ]);
    }
}
