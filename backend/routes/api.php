<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\DepartmentTypeController;
use App\Http\Controllers\FolderController;
use App\Http\Controllers\ShareController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Api\DashboardController;

// Public / health
Route::get('/ping', fn() => response()->json(['message' => 'API is working']));

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [RegisteredUserController::class, 'store']);

Route::get('/documents/{document}/stream', [DocumentController::class, 'stream'])
    ->name('documents.stream');
Route::get('/documents/{document}/preview', [DocumentController::class, 'preview'])
    ->name('documents.preview');

// Protected
Route::middleware('auth:sanctum')->group(function () {
    // Auth / current user
    Route::get('/user', function (Request $request) {
        return $request->user()->load(['role', 'department']);
    });
    Route::post('/logout', [AuthController::class, 'logout']);

    // Activity logs + reports
    Route::get('/activity-logs', [ActivityLogController::class, 'index']);
    Route::get('/reports/activity-summary', [ReportController::class, 'activitySummary']);

    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

    // Users
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{user}', [UserController::class, 'show']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    // Department types
    Route::get('/department-types', [DepartmentTypeController::class, 'index']);

    // Departments
    Route::get('/departments', [DepartmentController::class, 'index']);
    Route::post('/departments', [DepartmentController::class, 'store']);
    Route::get('/departments/{department}', [DepartmentController::class, 'show']);
    Route::put('/departments/{department}', [DepartmentController::class, 'update']);
    Route::patch('/departments/{department}', [DepartmentController::class, 'update']);
    Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
    Route::post('/departments/{department}/logo', [DepartmentController::class, 'uploadLogo']);
    Route::get('/departments/{department}/activity', [DepartmentController::class, 'activity']);

    // Folders
    Route::get('/folders', [FolderController::class, 'index']);
    Route::post('/folders', [FolderController::class, 'store']);

    Route::get('/folders/shared', [ShareController::class, 'sharedFolders']);
    Route::get('/folders/shared/search', [ShareController::class, 'searchSharedFolders']);

    Route::get('/folders/{folder}', [FolderController::class, 'show']);
    Route::put('/folders/{folder}', [FolderController::class, 'update']);
    Route::patch('/folders/{folder}', [FolderController::class, 'update']);
    Route::delete('/folders/{folder}', [FolderController::class, 'destroy']);

    Route::get('/folders/{folder}/download', [FolderController::class, 'download'])
        ->name('folders.download');
    Route::post('/folders/{folder}/move', [FolderController::class, 'move']);
    Route::post('/folders/{folder}/copy', [FolderController::class, 'copy']);
    Route::get('/folders/{folder}/activity', [FolderController::class, 'activity']);

    Route::get('/trash/folders', [FolderController::class, 'trashIndex']);
    Route::get('/trash/folders/{folder}/contents', [FolderController::class, 'trashContents']);
    Route::post('/folders/{folder}/trash', [FolderController::class, 'trash']);
    Route::post('/folders/{folder}/restore', [FolderController::class, 'restore']);

    // Documents
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);

    Route::get('/trash/documents', [DocumentController::class, 'trashIndex']);

    Route::get('/documents/shared', [ShareController::class, 'sharedDocuments']);
    Route::get('/documents/shared/search', [ShareController::class, 'searchSharedDocuments']);

    Route::get('/documents/{document}', [DocumentController::class, 'show']);
    Route::put('/documents/{document}', [DocumentController::class, 'update']);
    Route::patch('/documents/{document}', [DocumentController::class, 'update']);
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);

    Route::get('/documents/{document}/download', [DocumentController::class, 'download'])
        ->name('documents.download');
    Route::post('/documents/{document}/move', [DocumentController::class, 'move']);
    Route::post('/documents/{document}/copy', [DocumentController::class, 'copy']);
    Route::post('/documents/{document}/trash', [DocumentController::class, 'trash']);
    Route::post('/documents/{document}/restore', [DocumentController::class, 'restore']);
    Route::get('/documents/{document}/activity', [DocumentController::class, 'activity']);

    Route::get('/documents/statistics/summary', [DocumentController::class, 'statistics']);

    // QA approvals & comments
    Route::get('/qa/approvals', [DocumentController::class, 'qaIndex']);
    Route::post('/documents/{document}/approve', [DocumentController::class, 'approve']);
    Route::post('/documents/{document}/reject', [DocumentController::class, 'reject']);
    Route::post('/documents/{document}/self-assign', [DocumentController::class, 'selfAssign']);
    Route::post('/documents/{document}/assign', [DocumentController::class, 'assign']);

    Route::get('/documents/{document}/comments', [CommentController::class, 'indexForDocument']);
    Route::post('/documents/{document}/comments', [CommentController::class, 'storeForDocument']);

    // Sharing
    Route::get('/shares', [ShareController::class, 'index']);
    Route::get('/items/{type}/{id}/shares', [ShareController::class, 'itemShares']);
    Route::post('/shares', [ShareController::class, 'store']);
    Route::patch('/shares/{share}', [ShareController::class, 'update']);
    Route::delete('/shares/{share}', [ShareController::class, 'destroy']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
});
