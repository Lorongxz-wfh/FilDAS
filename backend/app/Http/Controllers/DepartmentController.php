<?php

namespace App\Http\Controllers;

use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index(Request $request)
    {
        $departments = Department::all();
        return response()->json(['data' => $departments]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:departments',
        ]);

        $department = Department::create($validated);
        return response()->json(['department' => $department], 201);
    }

    public function show($id)
    {
        $department = Department::findOrFail($id);
        return response()->json(['department' => $department]);
    }

    public function update(Request $request, $id)
    {
        $department = Department::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|unique:departments,name,' . $id,
        ]);

        $department->update($validated);
        return response()->json(['department' => $department]);
    }

    public function destroy($id)
    {
        $department = Department::findOrFail($id);
        $department->delete();
        return response()->json(['message' => 'Department deleted']);
    }
}
