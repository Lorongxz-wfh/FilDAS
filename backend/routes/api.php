<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\FolderController;
use App\Http\Controllers\ShareController;

// Health check
Route::get('/ping', function () {
    return response()->json(['message' => 'API is working']);
});

// Public auth routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [RegisteredUserController::class, 'store']);

// Public preview/stream routes (read-only)
Route::get('/documents/{document}/stream', [DocumentController::class, 'stream'])
    ->name('documents.stream');
Route::get('/documents/{document}/preview', [DocumentController::class, 'preview'])
    ->name('documents.preview');

// Protected routes (require auth:sanctum)
Route::middleware(['auth:sanctum'])->group(function () {

    Route::get('/user', function (Request $request) {
        return $request->user()->load(['role', 'department']);
    });

    // Activity logs (super admin / admin only)
    Route::get('/activity-logs', [\App\Http\Controllers\Api\ActivityLogController::class, 'index']);

    // Users
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{user}', [UserController::class, 'show']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    Route::post('/logout', [AuthController::class, 'logout']);

    // Department types (for dropdowns)
    Route::get('/department-types', [\App\Http\Controllers\DepartmentTypeController::class, 'index']);

    // Departments
    Route::get('/departments', [DepartmentController::class, 'index']);
    Route::post('/departments/{department}/logo', [DepartmentController::class, 'uploadLogo']);
    Route::post('/departments', [DepartmentController::class, 'store']);
    Route::get('/departments/{department}', [DepartmentController::class, 'show']);
    Route::put('/departments/{department}', [DepartmentController::class, 'update']);
    Route::patch('/departments/{department}', [DepartmentController::class, 'update']);
    Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
    Route::get('/departments/{department}/activity', [DepartmentController::class, 'activity']);


    // Folders
    Route::get('/folders', [FolderController::class, 'index']);
    Route::post('/folders', [FolderController::class, 'store']);

    // SHARED folders (used by SharedFilesPage) – MUST be before /folders/{folder}
    Route::get('/folders/shared', [ShareController::class, 'sharedFolders']);
    Route::get('/folders/shared/search', [ShareController::class, 'searchSharedFolders']);

    // Regular folder-by-id routes
    Route::get('/folders/{folder}', [FolderController::class, 'show']);
    Route::put('/folders/{folder}', [FolderController::class, 'update']);
    Route::patch('/folders/{folder}', [FolderController::class, 'update']);
    Route::delete('/folders/{folder}', [FolderController::class, 'destroy']);

    // Folder actions
    Route::get('/folders/{folder}/download', [FolderController::class, 'download'])
        ->name('folders.download');
    Route::post('/folders/{folder}/move', [FolderController::class, 'move']);
    Route::post('/folders/{folder}/copy', [FolderController::class, 'copy']);
    Route::get('/folders/{folder}/activity', [FolderController::class, 'activity']);
    Route::get('/archive/folders', [FolderController::class, 'archiveIndex']);
    Route::post('/folders/{folder}/archive', [FolderController::class, 'archive']);
    Route::post('/folders/{folder}/restore', [FolderController::class, 'restore']);


    // Documents
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::get('/archive/documents', [DocumentController::class, 'archiveIndex']);


    // SHARED documents (used by SharedFilesPage) – MUST be before /documents/{document}
    Route::get('/documents/shared', [ShareController::class, 'sharedDocuments']);
    Route::get('/documents/shared/search', [ShareController::class, 'searchSharedDocuments']);

    // Regular document-by-id routes
    Route::get('/documents/{document}', [DocumentController::class, 'show']);
    Route::put('/documents/{document}', [DocumentController::class, 'update']);
    Route::patch('/documents/{document}', [DocumentController::class, 'update']);
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);

    // Document actions
    Route::get('/documents/{document}/download', [DocumentController::class, 'download'])
        ->name('documents.download');
    Route::post('/documents/{document}/move', [DocumentController::class, 'move']);
    Route::post('/documents/{document}/copy', [DocumentController::class, 'copy']);
    Route::post('/documents/{document}/archive', [DocumentController::class, 'archive']);
    Route::post('/documents/{document}/restore', [DocumentController::class, 'restore']);
    Route::get('/documents/{document}/activity', [DocumentController::class, 'activity']);
    Route::get('/documents/statistics/summary', [DocumentController::class, 'statistics']);

    // QA approvals
    Route::get('/qa/approvals', [DocumentController::class, 'qaIndex']);
    Route::post('/documents/{document}/approve', [DocumentController::class, 'approve']);
    Route::post('/documents/{document}/reject', [DocumentController::class, 'reject']);

    // Document comments
    Route::get('/documents/{document}/comments', [\App\Http\Controllers\CommentController::class, 'indexForDocument']);
    Route::post('/documents/{document}/comments', [\App\Http\Controllers\CommentController::class, 'storeForDocument']);

    // Sharing routes
    Route::get('/shares', [ShareController::class, 'index']);
    Route::get('/items/{type}/{id}/shares', [ShareController::class, 'itemShares']);
    Route::post('/shares', [ShareController::class, 'store']);
    Route::patch('/shares/{share}', [ShareController::class, 'update']);
    Route::delete('/shares/{share}', [ShareController::class, 'destroy']);


    Route::get('/notifications', [\App\Http\Controllers\NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
});
