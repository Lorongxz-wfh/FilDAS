<?php

namespace App\Http\Controllers;

use App\Models\DepartmentType;
use Illuminate\Http\Request;

class DepartmentTypeController extends Controller
{
    public function index(Request $request)
    {
        $types = DepartmentType::orderBy('name')->get();

        return response()->json(['data' => $types]);
    }
}
