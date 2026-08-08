<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class CatalogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('products.view');
    }

    public function view(User $user, Model $catalogItem): bool
    {
        return $user->can('products.view');
    }

    public function create(User $user): bool
    {
        return $user->can('products.create');
    }

    public function update(User $user, Model $catalogItem): bool
    {
        return $user->can('products.update');
    }

    public function delete(User $user, Model $catalogItem): bool
    {
        return $user->can('products.delete');
    }
}
