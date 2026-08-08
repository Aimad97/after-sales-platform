<?php

namespace Tests\Feature\Clients;

use App\Enums\ClientType;
use App\Models\Client;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ClientManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_an_admin_can_create_search_filter_update_and_archive_a_client(): void
    {
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin)->postJson('/api/clients', $this->individualPayload());

        $response->assertCreated()
            ->assertJsonPath('data.type', 'individual')
            ->assertJsonPath('data.email', 'sara@example.test');

        $client = Client::query()->where('email', 'sara@example.test')->firstOrFail();

        $this->assertTrue(Str::isUuid($client->uuid));

        $this->actingAs($admin)
            ->getJson("/api/clients/{$client->uuid}")
            ->assertOk()
            ->assertJsonPath('data.uuid', $client->uuid);

        $this->actingAs($admin)
            ->getJson('/api/clients?search=Sara&type=individual&sort=first_name&direction=asc&per_page=1')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('data.0.uuid', $client->uuid);

        $this->actingAs($admin)
            ->patchJson("/api/clients/{$client->uuid}", ['city' => 'Rabat', 'phone' => '+212611111111'])
            ->assertOk()
            ->assertJsonPath('data.city', 'Rabat');

        $this->actingAs($admin)
            ->deleteJson("/api/clients/{$client->uuid}")
            ->assertOk()
            ->assertJsonPath('message', 'Client archived successfully.');

        $this->assertSoftDeleted('customers', ['id' => $client->id]);
    }

    public function test_client_factory_creates_individual_and_company_states(): void
    {
        $individual = Client::factory()->individual()->create();
        $company = Client::factory()->company()->create();

        $this->assertSame(ClientType::Individual, $individual->type);
        $this->assertNull($individual->company_name);
        $this->assertSame(ClientType::Company, $company->type);
        $this->assertNotNull($company->company_name);
        $this->assertNotNull($company->tax_identifier);
    }

    public function test_a_company_client_requires_its_company_identity_and_tax_identifier(): void
    {
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)->postJson('/api/clients', [
            'type' => 'company',
            'first_name' => 'Samir',
            'last_name' => 'Contact',
            'phone' => '+212600000001',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_name', 'tax_identifier']);
    }

    public function test_a_user_without_client_permissions_cannot_access_clients(): void
    {
        $technician = $this->userWithRole('technician');

        $this->actingAs($technician)->getJson('/api/clients')->assertForbidden();
        $this->actingAs($technician)->postJson('/api/clients', $this->individualPayload())->assertForbidden();
    }

    public function test_client_profile_includes_product_warranty_ticket_and_repair_history(): void
    {
        $admin = $this->userWithRole('admin');
        $client = Client::query()->create([
            'uuid' => (string) Str::uuid(),
            'type' => ClientType::Individual,
            'first_name' => 'Nadia',
            'last_name' => 'Alaoui',
            'email' => 'nadia@example.test',
            'phone' => '+212600000002',
        ]);
        $now = now();

        $brandId = DB::table('brands')->insertGetId([
            'name' => 'Atlas Tech',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Appliances',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $productId = DB::table('products')->insertGetId([
            'brand_id' => $brandId,
            'category_id' => $categoryId,
            'name' => 'Smart Washer',
            'model' => 'SW-100',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $activeWarrantyId = DB::table('customer_products')->insertGetId([
            'customer_id' => $client->id,
            'product_id' => $productId,
            'serial_number' => 'SN-ACTIVE-001',
            'purchase_date' => $now->copy()->subMonth()->toDateString(),
            'warranty_end' => $now->copy()->addMonth()->toDateString(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $expiredWarrantyId = DB::table('customer_products')->insertGetId([
            'customer_id' => $client->id,
            'product_id' => $productId,
            'serial_number' => 'SN-EXPIRED-001',
            'purchase_date' => $now->copy()->subYears(2)->toDateString(),
            'warranty_end' => $now->copy()->subDay()->toDateString(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $statusId = DB::table('ticket_statuses')->insertGetId([
            'name' => 'In progress',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $priorityId = DB::table('ticket_priorities')->insertGetId([
            'name' => 'High',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $ticketId = DB::table('tickets')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'customer_id' => $client->id,
            'customer_product_id' => $activeWarrantyId,
            'status_id' => $statusId,
            'priority_id' => $priorityId,
            'created_by' => $admin->id,
            'subject' => 'Water leakage',
            'description' => 'Water is leaking from the appliance.',
            'opened_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('interventions')->insert([
            'ticket_id' => $ticketId,
            'technician_id' => $admin->id,
            'diagnostic' => 'Damaged inlet hose.',
            'solution' => 'Replaced the inlet hose.',
            'labor_cost' => 120,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->actingAs($admin)->getJson("/api/clients/{$client->uuid}/profile")
            ->assertOk()
            ->assertJsonPath('data.client.uuid', $client->uuid)
            ->assertJsonPath('data.purchased_products.0.product.name', 'Smart Washer')
            ->assertJsonPath('data.active_warranties.0.id', $activeWarrantyId)
            ->assertJsonPath('data.expired_warranties.0.id', $expiredWarrantyId)
            ->assertJsonPath('data.tickets.0.subject', 'Water leakage')
            ->assertJsonPath('data.repair_history.0.diagnostic', 'Damaged inlet hose.')
            ->assertJsonPath('data.repair_history.0.ticket.status.name', 'In progress');
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /**
     * @return array<string, string>
     */
    private function individualPayload(): array
    {
        return [
            'type' => 'individual',
            'first_name' => 'Sara',
            'last_name' => 'El Mansouri',
            'email' => 'Sara@Example.test',
            'phone' => '+212600000000',
            'address' => '12 Rue Mohammed V',
            'city' => 'Casablanca',
            'notes' => 'Prefers contact by email.',
        ];
    }
}
