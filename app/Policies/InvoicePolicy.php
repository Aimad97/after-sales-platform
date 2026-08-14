<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $this->staffCan($user, 'invoices.view');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $this->staffCan($user, 'invoices.view');
    }

    public function create(User $user): bool
    {
        return $this->staffCan($user, 'invoices.create');
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $this->staffCan($user, 'invoices.update');
    }

    private function staffCan(User $user, string $permission): bool
    {
        return ! $user->hasRole('client') && $user->can($permission);
    }
}
