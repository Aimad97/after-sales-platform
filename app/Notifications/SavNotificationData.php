<?php

namespace App\Notifications;

use App\Enums\NotificationType;

final readonly class SavNotificationData
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public NotificationType $type,
        public string $title,
        public string $message,
        public string $actionUrl,
        public array $context = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'type' => $this->type->value,
            'title' => $this->title,
            'message' => $this->message,
            'action_url' => $this->actionUrl,
            'context' => $this->context,
        ];
    }
}
