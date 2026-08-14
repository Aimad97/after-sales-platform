<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Notifications\DatabaseNotification;

/** @mixin DatabaseNotification */
class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = is_array($this->data) ? $this->data : [];

        return [
            'id' => $this->id,
            'type' => $data['type'] ?? class_basename($this->type),
            'title' => $data['title'] ?? 'ServiceDesk update',
            'message' => $data['message'] ?? '',
            'action_url' => $this->actionUrl($request, $data),
            'context' => $data['context'] ?? [],
            'read_at' => $this->read_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }

    /** @param array<string, mixed> $data */
    private function actionUrl(Request $request, array $data): ?string
    {
        $user = $request->user();
        $context = is_array($data['context'] ?? null) ? $data['context'] : [];

        if ($user?->hasClientPortalAccess() && is_string($context['ticket_uuid'] ?? null)) {
            return "/client/tickets/{$context['ticket_uuid']}";
        }

        if ($user?->hasClientPortalAccess() && is_string($context['warranty_uuid'] ?? null)) {
            return "/client/products/{$context['warranty_uuid']}";
        }

        return is_string($data['action_url'] ?? null) ? $data['action_url'] : null;
    }
}
