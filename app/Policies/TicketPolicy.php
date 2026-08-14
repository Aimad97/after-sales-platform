<?php

namespace App\Policies;

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class TicketPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->staffCan($user, 'tickets.view');
    }

    public function view(User $user, Ticket $ticket): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $this->staffCan($user, 'tickets.create');
    }

    public function update(User $user, Ticket $ticket): bool
    {
        return $this->staffCan($user, 'tickets.update');
    }

    public function assign(User $user, Ticket $ticket): bool
    {
        return $this->staffCan($user, 'tickets.assign');
    }

    public function transition(User $user, Ticket $ticket): bool
    {
        return $this->staffCan($user, 'tickets.update');
    }

    public function cancel(User $user, Ticket $ticket): bool
    {
        return $this->staffCan($user, 'tickets.close');
    }

    public function viewPortal(User $user, Ticket $ticket): Response
    {
        return $user->belongsToClient($ticket->client_id)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function createPortal(User $user): bool
    {
        return $user->hasClientPortalAccess();
    }

    private function staffCan(User $user, string $permission): bool
    {
        return $user->can($permission) && ! $user->hasRole('client');
    }
}
