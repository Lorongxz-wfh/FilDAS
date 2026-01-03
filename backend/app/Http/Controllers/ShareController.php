<?php

namespace App\Http\Controllers;

use App\Models\Share;
use App\Models\User;
use App\Models\Document;
use App\Models\Folder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Helpers\ActivityLogger;
use App\Notifications\ItemSharedNotification;


class ShareController extends Controller
{
    /**
     * GET /shares
     * List items shared TO the authenticated user.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $shares = Share::with(['owner', 'document.folder', 'folder'])
            ->where('target_user_id', $user->id)
            ->get();

        return response()->json($shares);
    }

    /**
     * GET /items/{type}/{id}/shares
     * List people who have access to a specific document or folder.
     */
    public function itemShares(Request $request, string $type, int $id)
    {
        if (!in_array($type, ['document', 'folder'], true)) {
            return response()->json(['error' => 'Invalid type'], 400);
        }

        $directShares = collect();
        $inheritedShares = collect();

        if ($type === 'document') {
            // Direct document shares
            $directShares = Share::with(['owner', 'targetUser'])
                ->where('document_id', $id)
                ->get()
                ->map(function (Share $share) {
                    $share->inherited_from = null;
                    return $share;
                });

            // Inherited from ancestor folders
            $document = Document::find($id);
            if ($document && $document->folder_id) {
                $folderId = $document->folder_id;

                while ($folderId) {
                    $folderShares = Share::with(['owner', 'targetUser'])
                        ->where('folder_id', $folderId)
                        ->get()
                        ->map(function (Share $share) use ($folderId) {
                            $share->inherited_from = [
                                'type' => 'folder',
                                'id'   => $folderId,
                            ];
                            return $share;
                        });

                    $inheritedShares = $inheritedShares->concat($folderShares);

                    $folder = Folder::find($folderId);
                    $folderId = $folder ? $folder->parent_id : null;
                }
            }
        } else { // folder
            // Direct folder shares
            $directShares = Share::with(['owner', 'targetUser'])
                ->where('folder_id', $id)
                ->get()
                ->map(function (Share $share) {
                    $share->inherited_from = null;
                    return $share;
                });

            // Inherited from ancestor folders
            $folder = Folder::find($id);
            if ($folder) {
                $parentId = $folder->parent_id;

                while ($parentId) {
                    $parentShares = Share::with(['owner', 'targetUser'])
                        ->where('folder_id', $parentId)
                        ->get()
                        ->map(function (Share $share) use ($parentId) {
                            $share->inherited_from = [
                                'type' => 'folder',
                                'id'   => $parentId,
                            ];
                            return $share;
                        });

                    $inheritedShares = $inheritedShares->concat($parentShares);

                    $parent = Folder::find($parentId);
                    $parentId = $parent ? $parent->parent_id : null;
                }
            }
        }

        $allShares = $directShares
            ->concat($inheritedShares)
            ->unique(function (Share $s) {
                return implode('-', [
                    $s->owner_id,
                    $s->target_user_id,
                    $s->document_id,
                    $s->folder_id,
                    $s->permission,
                    $s->inherited_from['type'] ?? 'direct',
                    $s->inherited_from['id'] ?? 'direct',
                ]);
            })
            ->values();

        return response()->json($allShares);
    }

