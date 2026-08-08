<?php

namespace App\Services;

use App\Models\Brand;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BrandManagementService
{
    public function __construct(private readonly UniqueSlugService $slugs) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Brand>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'name';
        $direction = $filters['direction'] ?? 'asc';

        return Brand::query()
            ->withCount('products')
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('name', 'like', "%{$term}%")
                        ->orWhere('slug', 'like', "%{$term}%");
                });
            })
            ->when(array_key_exists('active', $filters), fn ($query) => $query->where('active', $filters['active']))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Brand
    {
        return DB::transaction(function () use ($data): Brand {
            $data = $this->normalize($data);

            return Brand::query()->create($data)->loadCount('products');
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Brand $brand, array $data): Brand
    {
        return DB::transaction(function () use ($brand, $data): Brand {
            $brand->fill($this->normalize($data, $brand))->save();

            return $brand->fresh()->loadCount('products');
        });
    }

    public function delete(Brand $brand): void
    {
        if ($brand->products()->exists()) {
            throw ValidationException::withMessages([
                'brand' => 'This brand cannot be deleted while products use it.',
            ]);
        }

        DB::transaction(fn (): bool => $brand->delete());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(array $data, ?Brand $brand = null): array
    {
        $name = trim((string) ($data['name'] ?? $brand?->name));
        $requestedSlug = array_key_exists('slug', $data) ? $data['slug'] : $brand?->slug;

        $data['name'] = $name;
        $data['slug'] = $this->slugs->resolve('brands', $requestedSlug, $name, $brand?->id);

        if (array_key_exists('logo_path', $data)) {
            $data['logo_path'] = filled($data['logo_path']) ? trim((string) $data['logo_path']) : null;
        }

        return $data;
    }
}
