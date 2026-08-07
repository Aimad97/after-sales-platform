<?php

namespace App\Policies;

use App\Models\Technician;
use App\Models\User;

class TechnicianPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('users.view');
    }

    public function view(User $user, Technician $technician): bool
    {
        return $user->can('users.view');
    }

    public function create(User $user): bool
    {
        return $user->can('users.create');
    }

    public function update(User $user, Technician $technician): bool
    {
        return $user->can('users.update');
    }

    public function delete(User $user, Technician $technician): bool
    {
        return $user->can('users.delete');
    }
}
