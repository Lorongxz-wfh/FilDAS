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

// Public auth routes (no auth:sanctum)
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [RegisteredUserController::class, 'store']);

// Public preview/stream routes (read-only)
Route::get('/documents/{document}/stream', [DocumentController::class, 'stream'])
    ->name('documents.stream');
Route::get('/documents/{document}/preview', [DocumentController::class, 'preview'])
    ->name('documents.preview');

// Protected routes (require token via Sanctum)
Route::middleware(['auth:sanctum'])->group(function () {

    Route::get('/user', function (Request $request) {
        return $request->user()->load(['role', 'department']);
    });

    Route::post('/logout', [AuthController::class, 'logout']);

    // Users
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{user}', [UserController::class, 'show']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    // Departments
    Route::get('/departments', [DepartmentController::class, 'index']);
    Route::post('/departments', [DepartmentController::class, 'store']);
    Route::get('/departments/{department}', [DepartmentController::class, 'show']);
    Route::put('/departments/{department}', [DepartmentController::class, 'update']);
    Route::patch('/departments/{department}', [DepartmentController::class, 'update']);
    Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);

    // Folders (regular)
    Route::get('/folders', [FolderController::class, 'index']);
    Route::post('/folders', [FolderController::class, 'store']);

    // SHARED folders (used by SharedFilesPage)
    Route::get('/folders/shared', [ShareController::class, 'sharedFolders']);

    Route::get('/folders/{folder}', [FolderController::class, 'show']);
    Route::put('/folders/{folder}', [FolderController::class, 'update']);
    Route::patch('/folders/{folder}', [FolderController::class, 'update']);
    Route::delete('/folders/{folder}', [FolderController::class, 'destroy']);

    // Documents (full CRUD)
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);

    // SHARED documents (used by SharedFilesPage)
    Route::get('/documents/shared', [ShareController::class, 'sharedDocuments']);

    Route::get('/documents/{document}', [DocumentController::class, 'show']);
    Route::put('/documents/{document}', [DocumentController::class, 'update']);
    Route::patch('/documents/{document}', [DocumentController::class, 'update']);
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);

    // Document actions (protected)
    Route::get('/documents/{document}/download', [DocumentController::class, 'download'])
        ->name('documents.download');
    Route::get('/documents/statistics/summary', [DocumentController::class, 'statistics']);

    // Sharing routes
    Route::get('/shares', [ShareController::class, 'index']); // shared TO me
    Route::get('/items/{type}/{id}/shares', [ShareController::class, 'itemShares']);
    Route::post('/shares', [ShareController::class, 'store']);
    Route::delete('/shares/{share}', [ShareController::class, 'destroy']);
});