    /**
     * POST /shares
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'type'       => 'required|in:document,folder',
            'item_id'    => 'required|integer',
            'email'      => 'required|email',
            'permission' => 'required|in:viewer,contributor,editor',
        ]);



        $owner = $request->user();

        $targetUser = User::where('email', $validated['email'])->first();
        if (!$targetUser) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $documentId = null;
        $folderId   = null;

        if ($validated['type'] === 'document') {
            $document = Document::findOrFail($validated['item_id']);
            $documentId = $document->id;
        } else {
            $folder = Folder::findOrFail($validated['item_id']);
            $folderId = $folder->id;
        }

        $share = Share::updateOrCreate(
            [
                'owner_id'       => $owner->id,
                'target_user_id' => $targetUser->id,
                'document_id'    => $documentId,
                'folder_id'      => $folderId,
            ],
            [
                'permission'     => $validated['permission'],
            ]
        );

        // LOG ACTIVITY
        $item = $share->document_id ? Document::find($share->document_id) : Folder::find($share->folder_id);
        if ($item) {
            $targetLabel = $targetUser->name
                ? $targetUser->name . ' <' . $targetUser->email . '>'
                : $targetUser->email;

            ActivityLogger::log(
                $item,
                'shared',
                'Shared with ' . $targetLabel . ' as ' . $share->permission
            );
        }

        // NOTIFY TARGET USER
        $itemType = $share->document_id ? 'document' : 'folder';
        $itemName = $share->document_id
            ? ($item?->title ?: $item?->original_filename ?: 'Untitled document')
            : ($item?->name ?: 'Untitled folder');

        $targetUser->notify(new ItemSharedNotification(
            $itemType,
            $itemName,
            $share->permission,
            $owner->name ?? 'Someone',
            $item?->id
        ));

        return response()->json($share->load(['owner', 'targetUser']), 201);
    }

    /**
     * GET /documents/shared
     * Used by SharedFilesPage.tsx - supports ?folder_id= param
     */
    public function sharedDocuments(Request $request)
    {
        $user     = $request->user();
        $folderId = $request->query('folder_id');

        // 1) Direct document shares to this user
        $directDocShares = Share::where('target_user_id', $user->id)
            ->whereNotNull('document_id')
            ->get();

        $directDocIds = $directDocShares->pluck('document_id')->toArray();

        // 2) All shared folder IDs (roots + descendants)
        $rootSharedFolderShares = Share::where('target_user_id', $user->id)
            ->whereNotNull('folder_id')
            ->get();

        $rootSharedFolderIds = $rootSharedFolderShares->pluck('folder_id')->toArray();
        $allSharedFolderIds  = $rootSharedFolderIds;

        if (!empty($rootSharedFolderIds)) {
            $queue = $rootSharedFolderIds;

            while (!empty($queue)) {
                $childIds = Folder::whereIn('parent_id', $queue)
                    ->pluck('id')
                    ->toArray();

                $childIds = array_values(array_diff($childIds, $allSharedFolderIds));

                if (empty($childIds)) {
                    break;
                }

                $allSharedFolderIds = array_merge($allSharedFolderIds, $childIds);
                $queue              = $childIds;
            }
        }

        // 3) Build a permission map for documents:
        //    - direct document shares
        //    - documents in shared folders inherit the folder permission
        $docPermissionById = [];

        // 3a) direct document shares
        foreach ($directDocShares as $share) {
            $docPermissionById[$share->document_id] = $share->permission; // 'viewer' | 'editor'
        }

        // 3b) folder shares (permission per folder)
        $folderPermissionById = [];
        foreach ($rootSharedFolderShares as $share) {
            $folderPermissionById[$share->folder_id] = $share->permission;
        }

        // propagate folder permissions to descendants (same as sharedFolders)
        if (!empty($rootSharedFolderIds)) {
            $queue = $rootSharedFolderIds;

            while (!empty($queue)) {
                $childIds = Folder::whereIn('parent_id', $queue)
                    ->pluck('id')
                    ->toArray();

                $childIds = array_values(array_diff($childIds, array_keys($folderPermissionById)));

                if (empty($childIds)) {
                    break;
                }

                foreach ($childIds as $childId) {
                    $parentIdForChild = Folder::where('id', $childId)->value('parent_id');
                    $parentPerm       = $folderPermissionById[$parentIdForChild] ?? 'viewer';
                    $folderPermissionById[$childId] = $parentPerm;
                }

                $queue = $childIds;
            }
        }

        // 3c) Apply folder permissions to documents in those folders (only non-archived)
        if (!empty($allSharedFolderIds)) {
            $docsInSharedFolders = Document::whereNull('archived_at')
                ->whereIn('folder_id', $allSharedFolderIds)
                ->get(['id', 'folder_id']);

            foreach ($docsInSharedFolders as $doc) {
                $folderPerm = $folderPermissionById[$doc->folder_id] ?? null;
                if ($folderPerm && !isset($docPermissionById[$doc->id])) {
                    $docPermissionById[$doc->id] = $folderPerm;
                }
            }
        }

        // 4) Base query: direct docs OR docs in shared folders (only non-archived)
        $docsQuery = Document::with(['folder.department', 'uploadedBy'])
            ->whereNull('archived_at')
            ->where(function ($q) use ($directDocIds, $allSharedFolderIds) {
                if (!empty($directDocIds)) {
                    $q->whereIn('id', $directDocIds);
                }
                if (!empty($allSharedFolderIds)) {
                    $q->orWhereIn('folder_id', $allSharedFolderIds);
                }
            });

        // Filter by specific folder when navigating
        if ($folderId !== null) {
            $docsQuery->where('folder_id', (int) $folderId);
        }

        $documents = $docsQuery->orderBy('created_at', 'desc')->get();

        // 5) Map to API shape, using real share permission
        $mapped = $documents->map(function ($doc) use ($docPermissionById) {
            return [
                'id'               => $doc->id,
                'title'            => $doc->title,
                'originalfilename' => $doc->original_filename,
                'mimetype'         => $doc->mime_type,
                'sizebytes'        => $doc->file_size ?? $doc->size_bytes ?? 0,
                'uploadedat'       => $doc->created_at->toISOString(),
                'lastopenedat'     => $doc->last_opened_at?->toISOString() ?? null,
                'folderid'         => $doc->folder_id,
                'foldername'       => $doc->folder?->name ?? null,
                'departmentid'     => $doc->folder?->department_id ?? $doc->department_id,
                'departmentname'   => $doc->folder?->department?->name ?? null,
                'ownerid'          => $doc->uploaded_by ?? $doc->owner_id,
                'ownername'        => $doc->uploadedBy?->name ?? $doc->owner?->name ?? 'Unknown',
                'original_owner_id'   => $doc->original_owner_id,
                'original_owner_name' => $doc->originalOwner?->name ?? null,
                'sharepermission'  => $docPermissionById[$doc->id] ?? 'viewer',
            ];
        });

        return response()->json($mapped);
    }

