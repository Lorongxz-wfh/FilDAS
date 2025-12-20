<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return ['Laravel' => app()->version()];
});

// Dummy web login route to satisfy route('login') if anything redirects here.
Route::get('/login', function () {
    return response()->json(['message' => 'Web login not implemented'], 501);
})->name('login');
