<?php

namespace App\Events;

use App\Models\User;
use App\Support\RealtimeChannels;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Queue\SerializesModels;

class NotificationCreated implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    /**
     * @param  array<string, mixed>  $notificationPayload
     */
    public function __construct(
        public readonly DatabaseNotification $notification,
        public readonly User $recipient,
        private readonly array $notificationPayload,
    ) {}

    public function broadcastAs(): string
    {
        return 'notification.created';
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [RealtimeChannels::user($this->recipient->id)];
    }

    /**
     * @return array{notification: array<string, mixed>}
     */
    public function broadcastWith(): array
    {
        return ['notification' => $this->notificationPayload];
    }
}
