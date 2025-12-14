<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = Document::with(['folder', 'uploadedBy']);

        // Filter by department if provided
        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        // Filter by folder if provided
        if ($request->has('folder_id')) {
            $query->where('folder_id', $request->folder_id);
        }

        // Search by title, description, or original filename
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('original_filename', 'like', "%{$search}%");
            });
        }

        // Sort by uploaded_at by default
        $sortBy = $request->get('sort_by', 'uploaded_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $documents = $query->paginate($request->get('per_page', 15));

        return response()->json($documents);
    }



    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'folder_id'   => 'required|exists:folders,id',
            'file'        => 'required|file|max:51200', // 50MB max
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

        $folder = \App\Models\Folder::findOrFail($validated['folder_id']);

        $document = Document::create([
            'title'             => $validated['title'],
            'description'       => $validated['description'] ?? null,
            'folder_id'         => $validated['folder_id'],
            'department_id'     => $folder->department_id,
            'document_type_id'  => 1, // <-- set a valid default type ID here
            'file_path'         => $path,
            'original_filename' => $originalName,
            'size_bytes'        => $file->getSize(),
            'mime_type'         => $file->getMimeType(),
            'uploaded_by'       => auth()->id(),
            'uploaded_at'       => now(),
        ]);

        return response()->json($document->load(['folder', 'uploadedBy']), 201);
    }



    public function show(Document $document)
    {
        return response()->json($document->load(['folder', 'uploadedBy']));
    }

    public function update(Request $request, Document $document)
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'folder_id' => 'sometimes|exists:folders,id',
        ]);

        $document->update($validated);

        return response()->json($document->load(['folder', 'uploadedBy']));
    }

    public function destroy(Document $document)
    {
        $disk = Storage::disk('fildas_docs');

        // Delete physical file
        if ($document->file_path && $disk->exists($document->file_path)) {
            $disk->delete($document->file_path);
        }

        // Delete database record
        $document->delete();

        return response()->json(['message' => 'Document deleted successfully']);
    }

    public function stream(Document $document)
    {
        $disk = Storage::disk('fildas_docs');
        $path = $document->file_path;

        // sanitize
        $path = str_replace(['../', '..\\'], '', $path);

        if (!$path || !$disk->exists($path)) {
            abort(404, 'Document file not found');
        }

        $fullPath = $disk->path($path);

        // Get mime type
        $mimeType = $document->mime_type ?? mime_content_type($fullPath) ?? 'application/octet-stream';

        // 1) If already PDF or image -> stream inline
        if (str_starts_with($mimeType, 'image/') || $mimeType === 'application/pdf') {
            return response()->file($fullPath, [
                'Content-Type'        => $mimeType,
                'Content-Disposition' => 'inline; filename="' . $document->original_filename . '"',
            ]);
        }

        // 2) If DOC/DOCX/etc -> convert to PDF once, then stream that
        if (
            $mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // docx
            $mimeType === 'application/msword'                                                          // doc
        ) {
            // if we already have a preview PDF, reuse it
            if ($document->preview_path && $disk->exists($document->preview_path)) {
                $previewFullPath = $disk->path($document->preview_path);

                return response()->file($previewFullPath, [
                    'Content-Type'        => 'application/pdf',
                    'Content-Disposition' => 'inline; filename="' . pathinfo($document->original_filename, PATHINFO_FILENAME) . '.pdf"',
                ]);
            }

            // else generate preview
            $previewRelPath = $this->convertDocxToPdf($disk, $fullPath);
            if (!$previewRelPath || !$disk->exists($previewRelPath)) {
                abort(500, 'Failed to generate preview PDF');
            }

            // save path on document for next time
            $document->preview_path = $previewRelPath;
            $document->save();

            $previewFullPath = $disk->path($previewRelPath);

            return response()->file($previewFullPath, [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . pathinfo($document->original_filename, PATHINFO_FILENAME) . '.pdf"',
            ]);
        }

        // 3) everything else: normal download
        return response()->download($fullPath, $document->original_filename);
    }

    /**
     * Convert a DOC/DOCX file to PDF via LibreOffice and return
     * the relative path (inside fildas_docs disk) to the PDF.
     */
    protected function convertDocxToPdf($disk, string $fullInputPath): ?string
    {
        // disk root, e.g. C:\...\Documents Database
        $root = config('filesystems.disks.fildas_docs.root');

        // create previews/ directory under root
        $outputDir = $root . DIRECTORY_SEPARATOR . 'previews';
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0775, true);
        }

        // LibreOffice executable path (adjust if different)
        $soffice = '"C:\Program Files\LibreOffice\program\soffice.exe"';

        // run LibreOffice in headless mode
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

        // LibreOffice writes PDF with same base filename in $outputDir
        $baseName = pathinfo($fullInputPath, PATHINFO_FILENAME) . '.pdf';
        $pdfFullPath = $outputDir . DIRECTORY_SEPARATOR . $baseName;

        if (!file_exists($pdfFullPath)) {
            Log::error('Converted PDF not found', ['pdf' => $pdfFullPath]);
            return null;
        }

        // return relative path for Storage disk, e.g. "previews/file.pdf"
        return 'previews' . DIRECTORY_SEPARATOR . $baseName;
    }


    public function preview(Document $document)
    {
        // Preview returns metadata + stream URL
        return response()->json([
            'id' => $document->id,
            'title' => $document->title,
            'description' => $document->description,
            'original_filename' => $document->original_filename,
            'mime_type' => $document->mime_type,
            'file_size' => $document->file_size,
            'stream_url' => route('documents.stream', $document),
            'created_at' => $document->created_at,
            'updated_at' => $document->updated_at,
        ]);
    }

    public function download(Document $document)
    {
        $disk = Storage::disk('fildas_docs');
        $path = $document->file_path;

        if (!$path || !$disk->exists($path)) {
            abort(404, 'Document file not found');
        }

        $fullPath = $disk->path($path);

        return response()->download($fullPath, $document->original_filename);
    }

    public function statistics()
    {
        $stats = [
            'total_documents' => Document::count(),
            'total_size' => Document::sum('file_size'),
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
}
