<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $perPage = (int) $request->query('per_page', 20);
        $perPage = $perPage > 50 ? 50 : $perPage; // safety cap [web:343]

        $paginator = $user->notifications()
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        $notifications = $paginator->getCollection()->map(function ($notification) {
            return [
                'id'          => $notification->id,
                'type'        => class_basename($notification->type),
                'data'        => $notification->data,
                'read_at'     => $notification->read_at,
                'created_at'  => $notification->created_at,
            ];
        });

        $unreadCount = $user->unreadNotifications()->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => $unreadCount,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }


    public function markAsRead(Request $request, string $id)
    {
        $user = $request->user();

        $notification = $user->notifications()->where('id', $id)->firstOrFail();
        $notification->markAsRead(); // sets read_at timestamp [web:268][web:293]

        return response()->json(['success' => true]);
    }

    public function markAllAsRead(Request $request)
    {
        $user = $request->user();

        $user->unreadNotifications()->update(['read_at' => now()]); // mass update [web:268][web:293]

        return response()->json(['success' => true]);
    }
}
