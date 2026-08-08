<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductManagementService
{
    public function __construct(private readonly UniqueSlugService $slugs) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Product>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'created_at';
        $direction = $filters['direction'] ?? 'desc';

        return Product::query()
            ->with(['category', 'brand'])
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('sku', 'like', "%{$term}%")
                        ->orWhere('name', 'like', "%{$term}%")
                        ->orWhere('slug', 'like', "%{$term}%")
                        ->orWhere('model', 'like', "%{$term}%");
                });
            })
            ->when($filters['category_id'] ?? null, fn ($query, int $categoryId) => $query->where('category_id', $categoryId))
            ->when($filters['brand_id'] ?? null, fn ($query, int $brandId) => $query->where('brand_id', $brandId))
            ->when(array_key_exists('active', $filters), fn ($query) => $query->where('active', $filters['active']))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Product
    {
        return DB::transaction(function () use ($data): Product {
            $data = $this->normalize($data);
            $data['uuid'] = (string) Str::uuid();

            return Product::query()->create($data)->load(['category', 'brand']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data): Product {
            $product->fill($this->normalize($data, $product))->save();

            return $product->fresh()->load(['category', 'brand']);
        });
    }

    public function delete(Product $product): void
    {
        if ($product->warranties()->exists()) {
            throw ValidationException::withMessages([
                'product' => 'This product cannot be deleted while purchase or warranty records use it.',
            ]);
        }

        DB::transaction(fn (): bool => $product->delete());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(array $data, ?Product $product = null): array
    {
        $name = trim((string) ($data['name'] ?? $product?->name));
        $requestedSlug = array_key_exists('slug', $data) ? $data['slug'] : $product?->slug;

        $data['name'] = $name;
        $data['slug'] = $this->slugs->resolve('products', $requestedSlug, $name, $product?->id);

        if (array_key_exists('sku', $data)) {
            $data['sku'] = Str::upper(trim((string) $data['sku']));
        }

        if (array_key_exists('model', $data)) {
            $data['model'] = trim((string) $data['model']);
        }

        if (array_key_exists('description', $data)) {
            $data['description'] = filled($data['description']) ? trim((string) $data['description']) : null;
        }

        return $data;
    }
}
