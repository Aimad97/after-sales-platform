<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class CatalogPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->staffCan($user, 'products.view');
    }

    public function view(User $user, Model $catalogItem): bool
    {
        return $this->staffCan($user, 'products.view');
    }

    public function create(User $user): bool
    {
        return $this->staffCan($user, 'products.create');
    }

    public function update(User $user, Model $catalogItem): bool
    {
        return $this->staffCan($user, 'products.update');
    }

    public function delete(User $user, Model $catalogItem): bool
    {
        return $this->staffCan($user, 'products.delete');
    }

    private function staffCan(User $user, string $permission): bool
    {
        return ! $user->hasRole('client') && $user->can($permission);
    }
}