    /**
     * GET /folders/shared
     * Used by SharedFilesPage.tsx - supports ?parent_id= param
     */
    public function sharedFolders(Request $request)
    {
        $user = $request->user();
        $parentId = $request->query('parent_id');

        // 1) Direct folder shares to this user
        $directShares = Share::where('target_user_id', $user->id)
            ->whereNotNull('folder_id')
            ->get();

        if ($directShares->isEmpty()) {
            return response()->json([]);
        }

        $rootSharedFolderIds = $directShares->pluck('folder_id')->all();

        // 2) Build permission inheritance map
        $folderPermissionById = [];
        foreach ($directShares as $share) {
            $folderPermissionById[$share->folder_id] = $share->permission;
        }

        // BFS to inherit permissions to children
        $queue = $rootSharedFolderIds;
        while (!empty($queue)) {
            $childIds = Folder::whereIn('parent_id', $queue)
                ->pluck('id')
                ->toArray();

            $childIds = array_values(array_diff($childIds, array_keys($folderPermissionById)));

            if (empty($childIds)) {
                break;
            }

            foreach ($childIds as $childId) {
                $parentIdForChild = Folder::where('id', $childId)->value('parent_id');
                $parentPerm = $folderPermissionById[$parentIdForChild] ?? 'viewer';
                $folderPermissionById[$childId] = $parentPerm;
            }

            $queue = $childIds;
        }

        $allSharedFolderIds = array_keys($folderPermissionById);

        // 3) Query folders (only non-archived)
        $foldersQuery = Folder::with(['department', 'owner'])
            ->whereNull('archived_at')
            ->whereIn('id', $allSharedFolderIds);

        // Filter by parent_id for navigation in SharedFilesPage
        if ($parentId === null) {
            // Root level only
            $foldersQuery->whereNull('parent_id')
                ->whereIn('id', $rootSharedFolderIds);
        } else {
            $foldersQuery->where('parent_id', (int) $parentId);
        }

        $folders = $foldersQuery->orderBy('name')->get();

        // Format EXACTLY for SharedFilesPage.tsx
        $mapped = $folders->map(function ($folder) use ($folderPermissionById) {
            return [
                'id' => $folder->id,
                'name' => $folder->name,
                'parentid' => $folder->parent_id,
                'departmentid' => $folder->department_id,
                'departmentname' => $folder->department?->name ?? null,
                'ownerid' => $folder->owner_id,
                'ownername' => $folder->owner?->name ?? 'Unknown',
                'permission' => $folderPermissionById[$folder->id] ?? 'viewer',
            ];
        });

        return response()->json($mapped);
    }

