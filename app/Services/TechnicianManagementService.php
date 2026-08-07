<?php

namespace App\Services;

use App\Models\Technician;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TechnicianManagementService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Technician>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'created_at';
        $direction = $filters['direction'] ?? 'desc';

        return Technician::query()
            ->with(['user.roles'])
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('employee_code', 'like', "%{$term}%")
                        ->orWhere('specialization', 'like', "%{$term}%")
                        ->orWhereHas('user', function ($query) use ($term): void {
                            $query->where('first_name', 'like', "%{$term}%")
                                ->orWhere('last_name', 'like', "%{$term}%")
                                ->orWhere('email', 'like', "%{$term}%");
                        });
                });
            })
            ->when($filters['availability_status'] ?? null, fn ($query, string $status) => $query->where('availability_status', $status))
            ->when($filters['skill_level'] ?? null, fn ($query, int $level) => $query->where('skill_level', $level))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Technician
    {
        return DB::transaction(function () use ($data): Technician {
            $user = User::query()->findOrFail($data['user_id']);
            $this->ensureTechnicianRole($user);

            $existing = Technician::withTrashed()->where('user_id', $user->id)->first();

            if ($existing !== null && ! $existing->trashed()) {
                throw ValidationException::withMessages([
                    'user_id' => 'This user already has a technician profile.',
                ]);
            }

            if ($existing !== null) {
                $existing->restore();
                $existing->fill(Arr::except($data, ['user_id']))->save();

                return $existing->load(['user.roles']);
            }

            return Technician::query()->create($data)->load(['user.roles']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Technician $technician, array $data): Technician
    {
        $technician->fill($data)->save();

        return $technician->load(['user.roles']);
    }

    public function delete(Technician $technician): void
    {
        $technician->delete();
    }

    private function ensureTechnicianRole(User $user): void
    {
        if (! $user->hasRole('technician')) {
            throw ValidationException::withMessages([
                'user_id' => 'The selected user must have the technician role.',
            ]);
        }
    }
}
