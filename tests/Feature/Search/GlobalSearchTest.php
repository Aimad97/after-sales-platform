<?php

namespace Tests\Feature\Search;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class GlobalSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_search_requires_authentication_and_validated_query_parameters(): void
    {
        $this->getJson('/api/search?q=atlas')->assertUnauthorized();

        $admin = $this->user('admin');

        $this->actingAs($admin)->getJson('/api/search?q=a')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
        $this->actingAs($admin)->getJson('/api/search?q=atlas&limit=11')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('limit');
    }

    public function test_authorized_staff_receive_limited_categorized_results(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create([
            'first_name' => 'Atlas',
            'last_name' => 'Customer',
            'email' => 'atlas.customer@example.test',
        ]);
        $product = $this->product('ATLAS-SKU', 'Atlas Workstation');
        $warranty = $this->warranty($client, $product, 'ATLAS-SERIAL-001');
        $ticket = $this->ticket($admin, $client, $product, $warranty, 'ATLAS-TICKET-001');
        $invoice = Invoice::query()->create([
            'invoice_number' => 'ATLAS-INVOICE-001',
            'client_id' => $client->id,
            'invoice_date' => today(),
            'status' => 'issued',
        ]);
        $technicianUser = $this->user('technician', ['first_name' => 'Atlas', 'last_name' => 'Technician']);
        $technician = Technician::query()->create([
            'user_id' => $technicianUser->id,
            'employee_code' => 'ATLAS-TECH-001',
            'specialization' => 'Atlas hardware',
            'skill_level' => 4,
            'availability_status' => 'available',
        ]);

        $this->actingAs($admin)->getJson('/api/search?q=%20Atlas%20&limit=1')
            ->assertOk()
            ->assertJsonPath('data.query', 'Atlas')
            ->assertJsonPath('data.limit_per_category', 1)
            ->assertJsonPath('data.total', 6)
            ->assertJsonPath('data.groups.clients.0.url', "/admin/clients/{$client->uuid}")
            ->assertJsonPath('data.groups.tickets.0.url', "/admin/tickets/{$ticket->uuid}")
            ->assertJsonPath('data.groups.invoices.0.url', "/admin/invoices/{$invoice->id}")
            ->assertJsonPath('data.groups.serial_numbers.0.url', "/admin/warranties/{$warranty->uuid}")
            ->assertJsonPath('data.groups.products.0.url', "/admin/products/{$product->uuid}")
            ->assertJsonPath('data.groups.technicians.0.url', "/admin/technicians/{$technician->id}")
            ->assertJsonMissingPath('data.groups.clients.0.notes')
            ->assertJsonMissingPath('data.groups.technicians.0.notes');
    }

    public function test_each_staff_category_is_hidden_without_its_existing_view_policy(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create(['first_name' => 'Scoped', 'last_name' => 'Client']);
        $product = $this->product('SCOPED-SKU', 'Scoped Product');
        $warranty = $this->warranty($client, $product, 'SCOPED-SERIAL');
        $this->ticket($admin, $client, $product, $warranty, 'SCOPED-TICKET');
        Invoice::query()->create(['invoice_number' => 'SCOPED-INVOICE', 'client_id' => $client->id, 'invoice_date' => today()]);
        $technician = $this->user('technician', ['first_name' => 'Scoped', 'last_name' => 'Technician']);
        Technician::query()->create(['user_id' => $technician->id, 'employee_code' => 'SCOPED-TECH']);
        $catalogViewer = User::factory()->create();
        $catalogViewer->givePermissionTo('products.view');

        $this->actingAs($catalogViewer)->getJson('/api/search?q=Scoped')
            ->assertOk()
            ->assertJsonCount(0, 'data.groups.clients')
            ->assertJsonCount(0, 'data.groups.tickets')
            ->assertJsonCount(0, 'data.groups.invoices')
            ->assertJsonCount(0, 'data.groups.serial_numbers')
            ->assertJsonCount(1, 'data.groups.products')
            ->assertJsonCount(0, 'data.groups.technicians')
            ->assertJsonPath('data.total', 1);
    }

    public function test_client_results_are_limited_to_the_linked_clients_portal_resources(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create(['first_name' => 'Portal', 'last_name' => 'Owner']);
        $otherClient = Client::factory()->create();
        $clientUser = $this->user('client', ['client_id' => $client->id]);
        $ownProduct = $this->product('PORTAL-OWN', 'Portal Laptop');
        $otherProduct = $this->product('PORTAL-OTHER', 'Portal Other Laptop');
        $ownWarranty = $this->warranty($client, $ownProduct, 'PORTAL-SERIAL-OWN');
        $otherWarranty = $this->warranty($otherClient, $otherProduct, 'PORTAL-SERIAL-OTHER');
        $ownTicket = $this->ticket($admin, $client, $ownProduct, $ownWarranty, 'PORTAL-TICKET-OWN');
        $otherTicket = $this->ticket($admin, $otherClient, $otherProduct, $otherWarranty, 'PORTAL-TICKET-OTHER');
        Invoice::query()->create(['invoice_number' => 'PORTAL-INVOICE-OWN', 'client_id' => $client->id, 'invoice_date' => today()]);
        $technicianUser = $this->user('technician', ['first_name' => 'Portal', 'last_name' => 'Technician']);
        Technician::query()->create(['user_id' => $technicianUser->id, 'employee_code' => 'PORTAL-TECH']);

        $this->actingAs($clientUser)->getJson('/api/search?q=Portal')
            ->assertOk()
            ->assertJsonCount(1, 'data.groups.clients')
            ->assertJsonPath('data.groups.clients.0.id', $client->uuid)
            ->assertJsonPath('data.groups.clients.0.url', '/client/profile')
            ->assertJsonCount(1, 'data.groups.tickets')
            ->assertJsonPath('data.groups.tickets.0.id', $ownTicket->uuid)
            ->assertJsonPath('data.groups.tickets.0.url', "/client/tickets/{$ownTicket->uuid}")
            ->assertJsonCount(0, 'data.groups.invoices')
            ->assertJsonCount(1, 'data.groups.serial_numbers')
            ->assertJsonPath('data.groups.serial_numbers.0.id', $ownWarranty->uuid)
            ->assertJsonCount(1, 'data.groups.products')
            ->assertJsonPath('data.groups.products.0.id', $ownWarranty->uuid)
            ->assertJsonCount(0, 'data.groups.technicians')
            ->assertJsonMissing(['id' => $otherTicket->uuid])
            ->assertJsonMissing(['id' => $otherWarranty->uuid]);
    }

    public function test_unlinked_or_mixed_client_accounts_receive_no_search_results(): void
    {
        $client = Client::factory()->create(['first_name' => 'Hidden', 'last_name' => 'Customer']);
        $product = $this->product('HIDDEN-SKU', 'Hidden Product');
        $this->warranty($client, $product, 'HIDDEN-SERIAL');
        $unlinked = $this->user('client');
        $mixed = $this->user('client');
        $mixed->assignRole('sav_agent');

        $this->actingAs($unlinked)->getJson('/api/search?q=Hidden')
            ->assertOk()
            ->assertJsonPath('data.total', 0);
        $this->actingAs($mixed)->getJson('/api/search?q=Hidden')
            ->assertOk()
            ->assertJsonPath('data.total', 0);
    }

    /** @param array<string, mixed> $attributes */
    private function user(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }

    private function product(string $sku, string $name): Product
    {
        $now = now();
        $brandId = DB::table('brands')->insertGetId([
            'name' => "Brand {$sku}",
            'slug' => Str::slug("brand-{$sku}"),
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $categoryId = DB::table('categories')->insertGetId([
            'name' => "Category {$sku}",
            'slug' => Str::slug("category-{$sku}"),
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => $sku,
            'name' => $name,
            'slug' => Str::slug("{$name}-{$sku}"),
            'brand_id' => $brandId,
            'category_id' => $categoryId,
            'model' => $sku,
            'default_warranty_months' => 24,
            'serial_number_required' => true,
            'active' => true,
        ]);
    }

    private function warranty(Client $client, Product $product, string $serialNumber): Warranty
    {
        return Warranty::query()->create([
            'uuid' => (string) Str::uuid(),
            'customer_id' => $client->id,
            'product_id' => $product->id,
            'serial_number' => $serialNumber,
            'quantity' => 1,
            'purchase_date' => today()->subMonth(),
            'warranty_end' => today()->addYear(),
            'starts_at' => today()->subMonth(),
            'expires_at' => today()->addYear(),
            'status' => 'active',
        ]);
    }

    private function ticket(User $actor, Client $client, Product $product, Warranty $warranty, string $number): Ticket
    {
        return Ticket::query()->create([
            'uuid' => (string) Str::uuid(),
            'ticket_number' => $number,
            'customer_id' => $client->id,
            'customer_product_id' => $warranty->id,
            'client_id' => $client->id,
            'warranty_id' => $warranty->id,
            'product_id' => $product->id,
            'created_by' => $actor->id,
            'subject' => 'Search issue',
            'description' => 'Searchable ticket issue.',
            'title' => 'Search issue',
            'problem_description' => 'Searchable ticket issue.',
            'priority' => 'normal',
            'status' => 'opened',
            'source' => 'web',
            'opened_at' => now(),
            'received_at' => now(),
        ]);
    }
}
