<?php

namespace App\Http\Controllers;

use App\Helpers\ActivityLogger;
use App\Models\Activity;
use App\Models\Document;
use App\Models\Folder;
use App\Models\Share;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use ZipArchive;
use App\Notifications\ItemUpdatedNotification;


class FolderController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = Folder::query()
            ->notTrashed(); // exclude trashed folders by default

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->filled('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        // Non‑admin users (staff) restricted to own department + shared folders.
        // SuperAdmin and Admin can see all departments.
        if (!$user->isAdmin() && !$user->isSuperAdmin()) {
            $deptId = $user->department_id;

            $sharedFolderIds = Share::where('target_user_id', $user->id)
                ->whereNotNull('folder_id')
                ->pluck('folder_id')
                ->toArray();

            $query->where(function ($q) use ($deptId, $sharedFolderIds) {
                if ($deptId) {
                    $q->where('department_id', $deptId);
                }

                if (!empty($sharedFolderIds)) {
                    $q->orWhereIn('id', $sharedFolderIds);
                }
            });
        }

        $folders = $query->orderBy('name')->get();

        return response()->json($folders);
    }

    public function trashIndex(Request $request)
    {
        $user = $request->user();

        $query = Folder::with(['department', 'owner'])
            ->trashed();

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->filled('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        // Visibility:
        // - Super Admin: all trashd folders.
        // - Admin: trashd folders in their own department.
        // - Staff: only trashd folders they own.
        $roleName     = $user->role->name ?? '';
        $isSuperAdmin = $roleName === 'Super Admin';
        $isAdmin      = $roleName === 'Admin';

        if ($isSuperAdmin) {
            // no extra filter
        } elseif ($isAdmin) {
            if ($user->department_id) {
                $query->where('department_id', $user->department_id);
            } else {
                // admin without department sees nothing
                $query->whereRaw('1 = 0');
            }
        } else {
            $query->where('owner_id', $user->id);
        }

        $query->orderBy('name');

        $folders = $query->paginate($request->get('per_page', 25));

        return response()->json($folders);
    }

    public function trashContents(Request $request, Folder $folder)
    {
        $user = $request->user();

        // Must be looking at a trashed folder
        if (!$folder->trashed_at) {
            return response()->json([
                'message' => 'Folder is not in trash',
            ], 400);
        }


        // Permission check: reuse same model as trash/restore
        $roleName     = $user->role->name ?? '';
        $isSuperAdmin = $roleName === 'Super Admin';
        $isAdmin      = $roleName === 'Admin';
        $sameDept     = $folder->department_id === $user->department_id;
        $sharePerm    = $this->getFolderSharePermissionForUser($folder, $user);
        $isSharedEditor = $sharePerm === 'editor';

        if (!$isSuperAdmin && !$sameDept && !$isSharedEditor) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Trashed child folders (direct children)
        $childFolders = Folder::with(['owner', 'department'])
            ->trashed()
            ->where('parent_id', $folder->id)
            ->orderBy('name')
            ->get()
            ->map(function (Folder $f) {
                return [
                    'id'              => $f->id,
                    'name'            => $f->name,
                    'department_name' => $f->department?->name,
                    'owner_name'      => $f->owner?->name,
                ];
            });

        // Trashed documents directly in this folder
        $documents = Document::with(['owner', 'department'])
            ->trashed()
            ->where('folder_id', $folder->id)
            ->orderBy('title')
            ->get()
            ->map(function (Document $d) {
                return [
                    'id'                => $d->id,
                    'title'             => $d->title,
                    'original_filename' => $d->original_filename,
                    'department_name'   => $d->department?->name,
                    'owner_name'        => $d->owner?->name ?? $d->uploadedBy?->name,
                ];
            });

        return response()->json([
            'folder'    => [
                'id'              => $folder->id,
                'name'            => $folder->name,
                'department_name' => $folder->department?->name,
                'owner_name'      => $folder->owner?->name,
            ],
            'folders'   => $childFolders,
            'documents' => $documents,
        ]);
    }


    public function trashTree(Request $request)
    {
        $user = $request->user();

        // 1) Base query: trashed folders with visibility rules (same as trashIndex)
        $query = Folder::with(['department', 'owner'])
            ->trashed();

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        // Visibility:
        // - Super Admin: all trashd folders.
        // - Admin: trashd folders in their own department.
        // - Staff: only trashd folders they own.
        $roleName     = $user->role->name ?? '';
        $isSuperAdmin = $roleName === 'Super Admin';
        $isAdmin      = $roleName === 'Admin';

        if ($isSuperAdmin) {
            // no extra filter
        } elseif ($isAdmin) {
            if ($user->department_id) {
                $query->where('department_id', $user->department_id);
            } else {
                $query->whereRaw('1 = 0');
            }
        } else {
            $query->where('owner_id', $user->id);
        }

        $folders = $query->get();

        if ($folders->isEmpty()) {
            return response()->json([]);
        }

        // 2) Load trashd documents under these folders
        $folderIds = $folders->pluck('id')->all();

        // Docs in trashed folders
        $documentsInFolders = Document::with(['owner', 'department'])
            ->trashed()
            ->whereIn('folder_id', $folderIds)
            ->get();

        // Docs trashed individually (no folder)
        $rootDocuments = Document::with(['owner', 'department'])
            ->trashed()
            ->whereNull('folder_id')
            ->get();

        // 3) Index folders and docs by parent
        $foldersById = $folders->keyBy('id');

        $childrenFolders = [];
        foreach ($folders as $folder) {
            $parentId = $folder->parent_id;
            $childrenFolders[$parentId][] = $folder;
        }

        $docsByFolder = [];
        foreach ($documentsInFolders as $doc) {
            $docsByFolder[$doc->folder_id][] = $doc;
        }


        // 4) Recursive builder
        $buildNode = function (Folder $folder) use (&$buildNode, $childrenFolders, $docsByFolder): array {
            $folderChildren = $childrenFolders[$folder->id] ?? [];
            $docChildren    = $docsByFolder[$folder->id] ?? [];

            return [
                'type'             => 'folder',
                'id'               => $folder->id,
                'name'             => $folder->name,
                'department_name'  => $folder->department?->name,
                'owner_name'       => $folder->owner?->name,
                'children_folders' => array_map($buildNode, $folderChildren),
                'children_documents' => array_map(function (Document $doc) {
                    return [
                        'type'             => 'document',
                        'id'               => $doc->id,
                        'title'            => $doc->title,
                        'original_filename' => $doc->original_filename,
                        'department_name'  => $doc->department?->name,
                        'owner_name'       => $doc->owner?->name ?? $doc->uploadedBy?->name,
                    ];
                }, $docChildren),
            ];
        };

        // 5) Build roots (folders whose parent is not in the trashd set)
        $rootNodes = [];
        foreach ($folders as $folder) {
            $parentId = $folder->parent_id;
            if (!$parentId || !isset($foldersById[$parentId])) {
                $rootNodes[] = $buildNode($folder);
            }
        }

        // 6) Add a virtual group for individually trashd documents (no folder)
        if ($rootDocuments->isNotEmpty()) {
            $rootNodes[] = [
                'type'             => 'folder',
                'id'               => 0, // synthetic id
                'name'             => 'Trashed documents (no folder)',
                'department_name'  => null,
                'owner_name'       => null,
                'children_folders' => [],
                'children_documents' => $rootDocuments->map(function (Document $doc) {
                    return [
                        'type'              => 'document',
                        'id'                => $doc->id,
                        'title'             => $doc->title,
                        'original_filename' => $doc->original_filename,
                        'department_name'   => $doc->department?->name,
                        'owner_name'        => $doc->owner?->name ?? $doc->uploadedBy?->name,
                    ];
                })->all(),
            ];
        }

        return response()->json($rootNodes);
    }


    public function store(Request $request)
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'description'   => 'nullable|string',
            'department_id' => 'nullable|exists:departments,id',
            'parent_id'     => 'nullable|exists:folders,id',
        ]);

        $user = $request->user();

        $folder = Folder::create([
            'name'              => $data['name'],
            'description'       => $data['description'] ?? null,
            'department_id'     => $data['department_id'] ?? $user->department_id,
            'parent_id'         => $data['parent_id'] ?? null,
            'owner_id'          => $user->id,
            'original_owner_id' => $user->id,
        ]);


        // Log on the folder itself
        $location = $folder->parent_id
            ? 'subfolder of "' . ($folder->parent?->name ?? 'Unknown') . '"'
            : 'department "' . ($folder->department?->name ?? 'Unknown') . '"';

        ActivityLogger::log(
            $folder,
            'created',
            'Folder "' . $folder->name . '" created in ' . $location
        );

        // Also log on parent folder, if any
        if ($folder->parent_id) {
            if ($parent = Folder::find($folder->parent_id)) {
                ActivityLogger::log(
                    $parent,
                    'updated',
                    "Created subfolder: {$folder->name}"
                );
            }
        }

        return response()->json([
            'message' => 'Folder created',
            'folder'  => $folder->fresh(['owner', 'department']),
        ], 201);
    }

    public function show(Folder $folder)
    {
        return response()->json($folder->load(['owner', 'department']));
    }

    public function update(Request $request, Folder $folder)
    {
        $validated = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'description' => 'nullable|string',
        ]);

        $user = $request->user();

        // Same model as move/copy: super admin, same dept owner, or shared editor
        $roleName = $user->role->name ?? '';
        $isSuper  = $roleName === 'Super Admin';
        $sameDept = $folder->department_id === $user->department_id;
        $sharePerm      = $this->getFolderSharePermissionForUser($folder, $user);
        $isSharedEditor = $sharePerm === 'editor';

        if (!$isSuper && !$sameDept && !$isSharedEditor) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $originalName = $folder->name;
        $originalDescription = $folder->description;

        $folder->update($validated);

        $parts = [];

        if (array_key_exists('name', $validated) && $validated['name'] !== $originalName) {
            $parts[] = sprintf(
                'Name: "%s" → "%s"',
                $originalName ?? '',
                $validated['name'] ?? ''
            );
        }

        if (array_key_exists('description', $validated) && $validated['description'] !== $originalDescription) {
            $parts[] = 'Description changed';
        }

        $details = $parts ? implode('; ', $parts) : 'Folder updated';

        // LOG ACTIVITY with explicit user_id
        ActivityLogger::log($folder, 'updated', $details, $user->id);

        // NOTIFY OWNER IF SOMEONE ELSE UPDATED
        $owner = $folder->owner ?? null;

        if ($owner && $owner->id !== $user->id) {
            $itemType   = 'folder';
            $itemName   = $folder->name ?? 'Untitled folder';
            $changeType = 'updated'; // later: refine based on $parts, e.g. "renamed"

            $owner->notify(new ItemUpdatedNotification(
                $itemType,
                $itemName,
                $changeType,
                $user->name ?? 'Someone',
                $folder->id
            ));
        }

        return response()->json([
            'message' => 'Folder updated',
            'folder'  => $folder->fresh(['owner', 'department']),
        ]);
    }

    public function trash(Request $request, Folder $folder)
    {
        $user = $request->user();

        $roleName = $user->role->name ?? '';
        $isSuper  = $roleName === 'Super Admin';
        $sameDept = $folder->department_id === $user->department_id;
        $sharePerm      = $this->getFolderSharePermissionForUser($folder, $user);
        $isSharedEditor = $sharePerm === 'editor';


        // Only super, same-dept owner, or shared editor can move to trash
        if (!$isSuper && !$sameDept && !$isSharedEditor) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        if ($folder->trashed_at) {
            return response()->json(['message' => 'Already in trash'], 200);
        }

        // Move folder + all descendants + their documents to trash
        $this->trashFolderRecursively($folder);

        ActivityLogger::log(
            $folder,
            'trashed',
            'Folder moved to trash with contents',
            $user->id
        );

        return response()->json([
            'message' => 'Folder moved to trash',
            'folder'  => $folder->fresh(['owner', 'department']),
        ]);
    }

    public function restore(Request $request, Folder $folder)
    {
        $user = $request->user();

        $roleName = $user->role->name ?? '';
        $isSuper  = $roleName === 'Super Admin';
        Log::info('FOLDER RESTORE DEBUG', [
            'user_id'   => $user->id,
            'role_name' => $roleName,
            'is_super'  => $isSuper,
        ]);
        $sameDept = $folder->department_id === $user->department_id;
        $sharePerm      = $this->getFolderSharePermissionForUser($folder, $user);
        $isSharedEditor = $sharePerm === 'editor';


        // Same permissions as trash/delete
        if (!$isSuper && !$sameDept && !$isSharedEditor) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        if (!$folder->trashed_at) {
            return response()->json(['message' => 'Not in trash'], 200);
        }

        // Restore folder + all descendants + their documents
        $this->restoreFolderRecursively($folder);

        ActivityLogger::log(
            $folder,
            'restored',
            'Folder restored from trash',
            $user->id
        );

        return response()->json([
            'message' => 'Folder restored',
            'folder'  => $folder->fresh(['owner', 'department']),
        ]);
    }

    public function destroy(Request $request, Folder $folder)
    {
        $user = $request->user();

        $roleName = $user->role->name ?? '';
        $isSuper  = $roleName === 'Super Admin';
        $sameDept = $folder->department_id === $user->department_id;
        $sharePerm      = $this->getFolderSharePermissionForUser($folder, $user);
        $isSharedEditor = $sharePerm === 'editor';


        // Only super, same-dept owner, or shared editor can delete
        if (!$isSuper && !$sameDept && !$isSharedEditor) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // log on the folder being deleted
        ActivityLogger::log($folder, 'deleted', 'Folder deleted');


        // also log on parent folder if any
        if ($folder->parent_id) {
            if ($parent = Folder::find($folder->parent_id)) {
                ActivityLogger::log(
                    $parent,
                    'updated',
                    "Deleted subfolder: {$folder->name}"
                );
            }
        }

        $this->deleteFolderRecursively($folder);

        return response()->json([
            'message' => 'Folder and its contents deleted',
        ]);
    }

    protected function deleteFolderRecursively(Folder $folder): void
    {
        $folder->load(['children', 'documents']);

        foreach ($folder->children as $child) {
            $this->deleteFolderRecursively($child);
        }

        foreach ($folder->documents as $document) {
            $document->delete();
        }

        $folder->delete();
    }

    protected function trashFolderRecursively(Folder $folder): void
    {
        $folder->load(['children', 'documents']);

        // Trash this folder
        if (!$folder->trashed_at) {
            $folder->trashed_at = now();
            $folder->save();

            ActivityLogger::log(
                $folder,
                'trashed',
                'Folder moved to trash with parent'
            );
        }

        // Trash documents in this folder
        foreach ($folder->documents as $document) {
            if (!$document->trashed_at) {
                $document->trashed_at = now();
                $document->save();
                ActivityLogger::log(
                    $document,
                    'trashed',
                    'Document moved to trash with folder'
                );
            }
        }

        // Recurse into children
        foreach ($folder->children as $child) {
            $this->trashFolderRecursively($child);
        }
    }


    protected function restoreFolderRecursively(Folder $folder): void
    {
        $folder->load(['children', 'documents']);

        // Restore this folder
        if ($folder->trashed_at) {
            $folder->trashed_at = null;
            $folder->save();

            ActivityLogger::log(
                $folder,
                'restored',
                'Folder restored with parent'
            );
        }

        // Restore documents in this folder
        foreach ($folder->documents as $document) {
            if ($document->trashed_at) {
                $document->trashed_at = null;
                $document->save();
                ActivityLogger::log(
                    $document,
                    'restored',
                    'Document restored with folder'
                );
            }
        }

        // Recurse into children
        foreach ($folder->children as $child) {
            $this->restoreFolderRecursively($child);
        }
    }

    public function download(Folder $folder)
    {
        try {
            $allFolderIds = [$folder->id];
            $queue        = [$folder->id];

            while (!empty($queue)) {
                $childIds = Folder::whereIn('parent_id', $queue)->pluck('id')->toArray();
                if (empty($childIds)) {
                    break;
                }
                $allFolderIds = array_merge($allFolderIds, $childIds);
                $queue        = $childIds;
            }

            // Only include non-trashed documents in the ZIP
            $documents = Document::whereNull('trashed_at')
                ->whereIn('folder_id', $allFolderIds)
                ->get();

            if ($documents->isEmpty()) {
                return response()->json(['error' => 'No files in this folder'], 404);
            }

            $tempDir = storage_path('app/temp');
            if (!file_exists($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            $zipFileName = preg_replace('/[^A-Za-z0-9_\-]/', '_', $folder->name) . '_' . time() . '.zip';
            $zipPath     = $tempDir . '/' . $zipFileName;

            $zip    = new ZipArchive();
            $result = $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

            if ($result !== true) {
                Log::error('Failed to create zip', ['folder' => $folder->id, 'path' => $zipPath]);
                return response()->json(['error' => 'Failed to create zip file'], 500);
            }

            $disk       = Storage::disk('fildas_docs');
            $addedCount = 0;

            foreach ($documents as $doc) {
                if (!$disk->exists($doc->file_path)) {
                    Log::warning('File not found', ['doc_id' => $doc->id, 'path' => $doc->file_path]);
                    continue;
                }

                $fullPath = $disk->path($doc->file_path);

                $docFolder   = Folder::find($doc->folder_id);
                $folderChain = [];

                while ($docFolder && $docFolder->id !== $folder->id) {
                    array_unshift($folderChain, $docFolder->name);
                    $docFolder = $docFolder->parent_id ? Folder::find($docFolder->parent_id) : null;
                }

                $relativePath = !empty($folderChain)
                    ? implode('/', $folderChain) . '/' . $doc->original_filename
                    : $doc->original_filename;

                $zip->addFile($fullPath, $relativePath);
                $addedCount++;
            }

            $zip->close();

            if ($addedCount === 0) {
                @unlink($zipPath);
                return response()->json(['error' => 'No accessible files found'], 404);
            }

            ActivityLogger::log($folder, 'downloaded');

            return response()
                ->download($zipPath, $folder->name . '.zip')
                ->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            Log::error('Folder download failed', [
                'folder_id' => $folder->id,
                'error'     => $e->getMessage(),
                'trace'     => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error'   => 'Failed to download folder',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    protected function getFolderSharePermissionForUser(Folder $folder, $user): ?string
    {
        // 1) Direct share on this folder
        $direct = Share::where('target_user_id', $user->id)
            ->where('folder_id', $folder->id)
            ->value('permission');

        if ($direct) {
            return $direct;
        }

        // 2) Inherited from ancestor folders
        $parentId = $folder->parent_id;
        while ($parentId) {
            $perm = Share::where('target_user_id', $user->id)
                ->where('folder_id', $parentId)
                ->value('permission');

            if ($perm) {
                return $perm;
            }

            $parent = Folder::find($parentId);
            $parentId = $parent?->parent_id;
        }

        return null;
    }

    public function move(Request $request, Folder $folder)
    {
        $user = $request->user();

        $data = $request->validate([
            'target_folder_id'     => 'nullable|exists:folders,id',
            'target_department_id' => 'nullable|exists:departments,id',
        ]);

        $roleName = $user->role->name ?? '';
        $isSuper  = $roleName === 'Super Admin';
        $sameDept = $folder->department_id === $user->department_id;
        $sharePerm      = $this->getFolderSharePermissionForUser($folder, $user);
        $isSharedEditor = $sharePerm === 'editor';


        // Must be super admin, owner in same dept, or shared editor
        if (!$isSuper && !$sameDept && !$isSharedEditor) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $targetFolder = null;
        $newDeptId    = $folder->department_id;

        if (!empty($data['target_folder_id'])) {
            $targetFolder = Folder::findOrFail($data['target_folder_id']);
            $newDeptId    = $targetFolder->department_id;
        } elseif (!empty($data['target_department_id'])) {
            $newDeptId = (int) $data['target_department_id'];
        }

        // Non‑super cannot move a folder into another department
        if (!$isSuper && $newDeptId !== $folder->department_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        DB::transaction(function () use ($folder, $targetFolder, $newDeptId, $isSuper) {
            $oldDeptId = $folder->department_id;

            $folder->parent_id = $targetFolder?->id;
            if ($isSuper) {
                $folder->department_id = $newDeptId;
            }
            $folder->save();

            if ($isSuper && $newDeptId !== $oldDeptId) {
                $this->cascadeFolderDepartment($folder, $newDeptId);
            }
        });

        $oldDeptId = $folder->getOriginal('department_id');

        $details = $targetFolder
            ? 'Moved to folder "' . $targetFolder->name . '"'
            : 'Moved to department root';

        if ($isSuper && $newDeptId !== $oldDeptId) {
            $details .= sprintf(' (Department: %d → %d)', $oldDeptId, $newDeptId);
        }

        ActivityLogger::log($folder, 'updated', $details, $user->id);


        // log on the new parent folder, if any
        if ($targetFolder) {
            ActivityLogger::log(
                $targetFolder,
                'updated',
                "Folder moved here: {$folder->name}"
            );
        }

        return response()->json([
            'message' => 'Folder moved',
            'folder'  => $folder->fresh(),
        ]);
    }

    public function copy(Request $request, Folder $folder)
    {
        $user = $request->user();

        $data = $request->validate([
            'target_folder_id' => 'nullable|exists:folders,id',
        ]);

        $roleName = $user->role->name ?? '';
        $isSuper  = $roleName === 'Super Admin';
        $sameDept = $folder->department_id === $user->department_id;
        $sharePerm      = $this->getFolderSharePermissionForUser($folder, $user);
        $isSharedEditor = $sharePerm === 'editor';


        if (!$isSuper && !$sameDept && !$isSharedEditor) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $targetFolder = null;
        if (!empty($data['target_folder_id'])) {
            $targetFolder = Folder::findOrFail($data['target_folder_id']);
        }

        $deptId = $targetFolder
            ? $targetFolder->department_id
            : ($user->department_id ?? $folder->department_id);

        // Viewer + Editor can copy TO their own department
        if (!$isSuper && $deptId !== $user->department_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }


        $newRoot = null;

        DB::transaction(function () use ($folder, $targetFolder, $deptId, $user, &$newRoot) {
            $newRoot = $this->cloneFolderTree($folder, $targetFolder, $deptId, $user->id);
        });

        if (!$newRoot) {
            return response()->json(['error' => 'Failed to copy folder'], 500);
        }

        // log on the new copied folder itself
        ActivityLogger::log(
            $newRoot,
            'created',
            'Folder copied from: ' . $folder->name
        );

        // log on the target parent folder, if any
        if ($newRoot->parent_id) {
            $parent = Folder::find($newRoot->parent_id);
            if ($parent) {
                ActivityLogger::log(
                    $parent,
                    'updated',
                    'Copied subfolder into this folder: ' . $newRoot->name
                );
            }
        }

        return response()->json([
            'message' => 'Folder copied',
            'folder'  => $newRoot,
        ]);
    }

    protected function cascadeFolderDepartment(Folder $root, int $newDeptId): void
    {
        $queue = [$root->id];

        while (!empty($queue)) {
            $children = Folder::whereIn('parent_id', $queue)->get();
            if ($children->isEmpty()) {
                break;
            }

            $childIds = $children->pluck('id')->all();

            Folder::whereIn('id', $childIds)->update(['department_id' => $newDeptId]);
            Document::whereIn('folder_id', $childIds)->update(['department_id' => $newDeptId]);

            $queue = $childIds;
        }

        Document::where('folder_id', $root->id)->update(['department_id' => $newDeptId]);
    }

    protected function cloneFolderTree(Folder $source, ?Folder $targetParent, int $deptId, int $newOwnerId): Folder
    {
        $copy = Folder::create([
            'name'              => $source->name,
            'description'       => $source->description,
            'parent_id'         => $targetParent?->id,
            'department_id'     => $deptId,
            'owner_id'          => $newOwnerId,
            'original_owner_id' => $source->original_owner_id ?? $source->owner_id ?? $newOwnerId,
        ]);

        $source->loadMissing('documents');
        foreach ($source->documents as $doc) {
            Document::create([
                'title'             => $doc->title,
                'description'       => $doc->description,
                'file_path'         => $doc->file_path,
                'original_filename' => $doc->original_filename,
                'mime_type'         => $doc->mime_type,
                'size_bytes'        => $doc->size_bytes,
                'department_id'     => $deptId,
                'folder_id'         => $copy->id,
                'document_type_id'  => $doc->document_type_id,
                'uploaded_by'       => $newOwnerId,
                'owner_id'          => $newOwnerId,
                'original_owner_id' => $doc->original_owner_id ?? $doc->owner_id ?? $newOwnerId,
                'uploaded_at'       => now(),
            ]);
        }

        $source->loadMissing('children');
        foreach ($source->children as $child) {
            $this->cloneFolderTree($child, $copy, $deptId, $newOwnerId);
        }

        return $copy;
    }

    public function activity(Folder $folder)
    {
        $activities = $folder->activities()
            ->with('user:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function (Activity $a) {
                return [
                    'id'        => $a->id,
                    'action'    => $a->action,
                    'details'   => $a->details,
                    'created_at' => $a->created_at,
                    'user'      => $a->user ? [
                        'id'    => $a->user->id,
                        'name'  => $a->user->name,
                        'email' => $a->user->email,
                    ] : null,
                ];
            });

        return response()->json($activities);
    }
}
