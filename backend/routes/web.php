<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;

// use App\Http\Controllers\DocumentController;

// Route::get('/documents/{document}/preview', [DocumentController::class, 'preview']);


Route::get('/', function () {
    return ['Laravel' => app()->version()];
});

require __DIR__.'/auth.php';
