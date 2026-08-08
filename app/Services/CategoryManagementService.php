<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CategoryManagementService
{
    public function __construct(private readonly UniqueSlugService $slugs) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Category>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'name';
        $direction = $filters['direction'] ?? 'asc';

        return Category::query()
            ->withCount('products')
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('name', 'like', "%{$term}%")
                        ->orWhere('slug', 'like', "%{$term}%")
                        ->orWhere('description', 'like', "%{$term}%");
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
    public function create(array $data): Category
    {
        return DB::transaction(function () use ($data): Category {
            $data = $this->normalize($data);

            return Category::query()->create($data)->loadCount('products');
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Category $category, array $data): Category
    {
        return DB::transaction(function () use ($category, $data): Category {
            $category->fill($this->normalize($data, $category))->save();

            return $category->fresh()->loadCount('products');
        });
    }

    public function delete(Category $category): void
    {
        if ($category->products()->exists()) {
            throw ValidationException::withMessages([
                'category' => 'This category cannot be deleted while products use it.',
            ]);
        }

        DB::transaction(fn (): bool => $category->delete());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(array $data, ?Category $category = null): array
    {
        $name = trim((string) ($data['name'] ?? $category?->name));
        $requestedSlug = array_key_exists('slug', $data) ? $data['slug'] : $category?->slug;

        $data['name'] = $name;
        $data['slug'] = $this->slugs->resolve('categories', $requestedSlug, $name, $category?->id);

        if (array_key_exists('description', $data)) {
            $data['description'] = filled($data['description']) ? trim((string) $data['description']) : null;
        }

        return $data;
    }
}
