<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Folder;
use App\Models\Share;
use App\Models\Activity;
use App\Helpers\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use App\Notifications\ItemUpdatedNotification;
use Illuminate\Support\Facades\Auth;




class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = Document::with(['folder', 'uploadedBy', 'owner'])
            ->notArchived(); // exclude archived docs by default

        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }
        if ($request->has('folder_id')) {
            $query->where('folder_id', $request->folder_id);
        }
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('original_filename', 'like', "%{$search}%");
            });
        }

        // Visibility rules with status:
        // - Super Admin: all non-archived documents (any status).
        // - Admin: all non-archived documents in their own department (any status).
        // - Staff:
        //     * Always see documents they uploaded or own (any status).
        //     * In their department: only approved documents.
        //     * Shared documents: only approved documents.
        $isSuperAdmin = $user->isSuperAdmin();
        $isAdmin      = $user->isAdmin();

        if ($isSuperAdmin) {
            // No extra restriction; can see any non-archived doc.
        } elseif ($isAdmin) {
            // Department admin: all docs in their department, regardless of status.
            if ($user->department_id) {
                $query->where('department_id', $user->department_id);
            } else {
                // Admin without department sees nothing.
                $query->whereRaw('1 = 0');
            }
        } else {
            // Staff-level visibility.
            $deptId = $user->department_id;

            $sharedDocumentIds = Share::where('target_user_id', $user->id)
                ->whereNotNull('document_id')
                ->pluck('document_id')
                ->toArray();

            $query->where(function ($q) use ($user, $deptId, $sharedDocumentIds) {
                // 1) Uploader or owner: always visible, any status.
                $q->where(function ($q2) use ($user) {
                    $q2->where('uploaded_by', $user->id)
                        ->orWhere('owner_id', $user->id);
                });

                // 2) Same department, approved documents.
                if ($deptId) {
                    $q->orWhere(function ($q2) use ($deptId) {
                        $q2->where('department_id', $deptId)
                            ->where('status', 'approved');
                    });
                }

                // 3) Shared directly, approved documents.
                if (!empty($sharedDocumentIds)) {
                    $q->orWhere(function ($q2) use ($sharedDocumentIds) {
                        $q2->whereIn('id', $sharedDocumentIds)
                            ->where('status', 'approved');
                    });
                }
            });
        }


        $sortBy    = $request->get('sort_by', 'uploaded_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $documents = $query->paginate($request->get('per_page', 15));
        return response()->json($documents);
    }

    public function archiveIndex(Request $request)
    {
        $user = $request->user();

        $query = Document::with(['folder', 'uploadedBy', 'owner'])
            ->archived();

        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }
        if ($request->has('folder_id')) {
            $query->where('folder_id', $request->folder_id);
        }
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('original_filename', 'like', "%{$search}%");
            });
        }

        // Visibility:
        // - Super Admin: all archived documents.
        // - Admin: archived documents in their own department.
        // - Staff: archived documents they own or uploaded.
        $isSuperAdmin = $user->isSuperAdmin();
        $isAdmin      = $user->isAdmin();


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
            $query->where(function ($q) use ($user) {
                $q->where('owner_id', $user->id)
                    ->orWhere('uploaded_by', $user->id);
            });
        }

        $sortBy    = $request->get('sort_by', 'uploaded_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $documents = $query->paginate($request->get('per_page', 15));

        return response()->json($documents);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'         => 'required|string|max:255',
            'description'   => 'nullable|string',
            'folder_id'     => 'nullable|exists:folders,id',
            'file'          => 'required|file|max:51200',
            'relative_path' => 'nullable|string',
        ]);

        $user = $request->user();


        if (!$request->hasFile('file')) {
            return response()->json(['error' => 'No file uploaded'], 400);
        }

        $file = $request->file('file');
        $disk = Storage::disk('fildas_docs');

        $originalName   = $file->getClientOriginalName();
        $extension      = $file->getClientOriginalExtension();
        $filename       = pathinfo($originalName, PATHINFO_FILENAME);
        $uniqueFilename = $filename . '_' . time() . '.' . $extension;

        $path = $file->storeAs('', $uniqueFilename, 'fildas_docs');
        if (!$path) {
            return response()->json(['error' => 'Failed to store file'], 500);
        }

        $baseFolderId     = $validated['folder_id'] ?? null;
        $baseDepartmentId = null;

        if ($baseFolderId) {
            $baseFolder       = Folder::findOrFail($baseFolderId);
            $baseDepartmentId = $baseFolder->department_id;
        } else {
            $baseDepartmentId = $request->input('department_id');
            if (!$baseDepartmentId) {
                return response()->json(['error' => 'Department required for root upload'], 400);
            }
        }

        $targetFolderId = $baseFolderId;

        if (!empty($validated['relative_path'])) {
            $segments = array_filter(explode('/', $validated['relative_path']));
            $parentId = $baseFolderId;

            foreach ($segments as $segmentName) {
                $existing = Folder::where('name', $segmentName)
                    ->where('parent_id', $parentId)
                    ->where('department_id', $baseDepartmentId)
                    ->first();

                if ($existing) {
                    $parentId = $existing->id;
                } else {
                    $newFolder = Folder::create([
                        'name'          => $segmentName,
                        'parent_id'     => $parentId,
                        'department_id' => $baseDepartmentId,
                        'owner_id'      => $user->id,
                    ]);
                    $parentId = $newFolder->id;
                }
            }
            $targetFolderId = $parentId;
        }

        $uploaderId = $user->id;

        $document = Document::create([
            'title'             => $validated['title'],
            'description'       => $validated['description'] ?? null,
            'folder_id'         => $targetFolderId,
            'department_id'     => $baseDepartmentId,
            'document_type_id'  => 1,
            'file_path'         => $path,
            'original_filename' => $originalName,
            'size_bytes'        => $file->getSize(),
            'mime_type'         => $file->getMimeType(),
            'uploaded_by'       => $uploaderId,
            'owner_id'          => $uploaderId,
            'original_owner_id' => $uploaderId,
            'uploaded_at'       => now(),
            'status'            => 'pending',
        ]);


        $docLabel = $document->title ?: $document->original_filename;
        $location = $document->folder_id
            ? 'folder "' . ($parentFolder->name ?? 'Unknown') . '"'
            : 'department "' . ($document->department?->name ?? 'Unknown') . '"';

        // Log on the document itself
        ActivityLogger::log(
            $document,
            'uploaded',
            'Uploaded document "' . $docLabel . '" to ' . $location
        );

        // Also log on parent folder if the document is inside one
        if ($document->folder_id && ($parentFolder = Folder::find($document->folder_id))) {
            ActivityLogger::log(
                $parentFolder,
                'updated',
                'Document uploaded here: "' . $docLabel . '"'
            );
        }


        return response()->json(
            $document->load(['folder', 'uploadedBy', 'owner']),
            201
        );
    }

    public function show(Document $document)
    {
        return response()->json($document->load(['folder', 'uploadedBy', 'owner']));
    }

    public function update(Request $request, Document $document)
    {
        $validated = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'folder_id'   => 'sometimes|exists:folders,id',
            'owner_id'    => 'sometimes|nullable|exists:users,id',
        ]);

        $user = $request->user();

        // Re-evaluate live permission on every update
        $effectivePerm = $this->getEffectivePermissionForUser($document, $user);
        $isOwner =
            (int) $document->owner_id === (int) $user->id ||
            (int) $document->uploaded_by === (int) $user->id;

        // Viewers cannot modify anything
        if ($effectivePerm === 'viewer') {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Contributors can only edit documents they own
        if ($effectivePerm === 'contributor' && !$isOwner) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $originalTitle = $document->title;
        $originalDescription = $document->description;

        $document->update($validated);

        $parts = [];

        if (array_key_exists('title', $validated) && $validated['title'] !== $originalTitle) {
            $parts[] = sprintf(
                'Title: "%s" → "%s"',
                $originalTitle ?? '',
                $validated['title'] ?? ''
            );
        }

        if (array_key_exists('description', $validated) && $validated['description'] !== $originalDescription) {
            $parts[] = 'Description changed';
        }

        $details = $parts ? implode('; ', $parts) : 'Document updated';

        // LOG ACTIVITY with explicit user_id
        ActivityLogger::log($document, 'updated', $details, $user->id);

        // NOTIFY OWNER IF SOMEONE ELSE UPDATED
        $owner = $document->owner ?? $document->uploadedBy ?? null;

        if ($owner && $owner->id !== $user->id) {
            $itemType   = 'document';
            $itemName   = $document->title ?? $document->original_filename ?? 'Untitled document';

            // You can refine this later based on $parts, for now just 'updated'
            $changeType = 'updated';

            $owner->notify(new ItemUpdatedNotification(
                $itemType,
                $itemName,
                $changeType,
                $user->name ?? 'Someone',
                $document->id
            ));
        }

        return response()->json($document->load(['folder', 'uploadedBy', 'owner']));
    }

    public function archive(Request $request, Document $document)
    {
        $user = $request->user();

        $effectivePerm = $this->getEffectivePermissionForUser($document, $user);
        $isOwner =
            (int) $document->owner_id === (int) $user->id ||
            (int) $document->uploaded_by === (int) $user->id;

        // Viewers cannot archive
        if ($effectivePerm === 'viewer') {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Contributors can only archive their own documents
        if ($effectivePerm === 'contributor' && !$isOwner) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Already archived => no-op
        if ($document->archived_at) {
            return response()->json(['message' => 'Already archived'], 200);
        }

        $document->archived_at = now();
        $document->save();

        ActivityLogger::log(
            $document,
            'archived',
            'Document archived',
            $user->id
        );

        return response()->json([
            'message'  => 'Document archived',
            'document' => $document->fresh(['folder', 'uploadedBy', 'owner']),
        ]);
    }

    public function restore(Request $request, Document $document)
    {
        $user = $request->user();

        $effectivePerm = $this->getEffectivePermissionForUser($document, $user);
        $isOwner =
            (int) $document->owner_id === (int) $user->id ||
            (int) $document->uploaded_by === (int) $user->id;

        // Same permissions as archive/delete
        if ($effectivePerm === 'viewer') {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        if ($effectivePerm === 'contributor' && !$isOwner) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        if (!$document->archived_at) {
            return response()->json(['message' => 'Not archived'], 200);
        }

        $document->archived_at = null;
        $document->save();

        ActivityLogger::log(
            $document,
            'restored',
            'Document restored from archive',
            $user->id
        );

        return response()->json([
            'message'  => 'Document restored',
            'document' => $document->fresh(['folder', 'uploadedBy', 'owner']),
        ]);
    }

    public function destroy(Request $request, Document $document)
    {
        $user = $request->user();

        $effectivePerm = $this->getEffectivePermissionForUser($document, $user);
        $isOwner =
            (int) $document->owner_id === (int) $user->id ||
            (int) $document->uploaded_by === (int) $user->id;

        // Viewers cannot delete
        if ($effectivePerm === 'viewer') {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Contributors can only delete their own documents
        if ($effectivePerm === 'contributor' && !$isOwner) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // log on document itself
        ActivityLogger::log($document, 'deleted', 'Document deleted');


        // log on parent folder, if any
        if ($document->folder_id && ($parent = Folder::find($document->folder_id))) {
            ActivityLogger::log(
                $parent,
                'updated',
                'Deleted document: ' . ($document->title ?: $document->original_filename)
            );
        }

        $disk = Storage::disk('fildas_docs');

        if ($document->file_path && $disk->exists($document->file_path)) {
            $disk->delete($document->file_path);
        }

        $document->delete();

        return response()->json(['message' => 'Document deleted successfully']);
    }

    public function stream(Document $document)
    {
        // Do not allow streaming archived documents
        if ($document->archived_at) {
            abort(403, 'Document is archived');
        }

        $disk = Storage::disk('fildas_docs');
        $path = $document->file_path;

        $path = str_replace(['../', '..\\'], '', $path);

        if (!$path || !$disk->exists($path)) {
            abort(404, 'Document file not found');
        }

        $fullPath = $disk->path($path);

        $mimeType = $document->mime_type ?? mime_content_type($fullPath) ?? 'application/octet-stream';

        // Direct inline preview for images and PDFs
        if (str_starts_with($mimeType, 'image/') || $mimeType === 'application/pdf') {
            return response()->file($fullPath, [
                'Content-Type'        => $mimeType,
                'Content-Disposition' => 'inline; filename="' . $document->original_filename . '"',
            ]);
        }

        // Office -> PDF via LibreOffice
        if (
            in_array($mimeType, [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/vnd.ms-powerpoint',
            ], true)
        ) {
            if ($document->preview_path && $disk->exists($document->preview_path)) {
                $previewFullPath = $disk->path($document->preview_path);

                return response()->file($previewFullPath, [
                    'Content-Type'        => 'application/pdf',
                    'Content-Disposition' => 'inline; filename="' . pathinfo($document->original_filename, PATHINFO_FILENAME) . '.pdf"',
                ]);
            }

            $previewRelPath = $this->convertDocxToPdf($disk, $fullPath);
            if (!$previewRelPath || !$disk->exists($previewRelPath)) {
                abort(500, 'Failed to generate preview PDF');
            }

            $document->preview_path = $previewRelPath;
            $document->save();

            $previewFullPath = $disk->path($previewRelPath);

            return response()->file($previewFullPath, [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . pathinfo($document->original_filename, PATHINFO_FILENAME) . '.pdf"',
            ]);
        }

        return response()->download($fullPath, $document->original_filename);
    }

    protected function convertDocxToPdf($disk, string $fullInputPath): ?string
    {
        $root = config('filesystems.disks.fildas_docs.root');

        $outputDir = $root . DIRECTORY_SEPARATOR . 'previews';
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0775, true);
        }

        $soffice = '"C:\Program Files\LibreOffice\program\soffice.exe"';

        $cmd = $soffice
            . ' --headless --convert-to pdf --outdir '
            . escapeshellarg($outputDir) . ' '
            . escapeshellarg($fullInputPath);

        exec($cmd, $output, $exitCode);

        if ($exitCode !== 0) {
            Log::error('LibreOffice conversion failed', [
                'cmd'       => $cmd,
                'exit_code' => $exitCode,
                'output'    => $output,
            ]);
            return null;
        }

        $baseName    = pathinfo($fullInputPath, PATHINFO_FILENAME) . '.pdf';
        $pdfFullPath = $outputDir . DIRECTORY_SEPARATOR . $baseName;

        if (!file_exists($pdfFullPath)) {
            Log::error('Converted PDF not found', ['pdf' => $pdfFullPath]);
            return null;
        }

        return 'previews' . DIRECTORY_SEPARATOR . $baseName;
    }

    public function preview(Document $document)
    {
        // Only log if a user is authenticated, and use the 3-argument form
        if (Auth::check()) {
            ActivityLogger::log(
                $document,
                'viewed',
                'Document preview requested'
            );
        }

        return response()->json([
            'id'                => $document->id,
            'title'             => $document->title,
            'description'       => $document->description,
            'original_filename' => $document->original_filename,
            'mime_type'         => $document->mime_type,
            'size_bytes'        => $document->size_bytes,
            'stream_url'        => route('documents.stream', $document),
            'created_at'        => $document->created_at,
            'updated_at'        => $document->updated_at,
        ]);
    }

    public function download(Document $document)
    {
        // Do not allow downloading archived documents from normal flows
        if ($document->archived_at) {
            abort(403, 'Document is archived');
        }

        $disk = Storage::disk('fildas_docs');
        $path = $document->file_path;

        if (!$path || !$disk->exists($path)) {
            abort(404, 'Document file not found');
        }

        // LOG ACTIVITY
        ActivityLogger::log($document, 'downloaded');

        $fullPath = $disk->path($path);
        return response()->download($fullPath, $document->original_filename);
    }

    public function statistics()
    {
        $baseQuery = Document::whereNull('archived_at');

        $stats = [
            'total_documents'   => (clone $baseQuery)->count(),
            'total_size'        => (clone $baseQuery)->sum('size_bytes'),
            'documents_by_type' => (clone $baseQuery)
                ->selectRaw('mime_type, COUNT(*) as count')
                ->groupBy('mime_type')
                ->get(),
            'recent_uploads' => (clone $baseQuery)
                ->with('uploadedBy')
                ->latest()
                ->take(5)
                ->get(),
        ];

        return response()->json($stats);
    }

    protected function getDocumentSharePermissionForUser(Document $document, $user): ?string
    {
        // 1) Direct document share
        $direct = Share::where('target_user_id', $user->id)
            ->where('document_id', $document->id)
            ->value('permission');

        if ($direct) {
            return $direct; // 'viewer' or 'editor'
        }

        // 2) Inherited from ancestor folders
        $folderId = $document->folder_id;
        while ($folderId) {
            $perm = Share::where('target_user_id', $user->id)
                ->where('folder_id', $folderId)
                ->value('permission');

            if ($perm) {
                return $perm;
            }

            $folder = Folder::find($folderId);
            $folderId = $folder?->parent_id;
        }

        return null;
    }

    protected function getEffectivePermissionForUser(Document $document, $user): string
    {
        $sharePerm = $this->getDocumentSharePermissionForUser($document, $user);
        if (in_array($sharePerm, ['viewer', 'contributor', 'editor'], true)) {
            return $sharePerm;
        }

        $isSuper  = $user->isSuperAdmin();
        $sameDept = $document->department_id === $user->department_id;

        if ($isSuper) {
            return 'editor';
        }

        if ($sameDept) {
            return 'contributor';
        }


        return 'viewer';
    }


    public function move(Request $request, Document $document)
    {
        $user = $request->user();

        $data = $request->validate([
            'target_folder_id'     => 'nullable|exists:folders,id',
            'target_department_id' => 'nullable|exists:departments,id',
        ]);

        $isSuper = $user->isSuperAdmin();

        $sameDept = $document->department_id === $user->department_id;

        $sharePerm            = $this->getDocumentSharePermissionForUser($document, $user);
        $isSharedEditor       = $sharePerm === 'editor';
        $isSharedContributor  = $sharePerm === 'contributor';
        $isOwner              = (int) $document->owner_id === (int) $user->id
            || (int) $document->uploaded_by === (int) $user->id;

        Log::info('DOC MOVE DEBUG', [
            'doc_id'              => $document->id,
            'user_id'             => $user->id,
            'is_super'            => $isSuper,
            'same_dept'           => $sameDept,
            'share_perm'          => $sharePerm,
            'is_shared_edit'      => $isSharedEditor,
            'is_shared_contrib'   => $isSharedContributor,
            'is_owner'            => $isOwner,
            'doc_dept'            => $document->department_id,
            'user_dept'           => $user->department_id,
        ]);

        // Allow move if:
        // - super admin, OR
        // - same department, OR
        // - shared editor, OR
        // - shared contributor AND owner
        if (
            !$isSuper &&
            !$sameDept &&
            !$isSharedEditor &&
            !($isSharedContributor && $isOwner)
        ) {
            return response()->json(['error' => 'Forbidden'], 403);
        }


        $targetFolder = null;
        $newDeptId    = $document->department_id;

        if (!empty($data['target_folder_id'])) {
            $targetFolder = Folder::findOrFail($data['target_folder_id']);
            // For non‑super users, document department is fixed.
            $newDeptId = $targetFolder->department_id ?? $document->department_id;
        } elseif (!empty($data['target_department_id'])) {
            $newDeptId = (int) $data['target_department_id'];
        }


        // Non‑super users who are NOT shared editors cannot change the document's department.
        if (!$isSuper && !$isSharedEditor && $newDeptId !== $document->department_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $document->folder_id = $targetFolder?->id;
        if ($isSuper) {
            $document->department_id = $newDeptId;
        }
        $document->save();

        $details = $targetFolder
            ? 'Moved to folder "' . $targetFolder->name . '"'
            : 'Moved to department root';

        ActivityLogger::log($document, 'updated', $details);

        if ($targetFolder) {
            ActivityLogger::log(
                $targetFolder,
                'updated',
                'Document moved here: ' . ($document->title ?: $document->original_filename)
            );
        }

        return response()->json([
            'message'  => 'Document moved',
            'document' => $document->fresh(),
        ]);
    }

    public function copy(Request $request, Document $document)
    {
        $user = $request->user();

        $data = $request->validate([
            'target_folder_id' => 'nullable|exists:folders,id',
        ]);

        $isSuper = $user->isSuperAdmin();

        $sameDept = $document->department_id === $user->department_id;

        $sharePerm           = $this->getDocumentSharePermissionForUser($document, $user);
        $isSharedEditor      = $sharePerm === 'editor';
        $isSharedContributor = $sharePerm === 'contributor';
        $isOwner             = (int) $document->owner_id === (int) $user->id
            || (int) $document->uploaded_by === (int) $user->id;

        // Allow copy if:
        // - super admin, OR
        // - same department, OR
        // - shared editor, OR
        // - shared contributor AND owner
        if (
            !$isSuper &&
            !$sameDept &&
            !$isSharedEditor &&
            !($isSharedContributor && $isOwner)
        ) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $targetFolder = null;
        if (!empty($data['target_folder_id'])) {
            $targetFolder = Folder::findOrFail($data['target_folder_id']);
        }

        $deptId = $targetFolder
            ? $targetFolder->department_id
            : ($user->department_id ?? $document->department_id);

        // Viewer + Editor can copy TO their own department
        if (!$isSuper && $deptId !== $user->department_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $copy = Document::create([
            'title'             => $document->title,
            'description'       => $document->description,
            'file_path'         => $document->file_path,
            'original_filename' => $document->original_filename,
            'mime_type'         => $document->mime_type,
            'size_bytes'        => $document->size_bytes,
            'department_id'     => $deptId,
            'folder_id'         => $targetFolder?->id,
            'document_type_id'  => $document->document_type_id,
            'uploaded_by'       => $user->id,
            'owner_id'          => $user->id,
            'original_owner_id' => $document->original_owner_id ?? $document->owner_id ?? $user->id,
            'uploaded_at'       => now(),
            'status'            => 'pending',
        ]);

        // log on new document
        ActivityLogger::log(
            $copy,
            'created',
            'Document copied from: ' . ($document->title ?: $document->original_filename)
        );

        // log on parent folder, if any
        if ($copy->folder_id && ($parent = Folder::find($copy->folder_id))) {
            ActivityLogger::log(
                $parent,
                'updated',
                'Copied document into this folder: ' . ($copy->title ?: $copy->original_filename)
            );
        }

        return response()->json([
            'message'  => 'Document copied',
            'document' => $copy->load(['folder', 'uploadedBy', 'owner']),
        ]);
    }

    /**
     * GET /qa/approvals
     * List documents for QA (Super Admin + all QA members).
     */
    public function qaIndex(Request $request)
    {
        $user = $request->user();

        // Any QA member can see the list; only QA Admin / Super Admin can approve.
        if (!$user->isSuperAdmin() && !$user->isQa()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $status = $request->get('status', 'pending'); // pending|approved|rejected|all
        $deptId = $request->get('department_id');
        $search = $request->get('q');

        $query = Document::with(['department', 'uploadedBy', 'owner'])
            ->notArchived();

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($deptId) {
            $query->where('department_id', (int) $deptId);
        }

        if ($search) {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('title', 'like', $like)
                    ->orWhere('original_filename', 'like', $like)
                    ->orWhereHas('uploadedBy', function ($sub) use ($like) {
                        $sub->where('name', 'like', $like);
                    })
                    ->orWhereHas('department', function ($sub) use ($like) {
                        $sub->where('name', 'like', $like);
                    });
            });
        }

        $perPage = min((int) $request->get('per_page', 25), 100);

        $docs = $query
            ->orderBy('uploaded_at', 'desc')
            ->paginate($perPage);

        return response()->json($docs);
    }

    /**
     * POST /documents/{document}/approve
     */
    public function approve(Request $request, Document $document)
    {
        $user = $request->user();

        // Only Super Admin or QA Admin can approve.
        if (!$user->isSuperAdmin() && !$user->isQaAdmin()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        if ($document->archived_at) {
            return response()->json(['error' => 'Cannot approve archived document'], 400);
        }

        $document->status      = 'approved';
        $document->approved_by = $user->id;
        $document->approved_at = now();
        $document->save();

        ActivityLogger::log(
            $document,
            'approved',
            'Document approved',
            $user->id
        );

        return response()->json($document->fresh(['folder', 'uploadedBy', 'owner']));
    }

    /**
     * POST /documents/{document}/reject
     */
    public function reject(Request $request, Document $document)
    {
        $user = $request->user();

        // Only Super Admin or QA Admin can reject.
        if (!$user->isSuperAdmin() && !$user->isQaAdmin()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        if ($document->archived_at) {
            return response()->json(['error' => 'Cannot reject archived document'], 400);
        }

        $reason = $request->input('reason'); // optional for now

        $document->status      = 'rejected';
        $document->approved_by = $user->id;
        $document->approved_at = now();
        $document->save();

        $details = 'Document rejected';
        if ($reason) {
            $details .= ': ' . $reason;
        }

        ActivityLogger::log(
            $document,
            'rejected',
            $details,
            $user->id
        );

        return response()->json($document->fresh(['folder', 'uploadedBy', 'owner']));
    }

    public function activity(Document $document)
    {
        $activities = $document->activities()
            ->with('user:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function (Activity $a) {
                return [
                    'id'         => $a->id,
                    'action'     => $a->action,
                    'details'    => $a->details,
                    'created_at' => $a->created_at,
                    'user'       => $a->user ? [
                        'id'    => $a->user->id,
                        'name'  => $a->user->name,
                        'email' => $a->user->email,
                    ] : null,
                ];
            });

        return response()->json($activities);
    }
}
