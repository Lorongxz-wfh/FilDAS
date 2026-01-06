<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Helpers\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Notifications\ItemUpdatedNotification;

class UserController extends Controller
{
    protected function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if (!$user || (!$user->isAdmin() && !$user->isSuperAdmin())) {
            abort(403, 'Forbidden');
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->ensureAdmin($request);

        $authUser = $request->user();

        $query = User::with(['role', 'department'])
            ->whereNull('deleted_at'); // soft deleted excluded

        // Super Admin: see all users
        if ($authUser->isSuperAdmin()) {
            // no extra filter
        } else {
            // Admin: only users in their own department (or none if they have no department)
            if ($authUser->department_id) {
                $query->where('department_id', $authUser->department_id);
            } else {
                // admin without department sees nobody
                $query->whereRaw('1 = 0');
            }
        }

        $users = $query
            ->orderBy('name')
            ->get();


        return $users->map(function ($user) {
            return [
                'id'              => $user->id,
                'name'            => $user->name,
                'email'           => $user->email,
                'role'            => $user->role ? $user->role->name : null,
                'role_id'         => $user->role_id,
                'department_id'   => $user->department_id,
                'department_name' => $user->department?->name,
                // active vs inactive derived from status + soft delete
                'status'          => $user->effective_status,
                'created_at'      => $user->created_at,
                'updated_at'      => $user->updated_at,
            ];
        });
    }



    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'email'         => 'required|email|unique:users,email',
            'role_id'       => 'required|exists:roles,id',
            'department_id' => 'nullable|exists:departments,id',
            'status'        => 'required|in:active,disabled',
            'password'      => 'required|string|min:8',
        ]);

        $user = User::create([
            'name'          => $data['name'],
            'email'         => $data['email'],
            'password'      => Hash::make($data['password']),
            'role_id'       => $data['role_id'],
            'department_id' => $data['department_id'] ?? null,
            'status'        => $data['status'],
        ]);


        // Load the role relationship
        $user->load('role');

        // AUDIT
        ActivityLogger::log(
            $user,
            'created',
            sprintf(
                'User created: %s (%s), role_id=%d, status=%s',
                $user->name,
                $user->email,
                $user->role_id,
                $user->status
            )
        );

        return response()->json([

            'id'              => $user->id,
            'name'            => $user->name,
            'email'           => $user->email,
            'role'            => $user->role ? $user->role->name : null,
            'role_id'         => $user->role_id,
            'department_id'   => $user->department_id,
            'department_name' => $user->department?->name,
            'status'          => $user->effective_status,
            'created_at'      => $user->created_at,
            'updated_at'      => $user->updated_at,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, User $user)
    {
        $this->ensureAdmin($request);

        $user->load([
            'role',
            'department',
        ]);

        // Preload counts to show in the details panel
        $ownedDepartmentsCount = $user->ownedDepartments()->count();
        $ownedFoldersCount     = $user->ownedFolders()->count();
        $ownedDocumentsCount   = $user->ownedDocuments()->count();
        $outgoingSharesCount   = $user->outgoingShares()->count();
        $incomingSharesCount   = $user->incomingShares()->count();

        return response()->json([
            'id'                    => $user->id,
            'name'                  => $user->name,
            'email'                 => $user->email,
            'role'                  => $user->role ? $user->role->name : null,
            'role_id'               => $user->role_id,
            'department_id'         => $user->department_id,
            'department_name'       => $user->department?->name,
            'status'                => $user->effective_status,
            'created_at'            => $user->created_at,
            'updated_at'            => $user->updated_at,
            'owned_departments'     => $ownedDepartmentsCount,
            'owned_folders'         => $ownedFoldersCount,
            'owned_documents'       => $ownedDocumentsCount,
            'outgoing_shares'       => $outgoingSharesCount,
            'incoming_shares'       => $incomingSharesCount,
            // If you later add last_login_at / last_password_change_at columns,
            // you can expose them here as well.
        ]);
    }


    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, User $user)
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'name'          => 'sometimes|required|string|max:255',
            'email'         => 'sometimes|required|email|unique:users,email,' . $user->id,
            'role_id'       => 'sometimes|required|exists:roles,id',
            'department_id' => 'sometimes|nullable|exists:departments,id',
            'status'        => 'sometimes|required|in:active,disabled',
            'password'      => 'nullable|string|min:8',
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $original = $user->getOriginal();

        $user->update($data);

        // Reload the role relationship
        $user->load('role');

        $changes = [];
        foreach ($data as $key => $value) {
            if ($key === 'password') {
                $changes[] = 'password: [changed]';
                continue;
            }
            if (array_key_exists($key, $original) && $original[$key] != $value) {
                $changes[] = sprintf('%s: "%s" → "%s"', $key, (string) $original[$key], (string) $value);
            }
        }

        $details = $changes
            ? 'User updated: ' . $user->email . ' (' . implode('; ', $changes) . ')'
            : 'User updated: ' . $user->email;

        ActivityLogger::log(
            $user,
            'updated',
            $details
        );

        // Notify the user about their account changes
        if (!empty($changes)) {
            $itemType = 'user';
            $itemName = $user->name ?? $user->email;

            // Determine a high-level changeType
            $changeType = 'updated';
            if (str_contains(implode(' ', $changes), 'role_id')) {
                $changeType = 'role_changed';
            } elseif (str_contains(implode(' ', $changes), 'department_id')) {
                $changeType = 'department_changed';
            } elseif (str_contains(implode(' ', $changes), 'status')) {
                $changeType = 'status_changed';
            } elseif (str_contains(implode(' ', $changes), 'password')) {
                $changeType = 'password_changed';
            }

            $user->notify(new ItemUpdatedNotification(
                $itemType,
                $itemName,
                $changeType,
                // Updated by:
                $request->user()->name ?? 'Admin',
                $user->id
            ));
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ? $user->role->name : null,
            'role_id' => $user->role_id,
            'status' => $user->effective_status,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, User $user)
    {
        $this->ensureAdmin($request);

        $userName = $user->name;
        $userId   = $user->id;

        $user->delete();

        // AUDIT
        ActivityLogger::log(
            $user,
            'deleted',
            'User deleted: ' . $userName . ' (ID ' . $userId . ')'
        );

        return response()->json(null, 204);
    }
}
