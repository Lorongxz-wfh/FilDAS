<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Helpers\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            // If the email exists, log a failed login for that user
            if ($user) {
                ActivityLogger::log(
                    $user,
                    'login_failed',
                    'Invalid password'
                );
            }

            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        // Load role and department relations
        $user->load(['role', 'department']);

        // AUDIT: successful login
        ActivityLogger::log($user, 'login_success', 'User logged in', $user->id);


        // Create token for this device
        $token = $user->createToken('fildas-token')->plainTextToken;


        return response()->json([
            'token' => $token,
            'user'  => $user,
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user) {
            ActivityLogger::log(
                $user,
                'logout',
                'User logged out'
            );
        }

        $user?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out']);
    }
}
