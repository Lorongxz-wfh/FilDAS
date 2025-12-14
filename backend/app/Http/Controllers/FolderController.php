<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use App\Models\Document;
use Illuminate\Http\Request;

class FolderController extends Controller
{
    public function index(Request $request)
    {
        $query = Folder::query();

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->has('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        $folders = $query->orderBy('name')->get();

        return response()->json($folders);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'department_id' => 'nullable|exists:departments,id',
            'parent_id'     => 'nullable|exists:folders,id',
        ]);

        $folder = Folder::create($data);

        return response()->json([
            'message' => 'Folder created',
            'folder'  => $folder,
        ], 201);
    }

    public function show(Folder $folder)
    {
        return response()->json($folder);
    }

    public function update(Request $request, Folder $folder)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $folder->update($data);

        return response()->json([
            'message' => 'Folder updated',
            'folder'  => $folder,
        ]);
    }

    public function destroy(Folder $folder)
    {
        $this->deleteFolderRecursively($folder);

        return response()->json([
            'message' => 'Folder and its contents deleted',
        ]);
    }

    /**
     * Recursively soft-delete a folder, its subfolders, and documents.
     */
    protected function deleteFolderRecursively(Folder $folder): void
    {
        // Load relationships once
        $folder->load(['children', 'documents']);

        // Recursively delete child folders
        foreach ($folder->children as $child) {
            $this->deleteFolderRecursively($child);
        }

        // Soft delete all documents in this folder
        foreach ($folder->documents as $document) {
            $document->delete();
        }

        // Finally soft delete the folder itself
        $folder->delete();
    }
}
