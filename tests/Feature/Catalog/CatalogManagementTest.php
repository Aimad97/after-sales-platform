<?php

namespace Tests\Feature\Catalog;

use App\Models\Client;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CatalogManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_an_admin_can_manage_catalog_records_and_product_relationships(): void
    {
        $admin = $this->userWithRole('admin');
        $category = $this->createCategory($admin);
        $brand = $this->createBrand($admin);

        $response = $this->actingAs($admin)->postJson('/api/products', $this->productPayload($category['id'], $brand['id']));

        $response->assertCreated()
            ->assertJsonPath('data.sku', 'WASH-100')
            ->assertJsonPath('data.slug', 'smart-washer')
            ->assertJsonPath('data.category.name', 'Home Appliances')
            ->assertJsonPath('data.brand.name', 'Atlas Tech');

        $product = Product::query()->where('sku', 'WASH-100')->firstOrFail();

        $this->assertSame($category['id'], $product->category->id);
        $this->assertSame($brand['id'], $product->brand->id);

        $this->actingAs($admin)
            ->getJson("/api/products?search=Washer&category_id={$category['id']}&brand_id={$brand['id']}&active=1&sort=sku&direction=asc&per_page=1")
            ->assertOk()
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('data.0.uuid', $product->uuid);

        $this->actingAs($admin)
            ->getJson("/api/products/{$product->uuid}")
            ->assertOk()
            ->assertJsonPath('data.category.slug', 'home-appliances')
            ->assertJsonPath('data.brand.slug', 'atlas-tech');

        $this->actingAs($admin)
            ->patchJson("/api/products/{$product->uuid}", ['sku' => 'wash-200', 'active' => false])
            ->assertOk()
            ->assertJsonPath('data.sku', 'WASH-200')
            ->assertJsonPath('data.active', false);

        $this->actingAs($admin)->deleteJson("/api/products/{$product->uuid}")
            ->assertOk()
            ->assertJsonPath('message', 'Product deleted successfully.');

        $this->actingAs($admin)->deleteJson("/api/categories/{$category['id']}")->assertOk();
        $this->actingAs($admin)->deleteJson("/api/brands/{$brand['id']}")->assertOk();
    }

    public function test_product_sku_and_catalog_slugs_are_unique(): void
    {
        $admin = $this->userWithRole('admin');
        $category = $this->createCategory($admin);
        $brand = $this->createBrand($admin);

        $this->actingAs($admin)->postJson('/api/products', $this->productPayload($category['id'], $brand['id']))->assertCreated();

        $this->actingAs($admin)->postJson('/api/products', $this->productPayload($category['id'], $brand['id'], [
            'name' => 'Different Washer',
            'sku' => 'wash-100',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('sku');

        $this->actingAs($admin)->postJson('/api/products', $this->productPayload($category['id'], $brand['id'], [
            'name' => 'Different Washer',
            'sku' => 'WASH-101',
            'slug' => 'smart-washer',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');
    }

    public function test_an_empty_active_filter_returns_all_products(): void
    {
        $admin = $this->userWithRole('admin');
        $category = $this->createCategory($admin);
        $brand = $this->createBrand($admin);

        $this->actingAs($admin)
            ->postJson('/api/products', $this->productPayload($category['id'], $brand['id']))
            ->assertCreated();

        $this->actingAs($admin)
            ->getJson('/api/products?active=&per_page=100&sort=name&direction=asc')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.sku', 'WASH-100');
    }

    public function test_catalog_records_in_use_cannot_be_deleted(): void
    {
        $admin = $this->userWithRole('admin');
        $category = $this->createCategory($admin);
        $brand = $this->createBrand($admin);

        $this->actingAs($admin)->postJson('/api/products', $this->productPayload($category['id'], $brand['id']))->assertCreated();
        $product = Product::query()->where('sku', 'WASH-100')->firstOrFail();

        $this->actingAs($admin)->deleteJson("/api/categories/{$category['id']}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category');
        $this->actingAs($admin)->deleteJson("/api/brands/{$brand['id']}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('brand');

        $client = Client::factory()->create();
        DB::table('customer_products')->insert([
            'uuid' => (string) Str::uuid(),
            'customer_id' => $client->id,
            'product_id' => $product->id,
            'serial_number' => 'CATALOG-TEST-001',
            'purchase_date' => now()->subMonth()->toDateString(),
            'warranty_end' => now()->addMonth()->toDateString(),
            'starts_at' => now()->subMonth()->toDateString(),
            'expires_at' => now()->addMonth()->toDateString(),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin)->deleteJson("/api/products/{$product->uuid}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product');
    }

    public function test_users_without_catalog_permissions_are_forbidden(): void
    {
        $technician = $this->userWithRole('technician');

        $this->actingAs($technician)->getJson('/api/categories')->assertForbidden();
        $this->actingAs($technician)->getJson('/api/brands')->assertForbidden();
        $this->actingAs($technician)->getJson('/api/products')->assertForbidden();
    }

    /**
     * @return array{id: int, name: string}
     */
    private function createCategory(User $admin): array
    {
        return $this->actingAs($admin)->postJson('/api/categories', [
            'name' => 'Home Appliances',
            'description' => 'Household appliances and equipment.',
            'active' => true,
        ])->assertCreated()->json('data');
    }

    /**
     * @return array{id: int, name: string}
     */
    private function createBrand(User $admin): array
    {
        return $this->actingAs($admin)->postJson('/api/brands', [
            'name' => 'Atlas Tech',
            'logo_path' => 'brands/atlas-tech.svg',
            'active' => true,
        ])->assertCreated()->json('data');
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function productPayload(int $categoryId, int $brandId, array $overrides = []): array
    {
        return array_merge([
            'sku' => 'WASH-100',
            'name' => 'Smart Washer',
            'description' => 'Energy-efficient connected washing machine.',
            'category_id' => $categoryId,
            'brand_id' => $brandId,
            'model' => 'SW-100',
            'default_warranty_months' => 24,
            'serial_number_required' => true,
            'active' => true,
        ], $overrides);
    }
}
