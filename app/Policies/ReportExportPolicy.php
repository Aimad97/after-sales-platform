<?php

namespace App\Policies;

use App\Models\ReportExport;
use App\Models\User;

class ReportExportPolicy
{
    public function view(User $user, ReportExport $export): bool
    {
        return $user->can('reports.view') && ! $user->hasRole('client') && (
            $export->requested_by === $user->id
            || $user->hasAnyRole(['super_admin', 'admin'])
        );
    }
}
