<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Notifications\IndexNotificationsRequest;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(IndexNotificationsRequest $request)
    {
        $notifications = $request->user()
            ->notifications()
            ->when(
                $request->has('unread'),
                fn ($query) => $request->boolean('unread')
                    ? $query->whereNull('read_at')
                    : $query,
            )
            ->latest()
            ->paginate((int) ($request->validated('per_page') ?? 20))
            ->withQueryString();

        return NotificationResource::collection($notifications);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'count' => $request->user()->unreadNotifications()->count(),
            ],
        ]);
    }

    public function markAsRead(Request $request, string $notification): JsonResponse
    {
        /** @var DatabaseNotification $databaseNotification */
        $databaseNotification = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();

        $databaseNotification->markAsRead();

        return response()->json([
            'data' => new NotificationResource($databaseNotification->fresh()),
        ]);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $updated = $request->user()
            ->unreadNotifications()
            ->update(['read_at' => now()]);

        return response()->json([
            'data' => [
                'marked_as_read' => $updated,
            ],
        ]);
    }
}
