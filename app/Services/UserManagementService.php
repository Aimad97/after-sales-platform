<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class UserManagementService
{
    /** @var list<string> */
    private const PRIVILEGED_ROLES = ['super_admin', 'admin'];

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, User>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'created_at';
        $direction = $filters['direction'] ?? 'desc';

        return User::query()
            ->with(['roles.permissions', 'technician'])
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('first_name', 'like', "%{$term}%")
                        ->orWhere('last_name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%")
                        ->orWhere('phone', 'like', "%{$term}%");
                });
            })
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['role'] ?? null, fn ($query, string $role) => $query->whereHas('roles', fn ($query) => $query->where('name', $role)))
            ->when(
                array_key_exists('technician', $filters),
                fn ($query) => $filters['technician'] ? $query->whereHas('technician') : $query->whereDoesntHave('technician'),
            )
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $actor, array $data): User
    {
        return DB::transaction(function () use ($actor, $data): User {
            $roles = Arr::pull($data, 'roles', []);
            unset($data['password_confirmation']);

            $this->ensureRolesAreAssignable($actor, $roles);

            $data['uuid'] = (string) Str::uuid();
            $data['email'] = Str::lower((string) $data['email']);

            $user = User::query()->create($data);
            $user->syncRoles($roles);

            return $this->loadRelations($user);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(User $actor, User $user, array $data): User
    {
        return DB::transaction(function () use ($actor, $user, $data): User {
            $this->ensureUserIsManageable($actor, $user);

            $roles = Arr::pull($data, 'roles');
            unset($data['password_confirmation']);

            if (blank($data['password'] ?? null)) {
                unset($data['password']);
            }

            if (array_key_exists('email', $data)) {
                $data['email'] = Str::lower((string) $data['email']);
            }

            $user->fill($data)->save();

            if ($roles !== null) {
                $this->ensureRolesAreAssignable($actor, $roles);
                $user->syncRoles($roles);
            }

            return $this->loadRelations($user);
        });
    }

    public function delete(User $actor, User $user): void
    {
        $this->ensureUserIsManageable($actor, $user);

        if ($actor->is($user)) {
            throw ValidationException::withMessages([
                'user' => 'You cannot archive your own account.',
            ]);
        }

        DB::transaction(function () use ($user): void {
            $user->forceFill(['status' => UserStatus::Archived])->save();
            $user->delete();
        });
    }

    /**
     * @param  list<string>  $roles
     */
    private function ensureRolesAreAssignable(User $actor, array $roles): void
    {
        $roles = array_values(array_unique($roles));

        if (array_intersect($roles, self::PRIVILEGED_ROLES) !== [] && ! $actor->hasRole('super_admin')) {
            throw new AuthorizationException('Only a super administrator can assign privileged roles.');
        }

        $existingRoles = Role::query()
            ->where('guard_name', 'web')
            ->whereIn('name', $roles)
            ->count();

        if ($existingRoles !== count($roles)) {
            throw ValidationException::withMessages([
                'roles' => 'One or more selected roles are invalid.',
            ]);
        }
    }

    private function ensureUserIsManageable(User $actor, User $user): void
    {
        if ($user->hasAnyRole(self::PRIVILEGED_ROLES) && ! $actor->hasRole('super_admin')) {
            throw new AuthorizationException('Only a super administrator can manage privileged accounts.');
        }
    }

    private function loadRelations(User $user): User
    {
        return $user->load(['roles.permissions', 'technician']);
    }
}
