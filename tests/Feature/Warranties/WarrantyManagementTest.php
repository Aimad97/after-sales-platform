<?php

namespace Tests\Feature\Warranties;

use App\Enums\WarrantyStatus;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Client;
use App\Models\Product;
use App\Models\User;
use App\Models\Warranty;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class WarrantyManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-06-15 12:00:00');
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function tearDown(): void
    {
        $this->travelBack();

        parent::tearDown();
    }

    public function test_warranty_is_active_on_its_expiration_date_with_zero_remaining_days(): void
    {
        $admin = $this->userWithRole('admin');
        $warranty = $this->createWarranty([
            'starts_at' => '2026-06-01',
            'expires_at' => '2026-06-15',
            'warranty_end' => '2026-06-15',
        ]);

        $this->actingAs($admin)->getJson("/api/warranties/{$warranty->uuid}/eligibility")
            ->assertOk()
            ->assertJsonPath('data.is_under_warranty', true)
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.remaining_days', 0)
            ->assertJsonPath('data.expires_at', '2026-06-15');
    }

    public function test_expired_warranties_are_never_reported_or_filtered_as_active(): void
    {
        $admin = $this->userWithRole('admin');
        $expired = $this->createWarranty([
            'serial_number' => 'EXPIRED-001',
            'starts_at' => '2025-06-14',
            'expires_at' => '2026-06-14',
            'warranty_end' => '2026-06-14',
        ]);
        $active = $this->createWarranty([
            'serial_number' => 'ACTIVE-001',
            'starts_at' => '2026-06-01',
            'expires_at' => '2026-06-16',
            'warranty_end' => '2026-06-16',
        ]);

        $this->actingAs($admin)->getJson("/api/warranties/{$expired->uuid}/eligibility")
            ->assertOk()
            ->assertJsonPath('data.is_under_warranty', false)
            ->assertJsonPath('data.status', 'expired')
            ->assertJsonPath('data.remaining_days', 0);

        $this->actingAs($admin)->getJson('/api/warranties?status=active')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $active->uuid)
            ->assertJsonMissing(['uuid' => $expired->uuid]);

        $this->actingAs($admin)->patchJson("/api/warranties/{$expired->uuid}", ['status' => 'active'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseHas('customer_products', [
            'id' => $expired->id,
            'status' => WarrantyStatus::Expired->value,
        ]);
    }

    public function test_future_start_date_is_ineligible_even_before_expiration(): void
    {
        $admin = $this->userWithRole('admin');
        $warranty = $this->createWarranty([
            'starts_at' => '2026-06-16',
            'expires_at' => '2027-06-16',
            'warranty_end' => '2027-06-16',
        ]);

        $this->actingAs($admin)->getJson("/api/warranties/{$warranty->uuid}/eligibility")
            ->assertOk()
            ->assertJsonPath('data.is_under_warranty', false)
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.reason', 'Warranty coverage starts on 2026-06-16.');
    }

    public function test_void_warranties_require_a_reason_and_are_ineligible(): void
    {
        $admin = $this->userWithRole('admin');
        $warranty = $this->createWarranty();

        $this->actingAs($admin)->patchJson("/api/warranties/{$warranty->uuid}", ['status' => 'void'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('void_reason');

        $this->actingAs($admin)->patchJson("/api/warranties/{$warranty->uuid}", [
            'status' => 'void',
            'void_reason' => 'Physical damage is not covered by the warranty terms.',
            'notes' => 'Validated by SAV manager.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'void')
            ->assertJsonPath('data.void_reason', 'Physical damage is not covered by the warranty terms.');

        $this->actingAs($admin)->getJson("/api/warranties/{$warranty->uuid}/eligibility")
            ->assertOk()
            ->assertJsonPath('data.is_under_warranty', false)
            ->assertJsonPath('data.status', 'void');
    }

    public function test_replaced_warranty_is_ineligible_and_cannot_be_reversed(): void
    {
        $admin = $this->userWithRole('admin');
        $warranty = $this->createWarranty();

        $this->actingAs($admin)->patchJson("/api/warranties/{$warranty->uuid}", [
            'status' => 'replaced',
            'notes' => 'Replacement unit WRN-NEW-001 was issued.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'replaced');

        $this->actingAs($admin)->patchJson("/api/warranties/{$warranty->uuid}", [
            'status' => 'void',
            'void_reason' => 'Not applicable after replacement.',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->actingAs($admin)->getJson("/api/warranties/{$warranty->uuid}/eligibility")
            ->assertOk()
            ->assertJsonPath('data.is_under_warranty', false)
            ->assertJsonPath('data.status', 'replaced');
    }

    public function test_warranties_can_be_looked_up_by_serial_client_and_product(): void
    {
        $admin = $this->userWithRole('admin');
        $client = Client::factory()->create();
        $product = $this->createProduct();
        $warranty = $this->createWarranty([
            'customer_id' => $client->id,
            'product_id' => $product->id,
            'serial_number' => 'LOOKUP-001',
        ], $client, $product);

        $this->actingAs($admin)->getJson('/api/warranties/lookup?serial_number=lookup-001')
            ->assertOk()
            ->assertJsonPath('data.warranty.uuid', $warranty->uuid)
            ->assertJsonPath('data.eligibility.is_under_warranty', true);

        $this->actingAs($admin)
            ->getJson("/api/warranties?client_id={$client->id}&product_id={$product->id}")
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $warranty->uuid);

        $this->actingAs($admin)
            ->getJson("/api/clients/{$client->uuid}/warranties")
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $warranty->uuid);
    }

    public function test_client_role_cannot_access_global_warranty_records(): void
    {
        $clientUser = $this->userWithRole('client');

        $this->actingAs($clientUser)->getJson('/api/warranties')->assertForbidden();
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function createWarranty(array $overrides = [], ?Client $client = null, ?Product $product = null): Warranty
    {
        $client ??= Client::factory()->create();
        $product ??= $this->createProduct();
        $startsAt = $overrides['starts_at'] ?? '2026-06-01';
        $expiresAt = $overrides['expires_at'] ?? '2027-06-15';

        return Warranty::query()->create(array_merge([
            'uuid' => (string) Str::uuid(),
            'customer_id' => $client->id,
            'product_id' => $product->id,
            'serial_number' => 'WRN-'.Str::upper(Str::random(12)),
            'quantity' => 1,
            'purchase_date' => $startsAt,
            'warranty_end' => $expiresAt,
            'starts_at' => $startsAt,
            'expires_at' => $expiresAt,
            'status' => WarrantyStatus::Active,
        ], $overrides));
    }

    private function createProduct(): Product
    {
        $suffix = Str::lower(Str::random(8));
        $category = Category::query()->create([
            'name' => "Warranty category {$suffix}",
            'slug' => "warranty-category-{$suffix}",
            'active' => true,
        ]);
        $brand = Brand::query()->create([
            'name' => "Warranty brand {$suffix}",
            'slug' => "warranty-brand-{$suffix}",
            'active' => true,
        ]);

        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => "WRN-{$suffix}",
            'name' => "Warranty product {$suffix}",
            'slug' => "warranty-product-{$suffix}",
            'category_id' => $category->id,
            'brand_id' => $brand->id,
            'model' => 'WRN-100',
            'default_warranty_months' => 12,
            'serial_number_required' => true,
            'active' => true,
        ]);
    }
}
