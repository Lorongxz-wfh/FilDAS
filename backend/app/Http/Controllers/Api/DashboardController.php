<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Document;      // change to your actual model name
use App\Models\Collection;    // change to your actual model name
use Illuminate\Http\Request;
use App\Models\Activity;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $user = $request->user();

        // Time ranges
        $startOfWeek = Carbon::now()->startOfWeek();
        $startOfLastWeek = (clone $startOfWeek)->subWeek();

        // Basic doc stats (non-trashed)
        $baseDocs = Document::notTrashed();

        $totalDocs = (clone $baseDocs)->count();
        $approvedDocs = (clone $baseDocs)->approved()->count();
        $pendingDocs = (clone $baseDocs)->pending()->count();
        $rejectedDocs = (clone $baseDocs)->rejected()->count();

        // Uploads this week vs last week
        $uploadedThisWeek = (clone $baseDocs)
            ->where('uploaded_at', '>=', $startOfWeek)
            ->count();

        $uploadedLastWeek = (clone $baseDocs)
            ->whereBetween('uploaded_at', [$startOfLastWeek, $startOfWeek])
            ->count();

        // QA queue
        $pendingQa = (clone $baseDocs)->pending()->count();
        $rejectedThisWeek = (clone $baseDocs)
            ->rejected()
            ->where('approved_at', '>=', $startOfWeek)
            ->count();

        // Active users this week = users who appear in Activity this week
        $activeUsersThisWeek = Activity::where('created_at', '>=', $startOfWeek)
            ->distinct('user_id')
            ->count('user_id');

        // Recent documents (for "recent items" section)
        $recentDocs = (clone $baseDocs)
            ->with(['department', 'uploadedBy'])
            ->orderBy('uploaded_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function (Document $doc) {
                return [
                    'id' => $doc->id,
                    'title' => $doc->title ?: $doc->original_filename,
                    'status' => $doc->status,
                    'department_name' => $doc->department?->name,
                    'uploaded_by' => $doc->uploadedBy?->name,
                    'uploaded_at' => optional($doc->uploaded_at)->toIso8601String(),
                ];
            })
            ->all();

        // Recent activity (for the right-hand list)
        $recentActivity = Activity::with(['user', 'department'])
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function (Activity $a) {
                return [
                    'id' => $a->id,
                    'action' => $a->action,
                    'details' => $a->details,
                    'user_name' => $a->user?->name,
                    'department_name' => $a->department?->name,
                    'created_at' => $a->created_at?->toIso8601String(),
                ];
            })
            ->all();

        return response()->json([
            'stats' => [
                'total_documents' => $totalDocs,
                'approved_documents' => $approvedDocs,
                'pending_documents' => $pendingDocs,
                'rejected_documents' => $rejectedDocs,
                'uploaded_this_week' => $uploadedThisWeek,
                'uploaded_last_week' => $uploadedLastWeek,
                'pending_qa' => $pendingQa,
                'rejected_this_week' => $rejectedThisWeek,
                'active_users_this_week' => $activeUsersThisWeek,
            ],
            'recent_documents' => $recentDocs,
            'recent_activity' => $recentActivity,
        ]);
    }
}