    public function searchSharedDocuments(Request $request)
    {
        $request->validate(['q' => 'required|string']);
        $user = $request->user();

        // Reuse sharedDocuments logic but add search filter
        $folderId = $request->query('folder_id');
        $search = $request->query('q');

        $directDocIds = Share::where('target_user_id', $user->id)
            ->whereNotNull('document_id')
            ->pluck('document_id')
            ->toArray();

        $rootSharedFolderIds = Share::where('target_user_id', $user->id)
            ->whereNotNull('folder_id')
            ->pluck('folder_id')
            ->toArray();

        $allSharedFolderIds = $rootSharedFolderIds;
        if (!empty($rootSharedFolderIds)) {
            $queue = $rootSharedFolderIds;
            while (!empty($queue)) {
                $childIds = Folder::whereIn('parent_id', $queue)
                    ->pluck('id')
                    ->toArray();
                $childIds = array_values(array_diff($childIds, $allSharedFolderIds));
                if (empty($childIds)) break;
                $allSharedFolderIds = array_merge($allSharedFolderIds, $childIds);
                $queue = $childIds;
            }
        }

        $docsQuery = Document::with(['folder.department', 'uploadedBy'])
            ->whereNull('archived_at')
            ->where(function ($q) use ($directDocIds, $allSharedFolderIds) {
                if (!empty($directDocIds)) $q->whereIn('id', $directDocIds);
                if (!empty($allSharedFolderIds)) $q->orWhereIn('folder_id', $allSharedFolderIds);
            })
            ->where(function ($q) use ($search) {
                $like = "%{$search}%";
                $q->where('title', 'like', $like)
                    ->orWhere('original_filename', 'like', $like)
                    ->orWhereHas('uploadedBy', fn($sub) => $sub->where('name', 'like', $like))
                    ->orWhereHas('folder.department', fn($sub) => $sub->where('name', 'like', $like));
            });

        if ($folderId !== null) {
            $docsQuery->where('folder_id', (int) $folderId);
        }

        $documents = $docsQuery->limit(50)->get();

        // No Document::shares() relation; default permission to viewer
        $mapped = $documents->map(function ($doc) {
            return [
                'id' => $doc->id,
                'title' => $doc->title,
                'originalfilename' => $doc->original_filename,
                'mimetype' => $doc->mime_type,
                'sizebytes' => $doc->file_size ?? $doc->size_bytes ?? 0,
                'uploadedat' => $doc->created_at->toISOString(),
                'lastopenedat' => $doc->last_opened_at?->toISOString() ?? null,
                'folderid' => $doc->folder_id,
                'foldername' => $doc->folder?->name ?? null,
                'departmentid' => $doc->folder?->department_id ?? $doc->department_id,
                'departmentname' => $doc->folder?->department?->name ?? null,
                'ownerid' => $doc->uploaded_by ?? $doc->owner_id,
                'ownername' => $doc->uploadedBy?->name ?? $doc->owner?->name ?? 'Unknown',
                'sharepermission' => 'viewer',
            ];
        });

        return response()->json($mapped);
    }

