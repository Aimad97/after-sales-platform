<?php

namespace Tests\Feature\Invoices;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Client;
use App\Models\Product;
use App\Models\User;
use App\Models\Warranty;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class InvoiceManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_invoice_totals_are_calculated_on_the_server_and_sold_products_are_linked_to_the_client(): void
    {
        $admin = $this->userWithRole('admin');
        $client = Client::factory()->create();
        $product = $this->createProduct(serialNumberRequired: false, warrantyMonths: 24);

        $response = $this->actingAs($admin)->postJson('/api/invoices', [
            'invoice_number' => 'inv-2026-0001',
            'client_id' => $client->id,
            'invoice_date' => '2026-01-15',
            'tax_rate' => 20,
            'status' => 'issued',
            'total_amount' => 1,
            'tax_amount' => 1,
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 2,
                'unit_price' => 100,
                'warranty_months' => 24,
            ]],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.invoice_number', 'INV-2026-0001')
            ->assertJsonPath('data.subtotal_amount', '200.00')
            ->assertJsonPath('data.tax_amount', '40.00')
            ->assertJsonPath('data.total_amount', '240.00')
            ->assertJsonPath('data.items.0.line_total', '240.00');

        $invoiceId = $response->json('data.id');
        $invoiceItemId = $response->json('data.items.0.id');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'invoice_number' => 'INV-2026-0001',
            'subtotal_amount' => 200,
            'tax_amount' => 40,
            'total_amount' => 240,
        ]);
        $purchases = Warranty::query()->where('invoice_item_id', $invoiceItemId)->get();
        $purchase = $purchases->firstOrFail();
        $this->assertCount(2, $purchases);
        $this->assertTrue($purchases->every(fn (Warranty $warranty): bool => $warranty->quantity === 1));
        $this->assertSame('2026-01-15', $purchase->purchase_date?->toDateString());
        $this->assertSame('2028-01-15', $purchase->warranty_end?->toDateString());
        $this->assertDatabaseHas('customer_products', [
            'customer_id' => $client->id,
            'product_id' => $product->id,
            'invoice_item_id' => $invoiceItemId,
            'quantity' => 1,
        ]);

        $this->actingAs($admin)
            ->getJson("/api/clients/{$client->uuid}/invoices?status=issued")
            ->assertOk()
            ->assertJsonPath('data.0.id', $invoiceId);
    }

    public function test_warranty_end_date_is_derived_from_the_start_date_and_warranty_months(): void
    {
        $admin = $this->userWithRole('admin');
        $client = Client::factory()->create();
        $product = $this->createProduct(serialNumberRequired: true, warrantyMonths: 12);

        $response = $this->actingAs($admin)->postJson('/api/invoices', [
            'client_id' => $client->id,
            'invoice_date' => '2026-01-31',
            'tax_rate' => 20,
            'items' => [[
                'product_id' => $product->id,
                'serial_number' => 'serial-001',
                'quantity' => 1,
                'unit_price' => 1250,
                'warranty_months' => 24,
            ]],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.items.0.serial_number', 'SERIAL-001')
            ->assertJsonPath('data.items.0.warranty_start_date', '2026-01-31')
            ->assertJsonPath('data.items.0.warranty_end_date', '2028-01-31');

        $purchase = Warranty::query()->where('serial_number', 'SERIAL-001')->firstOrFail();
        $this->assertSame('2028-01-31', $purchase->warranty_end?->toDateString());
        $this->assertDatabaseHas('customer_products', [
            'customer_id' => $client->id,
            'product_id' => $product->id,
            'serial_number' => 'SERIAL-001',
        ]);
    }

    public function test_invoice_number_and_serial_numbers_must_be_unique(): void
    {
        $admin = $this->userWithRole('admin');
        $client = Client::factory()->create();
        $product = $this->createProduct(serialNumberRequired: true, warrantyMonths: 12);
        $payload = [
            'invoice_number' => 'INV-UNIQUE-001',
            'client_id' => $client->id,
            'invoice_date' => '2026-02-01',
            'items' => [[
                'product_id' => $product->id,
                'serial_number' => 'UNIQUE-SERIAL-001',
                'quantity' => 1,
                'unit_price' => 500,
                'warranty_months' => 12,
            ]],
        ];

        $this->actingAs($admin)->postJson('/api/invoices', $payload)->assertCreated();

        $this->actingAs($admin)->postJson('/api/invoices', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice_number');

        $this->actingAs($admin)->postJson('/api/invoices', [
            ...$payload,
            'invoice_number' => 'INV-UNIQUE-002',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');
    }

    public function test_failed_invoice_creation_leaves_no_partial_invoice_or_purchase_records(): void
    {
        $admin = $this->userWithRole('admin');
        $client = Client::factory()->create();
        $product = $this->createProduct(serialNumberRequired: true, warrantyMonths: 12);

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER fail_second_invoice_item
            BEFORE INSERT ON invoice_items
            WHEN NEW.serial_number = 'FORCE-ROLLBACK-002'
            BEGIN
                SELECT RAISE(ABORT, 'forced invoice item persistence failure');
            END;
            SQL);

        try {
            $this->actingAs($admin)->postJson('/api/invoices', [
                'invoice_number' => 'INV-ROLLBACK-001',
                'client_id' => $client->id,
                'invoice_date' => '2026-02-01',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'serial_number' => 'FORCE-ROLLBACK-001',
                        'quantity' => 1,
                        'unit_price' => 500,
                        'warranty_months' => 12,
                    ],
                    [
                        'product_id' => $product->id,
                        'serial_number' => 'FORCE-ROLLBACK-002',
                        'quantity' => 1,
                        'unit_price' => 600,
                        'warranty_months' => 12,
                    ],
                ],
            ])->assertServerError();
        } finally {
            DB::unprepared('DROP TRIGGER IF EXISTS fail_second_invoice_item');
        }

        $this->assertDatabaseMissing('invoices', ['invoice_number' => 'INV-ROLLBACK-001']);
        $this->assertDatabaseCount('invoice_items', 0);
        $this->assertDatabaseCount('customer_products', 0);
    }

    public function test_only_users_with_invoice_permissions_can_access_invoices(): void
    {
        $technician = $this->userWithRole('technician');

        $this->actingAs($technician)->getJson('/api/invoices')->assertForbidden();
        $this->actingAs($technician)->postJson('/api/invoices', [])->assertForbidden();
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function createProduct(bool $serialNumberRequired, int $warrantyMonths): Product
    {
        $suffix = Str::lower(Str::random(8));
        $category = Category::query()->create([
            'name' => "Invoice category {$suffix}",
            'slug' => "invoice-category-{$suffix}",
            'active' => true,
        ]);
        $brand = Brand::query()->create([
            'name' => "Invoice brand {$suffix}",
            'slug' => "invoice-brand-{$suffix}",
            'active' => true,
        ]);

        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => "INV-{$suffix}",
            'name' => "Invoice product {$suffix}",
            'slug' => "invoice-product-{$suffix}",
            'category_id' => $category->id,
            'brand_id' => $brand->id,
            'model' => 'INV-100',
            'default_warranty_months' => $warrantyMonths,
            'serial_number_required' => $serialNumberRequired,
            'active' => true,
        ]);
    }
}
