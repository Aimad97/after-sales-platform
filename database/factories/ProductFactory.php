<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $name = Str::title(fake()->words(3, true));

        return [
            'uuid' => (string) Str::uuid(),
            'sku' => 'SKU-'.Str::upper(fake()->unique()->bothify('???-#####')),
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(8)),
            'description' => fake()->optional()->paragraph(),
            'category_id' => Category::factory(),
            'brand_id' => Brand::factory(),
            'model' => Str::upper(fake()->bothify('MOD-####??')),
            'default_warranty_months' => 24,
            'serial_number_required' => true,
            'active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['active' => false]);
    }

    public function withoutSerialNumber(): static
    {
        return $this->state(fn (): array => ['serial_number_required' => false]);
    }

    public function withWarrantyMonths(int $months): static
    {
        return $this->state(fn (): array => ['default_warranty_months' => $months]);
    }
}
