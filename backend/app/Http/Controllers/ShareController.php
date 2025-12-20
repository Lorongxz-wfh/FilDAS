<?php

namespace App\Http\Controllers;

use App\Models\Share;
use App\Models\User;
use App\Models\Document;
use App\Models\Folder;
use Illuminate\Http\Request;

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
     * type = "document" | "folder"
     */
    public function itemShares(Request $request, string $type, int $id)
    {
        if (!in_array($type, ['document', 'folder'], true)) {
            return response()->json(['error' => 'Invalid type'], 400);
        }

        $column = $type === 'document' ? 'document_id' : 'folder_id';

        $shares = Share::with(['owner', 'targetUser'])
            ->where($column, $id)
            ->get();

        return response()->json($shares);
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
            'permission' => 'required|in:viewer,editor',
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

        return response()->json($share->load(['owner', 'targetUser']), 201);
    }

    /**
     * GET /documents/shared
     * Optional query: folder_id
     */
    public function sharedDocuments(Request $request)
    {
        $user     = $request->user();
        $folderId = $request->query('folder_id');

        // 1) IDs of documents shared directly to this user
        $directDocIds = Share::where('target_user_id', $user->id)
            ->whereNotNull('document_id')
            ->pluck('document_id')
            ->toArray();

        // 2) Root shared folder IDs
        $rootSharedFolderIds = Share::where('target_user_id', $user->id)
            ->whereNotNull('folder_id')
            ->pluck('folder_id')
            ->toArray();

        // 3) Collect all descendant folder IDs (including roots)
        $allSharedFolderIds = $rootSharedFolderIds;

        if (!empty($rootSharedFolderIds)) {
            $queue = $rootSharedFolderIds;

            while (!empty($queue)) {
                $childIds = \App\Models\Folder::whereIn('parent_id', $queue)
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

        // 4) Base documents query (direct docs OR docs in any shared/descendant folder)
        $docsQuery = \App\Models\Document::with(['folder', 'department', 'owner'])
            ->where(function ($q) use ($directDocIds, $allSharedFolderIds) {
                if (!empty($directDocIds)) {
                    $q->whereIn('id', $directDocIds);
                }

                if (!empty($allSharedFolderIds)) {
                    $q->orWhereIn('folder_id', $allSharedFolderIds);
                }
            });

        // When browsing inside a specific shared folder
        if ($folderId !== null) {
            $docsQuery->where('folder_id', (int) $folderId);
        }

        $documents = $docsQuery->get();

        $allDocs = $documents->map(function (\App\Models\Document $doc) {
            return [
                'id'                => $doc->id,
                'title'             => $doc->title,
                'original_filename' => $doc->original_filename,
                'mime_type'         => $doc->mime_type,
                'size_bytes'        => $doc->size_bytes,
                'uploaded_at'       => optional($doc->uploaded_at)->toIso8601String(),

                'folder_id'         => $doc->folder_id,
                'folder_name'       => optional($doc->folder)->name,

                'department_id'     => $doc->department_id,
                'department_name'   => optional($doc->department)->name,

                'owner_id'          => $doc->owner_id,
                'owner_name'        => optional($doc->owner)->name,
            ];
        })->values();

        return response()->json($allDocs);
    }



    /**
     * GET /folders/shared
     * Optional query: parent_id
     */
    public function sharedFolders(Request $request)
    {
        $user     = $request->user();
        $parentId = $request->query('parent_id'); // can be null

        // 1) Folders explicitly shared to this user
        $directShares = Share::with(['folder.department', 'owner'])
            ->where('target_user_id', $user->id)
            ->whereNotNull('folder_id')
            ->get();

        $sharedFolderIds = $directShares->pluck('folder_id')->toArray();

        // 2) Base query: folders that are either
        //    - directly shared, OR
        //    - children of a shared folder (inherit access)
        $foldersQuery = Folder::with('department')
            ->where(function ($q) use ($sharedFolderIds) {
                if (!empty($sharedFolderIds)) {
                    $q->whereIn('id', $sharedFolderIds)
                        ->orWhereIn('parent_id', $sharedFolderIds);
                }
            });

        // 3) Filter by parent_id for navigation
        if ($parentId === null) {
            // top-level: only those whose parent_id is null
            $foldersQuery->whereNull('parent_id');
        } else {
            $foldersQuery->where('parent_id', (int) $parentId);
        }

        $folders = $foldersQuery->get();

        // Need owner / permission info for folders that were directly shared
        $sharesByFolder = $directShares->keyBy('folder_id');

        $result = $folders->map(function (Folder $folder) use ($sharesByFolder) {
            $share = $sharesByFolder->get($folder->id);

            return [
                'id'              => $folder->id,
                'name'            => $folder->name,
                'parent_id'       => $folder->parent_id,
                'department_id'   => $folder->department_id,
                'department_name' => optional($folder->department)->name,
                'owner_id'        => optional($share)->owner_id,
                'owner_name'      => optional(optional($share)->owner)->name,
                'permission'      => optional($share)->permission ?? 'viewer',
            ];
        })->values();

        return response()->json($result);
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

        return response()->json(['message' => 'Share removed']);
    }
}
