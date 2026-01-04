<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Activity;
use App\Helpers\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;


class DepartmentController extends Controller
{
    public function index(Request $request)
    {
        $departments = Department::with(['owner', 'type'])->get();

        return response()->json(['data' => $departments]);
    }


    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:255|unique:departments,name',
            'code'               => 'nullable|string|max:255|unique:departments,code',
            'description'        => 'nullable|string',
            'department_type_id' => 'nullable|exists:department_types,id',
            'owner_id'           => 'nullable|exists:users,id',
            'theme_color'        => 'nullable|string|max:20',
            'is_active'          => 'sometimes|boolean',
            'is_qa'              => 'sometimes|boolean',
        ]);

        // Normalize empty code to null so it doesn't violate unique index accidentally
        if (array_key_exists('code', $validated) && $validated['code'] === '') {
            $validated['code'] = null;
        }

        $department = Department::create($validated);

        // AUDIT
        ActivityLogger::log(
            $department,
            'created',
            'Department created: ' . $department->name
        );

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
            'name'               => 'sometimes|required|string|max:255|unique:departments,name,' . $id,
            'code'               => 'sometimes|nullable|string|max:255|unique:departments,code,' . $id,
            'description'        => 'sometimes|nullable|string',
            'department_type_id' => 'sometimes|nullable|exists:department_types,id',
            'owner_id'           => 'sometimes|nullable|exists:users,id',
            'theme_color'        => 'sometimes|nullable|string|max:20',
            'is_active'          => 'sometimes|boolean',
            'is_qa'              => 'sometimes|boolean',
        ]);




        if (array_key_exists('code', $validated) && $validated['code'] === '') {
            $validated['code'] = null;
        }

        $department->update($validated);

        // AUDIT
        ActivityLogger::log(
            $department,
            'updated',
            'Department updated: ' . $department->name
        );

        return response()->json(['department' => $department]);
    }

    public function uploadLogo(Request $request, $id)
    {
        $department = Department::findOrFail($id);

        $validated = $request->validate([
            'logo' => 'required|image|max:2048', // ~2MB
        ]);

        $file = $validated['logo'];

        // Delete old logo if any
        if ($department->logo_path) {
            Storage::disk('fildas_assets')->delete($department->logo_path);
        }

        $path = $file->store('department-logos', 'fildas_assets');

        $department->logo_path = $path;
        $department->save();

        // AUDIT
        ActivityLogger::log(
            $department,
            'updated',
            'Department logo updated'
        );

        return response()->json([
            'department' => $department->fresh(['owner', 'type']),
        ]);
    }



    public function destroy($id)
    {
        $department = Department::findOrFail($id);
        $name = $department->name;

        $department->delete();

        // AUDIT
        ActivityLogger::log(
            $department,
            'deleted',
            'Department deleted: ' . $name
        );

        return response()->json(['message' => 'Department deleted']);
    }

    public function activity(Department $department)
    {
        $activities = Activity::where('subject_type', Department::class)
            ->where('subject_id', $department->id)
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
