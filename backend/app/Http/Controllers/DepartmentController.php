<?php
// app/Http/Controllers/DepartmentController.php

namespace App\Http\Controllers;

use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index()
    {
        $departments = Department::withCount('documents')->get();
        return response()->json($departments);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|max:255',
            'code'        => 'required|string|max:50|unique:departments',
            'description' => 'nullable|string',
        ]);

        $department = Department::create($request->only(['name', 'code', 'description']));

        return response()->json([
            'message'    => 'Department created successfully',
            'department' => $department,
        ], 201);
    }

    public function show(Department $department)
    {
        return response()->json($department->loadCount('documents'));
    }

    public function update(Request $request, Department $department)
    {
        $request->validate([
            'name'        => 'sometimes|required|string|max:255',
            'code'        => 'sometimes|required|string|max:50|unique:departments,code,' . $department->id,
            'description' => 'nullable|string',
        ]);

        $department->update($request->only(['name', 'code', 'description']));

        return response()->json([
            'message'    => 'Department updated successfully',
            'department' => $department,
        ]);
    }

    public function destroy(Department $department)
    {
        $department->delete(); // soft delete

        return response()->json([
            'message' => 'Department deleted successfully',
        ]);
    }
}
