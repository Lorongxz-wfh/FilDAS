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

class FolderController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = Folder::query();

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->has('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        if (!$user->isAdmin()) {
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
            'name'          => $data['name'],
            'description'   => $data['description'] ?? null,
            'department_id' => $data['department_id'] ?? $user->department_id,
            'parent_id'     => $data['parent_id'] ?? null,
            'owner_id'      => $user->id,
        ]);

        // Log on the folder itself
        ActivityLogger::log($folder, 'created', 'Folder created via form');

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

        $folder->update($validated);

        ActivityLogger::log($folder, 'updated', 'Name or description changed');

        return response()->json([
            'message' => 'Folder updated',
            'folder'  => $folder->fresh(['owner', 'department']),
        ]);
    }

    public function destroy(Folder $folder)
    {
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

            $documents = Document::whereIn('folder_id', $allFolderIds)->get();

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

    public function move(Request $request, Folder $folder)
    {
        $user = $request->user();

        $data = $request->validate([
            'target_folder_id'     => 'nullable|exists:folders,id',
            'target_department_id' => 'nullable|exists:departments,id',
        ]);

        $isSuper  = $user->isAdmin() && $user->role?->name === 'super_admin';
        $sameDept = $folder->department_id === $user->department_id;

        if (!$isSuper && !$sameDept) {
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

        $details = $targetFolder
            ? "Moved to folder: {$targetFolder->name}"
            : 'Moved to department root';

        // log on the folder itself
        ActivityLogger::log($folder, 'updated', $details);

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

    public function copy(Request $request, Folder $folder)
    {
        $user = $request->user();

        $data = $request->validate([
            'target_folder_id' => 'nullable|exists:folders,id',
        ]);

        $targetFolder = null;
        if (!empty($data['target_folder_id'])) {
            $targetFolder = Folder::findOrFail($data['target_folder_id']);
        }

        $deptId = $targetFolder
            ? $targetFolder->department_id
            : ($user->department_id ?? $folder->department_id);

        $newRoot = null;

        DB::transaction(function () use ($folder, $targetFolder, $deptId, $user, &$newRoot) {
            $newRoot = $this->cloneFolderTree($folder, $targetFolder, $deptId, $user->id);
        });

        // NEW: guard so analyser knows $newRoot is not null
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
