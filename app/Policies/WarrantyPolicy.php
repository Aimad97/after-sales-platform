<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Warranty;

class WarrantyPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('warranties.view') && ! $user->hasRole('client');
    }

    public function view(User $user, Warranty $warranty): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, Warranty $warranty): bool
    {
        return $user->can('warranties.manage') && ! $user->hasRole('client');
    }
}
