<?php

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;

Broadcast::channel('user.{userId}', function (User $user, int $userId): bool {
    return (int) $user->id === $userId;
}, ['guards' => ['sanctum']]);

Broadcast::channel('ticket.{ticketId}', function (User $user, int $ticketId): bool {
    $ticket = Ticket::query()->find($ticketId);

    return $ticket !== null && Gate::forUser($user)->allows('view', $ticket);
}, ['guards' => ['sanctum']]);
