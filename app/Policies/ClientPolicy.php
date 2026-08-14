<?php

namespace App\Policies;

use App\Models\Client;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ClientPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->staffCan($user, 'clients.view');
    }

    public function view(User $user, Client $client): bool
    {
        return $this->staffCan($user, 'clients.view');
    }

    public function viewPortal(User $user, Client $client): Response
    {
        return $user->belongsToClient($client->id)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function create(User $user): bool
    {
        return $this->staffCan($user, 'clients.create');
    }

    public function update(User $user, Client $client): bool
    {
        return $this->staffCan($user, 'clients.update');
    }

    public function delete(User $user, Client $client): bool
    {
        return $this->staffCan($user, 'clients.delete');
    }

    private function staffCan(User $user, string $permission): bool
    {
        return ! $user->hasRole('client') && $user->can($permission);
    }
}