    public function searchSharedFolders(Request $request)
    {
        $request->validate([
            'q'              => 'required|string',
            'parent_id'      => 'nullable|integer',
            'under_folder_id' => 'nullable|integer',
        ]);

        $user         = $request->user();
        $parentId     = $request->query('parent_id');
        $underFolderId = $request->query('under_folder_id');
        $search       = $request->query('q');


        // Same logic as sharedFolders but with search
        $directShares = Share::where('target_user_id', $user->id)
            ->whereNotNull('folder_id')
            ->get();

        if ($directShares->isEmpty()) {
            return response()->json([]);
        }

        $rootSharedFolderIds = $directShares->pluck('folder_id')->all();
        $folderPermissionById = [];
        foreach ($directShares as $share) {
            $folderPermissionById[$share->folder_id] = $share->permission;
        }

        $queue = $rootSharedFolderIds;
        while (!empty($queue)) {
            $childIds = Folder::whereIn('parent_id', $queue)->pluck('id')->toArray();
            $childIds = array_values(array_diff($childIds, array_keys($folderPermissionById)));
            if (empty($childIds)) break;
            foreach ($childIds as $childId) {
                $parentIdForChild = Folder::where('id', $childId)->value('parent_id');
                $parentPerm = $folderPermissionById[$parentIdForChild] ?? 'viewer';
                $folderPermissionById[$childId] = $parentPerm;
            }
            $queue = $childIds;
        }

        $allSharedFolderIds = array_keys($folderPermissionById);

        $foldersQuery = Folder::with(['department', 'owner'])
            ->whereNull('archived_at')
            ->whereIn('id', $allSharedFolderIds)
            ->where(function ($q) use ($search) {
                $like = "%{$search}%";
                $q->where('name', 'like', $like)
                    ->orWhereHas('department', fn($sub) => $sub->where('name', 'like', $like))
                    ->orWhereHas('owner', fn($sub) => $sub->where('name', 'like', $like));
            });

        // Filter scope:
        // - If under_folder_id is provided: search all descendants under that folder.
        // - Else if parent_id is provided: only direct children of that parent.
        // - Else (root search): only top-level shared roots.
        if ($underFolderId !== null) {
            $underFolderId = (int) $underFolderId;

            // Collect all descendant ids under this folder.
            $descendantIds = [$underFolderId];
            $queue = [$underFolderId];

            while (!empty($queue)) {
                $childIds = Folder::whereIn('parent_id', $queue)->pluck('id')->toArray();
                $childIds = array_values(array_diff($childIds, $descendantIds));
                if (empty($childIds)) {
                    break;
                }
                $descendantIds = array_merge($descendantIds, $childIds);
                $queue = $childIds;
            }

            $foldersQuery->whereIn('id', $descendantIds);
        } elseif ($parentId === null) {
            // Root search: allow matches in any shared folder, not only top-level roots.
            $foldersQuery->whereIn('id', $rootSharedFolderIds);
        } else {
            // Direct children of a specific parent (non-recursive).
            $foldersQuery->where('parent_id', (int) $parentId);
        }



        $folders = $foldersQuery->limit(50)->get();

        $mapped = $folders->map(function ($folder) use ($folderPermissionById) {
            return [
                'id' => $folder->id,
                'name' => $folder->name,
                'parentid' => $folder->parent_id,
                'departmentid' => $folder->department_id,
                'departmentname' => $folder->department?->name ?? null,
                'ownerid' => $folder->owner_id,
                'ownername' => $folder->owner?->name ?? 'Unknown',
                'permission' => $folderPermissionById[$folder->id] ?? 'viewer',
            ];
        });

        return response()->json($mapped);
    }

    public function update(Request $request, Share $share)
    {
        $data = $request->validate([
            'permission' => 'required|in:viewer,contributor,editor',
        ]);

        $share->permission = $data['permission'];
        $share->save();

        $item = $share->document_id ? Document::find($share->document_id) : Folder::find($share->folder_id);
        if ($item) {
            $target = $share->targetUser?->email ?? ('User #' . $share->target_user_id);

            ActivityLogger::log(
                $item,
                'share_permission_changed',
                'Share permission for ' . $target . ' set to ' . $share->permission
            );
        }



        $share->loadMissing(['owner', 'targetUser']);

        return response()->json($share);
    }

    /**
     * DELETE /shares/{share}
     */
    public function destroy(Request $request, Share $share)
    {
        $user = $request->user();

        if ($share->owner_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $share->delete();

        $item = $share->document_id ? Document::find($share->document_id) : Folder::find($share->folder_id);
        if ($item) {
            $target = $share->targetUser?->email ?? ('User #' . $share->target_user_id);

            ActivityLogger::log(
                $item,
                'unshared',
                'Access removed for ' . $target
            );
        }


        return response()->json(['message' => 'Share removed']);
    }
}
