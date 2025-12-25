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

class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Document::with(['folder', 'uploadedBy', 'owner']);

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

        if (!$user->isAdmin()) {
            $deptId = $user->department_id;
            $sharedDocumentIds = Share::where('target_user_id', $user->id)
                ->whereNotNull('document_id')
                ->pluck('document_id')
                ->toArray();

            $query->where(function ($q) use ($deptId, $sharedDocumentIds) {
                if ($deptId) {
                    $q->where('department_id', $deptId);
                }
                if (!empty($sharedDocumentIds)) {
                    $q->orWhereIn('id', $sharedDocumentIds);
                }
            });
        }

        $sortBy = $request->get('sort_by', 'uploaded_at');
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

        $baseFolderId = $validated['folder_id'] ?? null;
        $baseDepartmentId = null;

        if ($baseFolderId) {
            $baseFolder = Folder::findOrFail($baseFolderId);
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
                        'owner_id'      => auth()->id(),
                    ]);
                    $parentId = $newFolder->id;
                }
            }
            $targetFolderId = $parentId;
        }

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
            'uploaded_by'       => auth()->id(),
            'owner_id'          => auth()->id(),
            'uploaded_at'       => now(),
        ]);

        // LOG ACTIVITY
        ActivityLogger::log($document, 'uploaded');

        return response()->json($document->load(['folder', 'uploadedBy', 'owner']), 201);
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

        $document->update($validated);

        // LOG ACTIVITY
        ActivityLogger::log($document, 'updated', 'Title or description changed');

        return response()->json($document->load(['folder', 'uploadedBy', 'owner']));
    }

    public function destroy(Document $document)
    {
        // LOG ACTIVITY (before delete)
        ActivityLogger::log($document, 'deleted');

        $disk = Storage::disk('fildas_docs');

        if ($document->file_path && $disk->exists($document->file_path)) {
            $disk->delete($document->file_path);
        }

        $document->delete();

        return response()->json(['message' => 'Document deleted successfully']);
    }

    public function stream(Document $document)
    {
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
        $stats = [
            'total_documents'   => Document::count(),
            'total_size'        => Document::sum('size_bytes'),
            'documents_by_type' => Document::selectRaw('mime_type, COUNT(*) as count')
                ->groupBy('mime_type')
                ->get(),
            'recent_uploads' => Document::with('uploadedBy')
                ->latest()
                ->take(5)
                ->get(),
        ];

        return response()->json($stats);
    }

    public function move(Request $request, Document $document)
    {
        $user = $request->user();

        $data = $request->validate([
            'target_folder_id'     => 'nullable|exists:folders,id',
            'target_department_id' => 'nullable|exists:departments,id',
        ]);

        $isSuper = $user->isAdmin() && $user->role?->name === 'super_admin';
        $sameDept = $document->department_id === $user->department_id;

        if (!$isSuper && !$sameDept) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $targetFolder = null;
        $newDeptId = $document->department_id;

        if (!empty($data['target_folder_id'])) {
            $targetFolder = Folder::findOrFail($data['target_folder_id']);
            $newDeptId = $targetFolder->department_id;
        } elseif (!empty($data['target_department_id'])) {
            $newDeptId = (int) $data['target_department_id'];
        }

        if (!$isSuper && $newDeptId !== $document->department_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $document->folder_id = $targetFolder?->id;
        if ($isSuper) {
            $document->department_id = $newDeptId;
        }
        $document->save();

        // LOG ACTIVITY
        $details = $targetFolder ? "Moved to folder: {$targetFolder->name}" : "Moved to department root";
        ActivityLogger::log($document, 'updated', $details);

        return response()->json(['message' => 'Document moved', 'document' => $document->fresh()]);
    }

    public function copy(Request $request, Document $document)
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
            : ($user->department_id ?? $document->department_id);

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
        ]);

        return response()->json(['message' => 'Document copied', 'document' => $copy->load(['folder', 'uploadedBy', 'owner'])]);
    }

    public function activity(Document $document)
    {
        $activities = Activity::where('subject_type', Document::class)
            ->where('subject_id', $document->id)
            ->with('user:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($activities);
    }
}
