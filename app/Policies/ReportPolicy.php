<?php

namespace App\Policies;

use App\Models\User;

class ReportPolicy
{
    public function view(User $user): bool
    {
        return $user->can('reports.view') && ! $user->hasRole('client');
    }
}
