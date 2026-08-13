<?php

namespace App\Listeners;

use App\Events\NotificationCreated;
use App\Models\User;
use App\Notifications\DatabaseSavNotification;
use App\Services\RealtimePayloadService;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Events\NotificationSent;

class BroadcastDatabaseNotification
{
    public function __construct(private readonly RealtimePayloadService $payloads) {}

    public function handle(NotificationSent $event): void
    {
        if (
            $event->channel !== 'database'
            || ! $event->notifiable instanceof User
            || ! $event->notification instanceof DatabaseSavNotification
            || ! $event->response instanceof DatabaseNotification
        ) {
            return;
        }

        NotificationCreated::dispatch(
            $event->response,
            $event->notifiable,
            $this->payloads->notification($event->response),
        );
    }
}
