<?php
// app/Http/Controllers/DocumentController.php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = Document::query();

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->filled('folder_id')) {
            $query->where('folder_id', $request->folder_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('original_filename', 'like', "%{$search}%");
            });
        }

        $documents = $query->orderByDesc('uploaded_at')->get();

        return response()->json($documents);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title'         => 'required|string|max:255',
            'description'   => 'nullable|string',
            'department_id' => 'required|exists:departments,id',
            'file'          => 'required|file|max:51200',
            'folder_id'     => 'nullable|exists:folders,id',
        ]);

        if (!$request->hasFile('file')) {
            return response()->json([
                'message' => 'No file uploaded',
            ], 400);
        }

        $file = $request->file('file');

        $originalName = $file->getClientOriginalName();
        $extension    = $file->getClientOriginalExtension();
        $filename     = Str::slug(pathinfo($originalName, PATHINFO_FILENAME))
            . '-' . time()
            . '.' . $extension;

        // store in Windows folder via fildas_docs disk
        $path = $file->storeAs('documents', $filename, 'fildas_docs');

        $document = Document::create([
            'title'             => $request->title,
            'description'       => $request->description,
            'file_path'         => $path,
            'original_filename' => $originalName,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
            'department_id'     => $request->department_id,
            'uploaded_by'       => Auth::id(),
            'uploaded_at'       => now(),
            'document_type_id'  => 1,
            'folder_id'         => $request->folder_id,
        ]);

        return response()->json([
            'message'  => 'Document uploaded successfully',
            'document' => $document->load(['department', 'uploader']),
        ], 201);
    }

    public function show(Document $document)
    {
        return response()->json($document->load(['department', 'uploader']));
    }

    public function update(Request $request, Document $document)
    {
        $request->validate([
            'title'         => 'sometimes|required|string|max:255',
            'description'   => 'nullable|string',
            'department_id' => 'sometimes|required|exists:departments,id',
            'folder_id'     => 'nullable|exists:folders,id',
        ]);

        $document->update($request->only(['title', 'description', 'department_id', 'folder_id']));

        return response()->json([
            'message'  => 'Document updated successfully',
            'document' => $document->load(['department', 'uploader']),
        ]);
    }

    public function download(Document $document)
    {
        $disk = Storage::disk('fildas_docs');

        if (!$disk->exists($document->file_path)) {
            return response()->json([
                'message' => 'File not found',
            ], 404);
        }

        $absolutePath = $disk->path($document->file_path);

        return response()->download($absolutePath, $document->original_filename);
    }

    public function destroy(Document $document)
    {
        $disk = Storage::disk('fildas_docs');

        if ($disk->exists($document->file_path)) {
            $disk->delete($document->file_path);
        }

        $document->delete(); // soft delete row

        return response()->json([
            'message' => 'Document deleted successfully',
        ]);
    }

    public function statistics()
    {
        $totalDocuments  = Document::count();
        $totalSize       = Document::sum('size_bytes');
        $departmentStats = Document::selectRaw('department_id, count(*) as count, sum(size_bytes) as total_size')
            ->groupBy('department_id')
            ->with('department:id,name')
            ->get();

        return response()->json([
            'total_documents'      => $totalDocuments,
            'total_size_bytes'     => $totalSize,
            'total_size_formatted' => $this->formatBytes($totalSize),
            'by_department'        => $departmentStats,
        ]);
    }

    public function stream(Document $document)
    {
        $disk = Storage::disk('fildas_docs');
        $path = $document->file_path;

        if (!$path || !$disk->exists($path)) {
            abort(404);
        }

        $absolutePath = $disk->path($path);

        // Use PHP's mime_content_type instead of $disk->mimeType()
        $mime = mime_content_type($absolutePath) ?: 'application/octet-stream';

        if (str_starts_with($mime, 'image/') || $mime === 'application/pdf') {
            return response()->file($absolutePath, [
                'Content-Type'        => $mime,
                'Content-Disposition' => 'inline; filename="' . $document->original_filename . '"',
            ]);
        }

        return response()->download($absolutePath, $document->original_filename);
    }


    private function formatBytes($bytes)
    {
        $units = ['B', 'KB', 'MB', 'GB'];

        $i = 0;
        while ($bytes > 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }
}
