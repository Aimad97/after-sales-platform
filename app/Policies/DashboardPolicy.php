<?php

namespace App\Policies;

use App\Models\User;

class DashboardPolicy
{
    public function view(User $user): bool
    {
        if ($user->hasRole('client')) {
            return $user->isClientPortalUser();
        }

        return $user->can('dashboard.view');
    }
}
