<?php

namespace Tests\Feature\Dashboard;

use App\Models\Client;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_admin_dashboard_returns_database_aggregates(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $product = $this->product('DB-ADMIN-100');
        $warranty = $this->warranty($client, $product, 'DB-ADMIN-ACTIVE');
        $technician = $this->technician();
        $closed = $this->ticket($admin, $client, $product, $warranty, 'normal');
        $openUrgent = $this->ticket($admin, $client, $product, $warranty, 'urgent');

        $closed->update(['status' => 'closed', 'closed_at' => now(), 'received_at' => now()->subHours(4)]);
        $openUrgent->update(['assigned_technician_id' => $technician->id]);
        Repair::query()->create([
            'ticket_id' => $closed->id,
            'technician_id' => $technician->id,
            'started_at' => now()->subHours(3),
            'completed_at' => now(),
            'result' => 'repaired',
        ]);
        $this->warranty($client, $product, 'DB-ADMIN-EXPIRED', ['status' => 'expired', 'expires_at' => today()->subDay(), 'warranty_end' => today()->subDay()]);

        $this->actingAs($admin)->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonPath('data.kpis.open_tickets', 1)
            ->assertJsonPath('data.kpis.tickets_created_today', 2)
            ->assertJsonPath('data.kpis.tickets_resolved_today', 1)
            ->assertJsonPath('data.kpis.urgent_tickets', 1)
            ->assertJsonPath('data.kpis.active_warranties', 1)
            ->assertJsonPath('data.kpis.expired_warranties', 1)
            ->assertJsonPath('data.technicians.workload.0.value', 1)
            ->assertJsonPath('data.technicians.performance.0.completed_count', 1);
    }

    public function test_technician_dashboard_is_limited_to_the_authenticated_technician(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $product = $this->product('DB-TECH-100');
        $warranty = $this->warranty($client, $product, 'DB-TECH-OWN');
        $technicianUser = $this->user('technician');
        $technician = $this->technician($technicianUser);
        $otherTechnician = $this->technician();
        $ownTicket = $this->ticket($admin, $client, $product, $warranty, 'high');
        $otherTicket = $this->ticket($admin, $client, $product, $warranty, 'normal');

        $ownTicket->update(['assigned_technician_id' => $technician->id, 'received_at' => now()->subDays(4)]);
        $otherTicket->update(['assigned_technician_id' => $otherTechnician->id]);
        Repair::query()->create(['ticket_id' => $ownTicket->id, 'technician_id' => $technician->id, 'started_at' => now()->subHour()]);

        $this->actingAs($technicianUser)->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.role', 'technician')
            ->assertJsonPath('data.profile_available', true)
            ->assertJsonPath('data.kpis.assigned_tickets', 1)
            ->assertJsonPath('data.kpis.overdue_tickets', 1)
            ->assertJsonPath('data.kpis.repairs_in_progress', 1);
    }

    public function test_client_dashboard_never_uses_an_unlinked_or_other_client_profile(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $otherClient = Client::factory()->create();
        $clientUser = $this->user('client', ['client_id' => $client->id]);
        $unlinkedClientUser = $this->user('client');
        $product = $this->product('DB-CLIENT-100');
        $ownWarranty = $this->warranty($client, $product, 'DB-CLIENT-OWN');
        $otherWarranty = $this->warranty($otherClient, $product, 'DB-CLIENT-OTHER');
        $ownTicket = $this->ticket($admin, $client, $product, $ownWarranty, 'normal');
        $this->ticket($admin, $otherClient, $product, $otherWarranty, 'normal');
        $technician = $this->technician();
        Repair::query()->create(['ticket_id' => $ownTicket->id, 'technician_id' => $technician->id, 'customer_notes' => 'Your repair is being prepared.']);

        $this->actingAs($clientUser)->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.role', 'client')
            ->assertJsonPath('data.account_linked', true)
            ->assertJsonPath('data.kpis.my_products', 1)
            ->assertJsonPath('data.kpis.active_warranties', 1)
            ->assertJsonPath('data.kpis.active_tickets', 1)
            ->assertJsonPath('data.recent_repair_updates.0.customer_notes', 'Your repair is being prepared.');

        $this->actingAs($unlinkedClientUser)->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.account_linked', false)
            ->assertJsonPath('data.kpis.my_products', 0)
            ->assertJsonPath('data.recent_repair_updates', []);
    }

    public function test_dashboard_requires_authentication_and_dashboard_authorization(): void
    {
        $this->getJson('/api/dashboard')->assertUnauthorized();

        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/dashboard')->assertForbidden();
    }

    /** @param array<string, mixed> $attributes */
    private function user(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }

    private function technician(?User $user = null): Technician
    {
        $user ??= $this->user('technician');

        return Technician::query()->create([
            'user_id' => $user->id,
            'employee_code' => 'TECH-'.Str::upper(Str::random(6)),
            'skill_level' => 3,
            'availability_status' => 'available',
        ]);
    }

    private function product(string $sku): Product
    {
        $now = now();
        $brandId = DB::table('brands')->insertGetId(['name' => "Brand {$sku}", 'slug' => Str::slug("brand-{$sku}"), 'active' => true, 'created_at' => $now, 'updated_at' => $now]);
        $categoryId = DB::table('categories')->insertGetId(['name' => "Category {$sku}", 'slug' => Str::slug("category-{$sku}"), 'active' => true, 'created_at' => $now, 'updated_at' => $now]);

        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => $sku,
            'name' => "Product {$sku}",
            'slug' => Str::slug("product-{$sku}"),
            'brand_id' => $brandId,
            'category_id' => $categoryId,
            'model' => $sku,
            'default_warranty_months' => 24,
            'serial_number_required' => true,
            'active' => true,
        ]);
    }

    /** @param array<string, mixed> $overrides */
    private function warranty(Client $client, Product $product, string $serialNumber, array $overrides = []): Warranty
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
            ...$overrides,
        ]);
    }

    private function ticket(User $actor, Client $client, Product $product, Warranty $warranty, string $priority): Ticket
    {
        $this->actingAs($actor)->postJson('/api/tickets', [
            'client_id' => $client->id,
            'product_id' => $product->id,
            'warranty_id' => $warranty->id,
            'title' => 'Dashboard test issue',
            'problem_description' => 'A reproducible dashboard test issue.',
            'priority' => $priority,
            'source' => 'web',
        ])->assertCreated();

        return Ticket::query()->latest('id')->firstOrFail();
    }
}
