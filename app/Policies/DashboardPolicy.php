<?php

namespace App\Policies;

use App\Models\User;

class DashboardPolicy
{
    public function view(User $user): bool
    {
        if ($user->hasRole('client') && ! $user->hasAnyRole(['super_admin', 'admin', 'sav_agent', 'technician'])) {
            return true;
        }

        return $user->can('dashboard.view');
    }
}
