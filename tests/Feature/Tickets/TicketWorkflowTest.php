<?php

namespace Tests\Feature\Tickets;

use App\Enums\ClientType;
use App\Enums\TicketStatus;
use App\Models\Client;
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

class TicketWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_an_sav_agent_can_create_filter_update_assign_and_transition_a_ticket(): void
    {
        $agent = $this->userWithRole('sav_agent');
        $client = Client::factory()->create(['type' => ClientType::Individual]);
        $product = $this->product('DW-200', 'Dishwasher 200');
        $warranty = $this->warranty($client, $product, 'SN-TICKET-001');
        $technician = $this->technician();

        $created = $this->actingAs($agent)->postJson('/api/tickets', [
            'client_id' => $client->id,
            'product_id' => $product->id,
            'warranty_id' => $warranty->id,
            'title' => 'Water leak under the door',
            'problem_description' => 'The dishwasher leaks during the wash cycle.',
            'priority' => 'high',
            'source' => 'phone',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'opened')
            ->assertJsonPath('data.priority', 'high')
            ->assertJsonPath('data.warranty_eligible', true)
            ->assertJsonPath('data.status_history.0.to_status', 'opened');

        $ticket = Ticket::query()->firstOrFail();
        $this->assertTrue(Str::isUuid($ticket->uuid));
        $this->assertMatchesRegularExpression('/^TKT-\d{8}-[A-Z0-9]{6}$/', $ticket->ticket_number);
        $this->assertDatabaseHas('ticket_histories', ['ticket_id' => $ticket->id, 'event' => 'ticket_created']);
        $this->assertDatabaseHas('audit_logs', ['entity_type' => Ticket::class, 'entity_id' => $ticket->id, 'action' => 'created']);

        $this->actingAs($agent)->getJson('/api/tickets?search=leak&status=opened&priority=high&source=phone')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $ticket->uuid);

        $this->actingAs($agent)->patchJson("/api/tickets/{$ticket->uuid}", [
            'title' => 'Leak under dishwasher door',
            'source' => 'store',
        ])->assertOk()
            ->assertJsonPath('data.title', 'Leak under dishwasher door')
            ->assertJsonPath('data.source', 'store');

        $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/assign", [
            'assigned_technician_id' => $technician->id,
        ])->assertOk()
            ->assertJsonPath('data.assigned_technician.id', $technician->id);

        $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/priority", ['priority' => 'urgent'])
            ->assertOk()
            ->assertJsonPath('data.priority', 'urgent');

        $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'received', 'notes' => 'Item checked in.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'received')
            ->assertJsonPath('data.status_history.1.from_status', 'opened')
            ->assertJsonPath('data.status_history.1.to_status', 'received');

        $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'awaiting_diagnosis'])
            ->assertOk()
            ->assertJsonPath('data.status', 'awaiting_diagnosis');

        $this->assertDatabaseHas('ticket_status_histories', [
            'ticket_id' => $ticket->id,
            'from_status' => 'received',
            'to_status' => 'awaiting_diagnosis',
        ]);
        $this->actingAs($agent)->getJson('/api/audit-logs')->assertForbidden();
        $admin = $this->userWithRole('admin');
        $this->actingAs($admin)->getJson('/api/audit-logs?entity_type='.urlencode(Ticket::class))->assertOk()->assertJsonPath('data.0.entity_id', $ticket->id);
    }

    public function test_workflow_rejects_arbitrary_status_changes_and_preserves_history(): void
    {
        $agent = $this->userWithRole('sav_agent');
        $ticket = $this->createTicket($agent);

        $this->actingAs($agent)->patchJson("/api/tickets/{$ticket->uuid}", ['status' => 'repairing'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'repairing'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $ticket->refresh();
        $this->assertSame(TicketStatus::Opened, $ticket->status);
        $this->assertDatabaseCount('ticket_status_histories', 1);
    }

    public function test_cancellation_is_recorded_and_terminal_tickets_cannot_change(): void
    {
        $agent = $this->userWithRole('sav_agent');
        $ticket = $this->createTicket($agent);

        $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/cancel", ['reason' => 'Customer withdrew the request.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.status_history.1.from_status', 'opened')
            ->assertJsonPath('data.status_history.1.to_status', 'cancelled');

        $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/priority", ['priority' => 'low'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ticket']);
        $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/cancel", ['reason' => 'Second cancellation attempt.'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ticket']);
    }

    public function test_the_complete_repair_path_can_only_close_in_its_defined_order(): void
    {
        $agent = $this->userWithRole('sav_agent');
        $ticket = $this->createTicket($agent);
        $path = [
            'received',
            'awaiting_diagnosis',
            'diagnosing',
            'awaiting_part',
            'repairing',
            'testing',
            'repaired',
            'ready_for_pickup',
            'delivered',
            'closed',
        ];

        foreach ($path as $status) {
            $this->actingAs($agent)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => $status])
                ->assertOk()
                ->assertJsonPath('data.status', $status);
        }

        $ticket->refresh();
        $this->assertSame(TicketStatus::Closed, $ticket->status);
        $this->assertNotNull($ticket->closed_at);
        $this->assertDatabaseCount('ticket_status_histories', 11);
    }

    public function test_ticket_context_must_match_the_client_product_and_warranty(): void
    {
        $agent = $this->userWithRole('sav_agent');
        $client = Client::factory()->create();
        $otherClient = Client::factory()->create();
        $product = $this->product('TV-200', 'Television 200');
        $warranty = $this->warranty($otherClient, $product, 'SN-TICKET-002');

        $this->actingAs($agent)->postJson('/api/tickets', [
            'client_id' => $client->id,
            'product_id' => $product->id,
            'warranty_id' => $warranty->id,
            'title' => 'Screen flickers',
            'problem_description' => 'The screen flashes intermittently.',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['warranty_id']);
    }

    public function test_users_without_assignment_permission_cannot_assign_a_technician(): void
    {
        $agent = $this->userWithRole('sav_agent');
        $technicianUser = $this->userWithRole('technician');
        $technician = Technician::query()->create([
            'user_id' => $technicianUser->id,
            'employee_code' => 'TECH-FORBIDDEN',
            'skill_level' => 3,
            'availability_status' => 'available',
        ]);
        $ticket = $this->createTicket($agent);

        $this->actingAs($technicianUser)->postJson("/api/tickets/{$ticket->uuid}/assign", [
            'assigned_technician_id' => $technician->id,
        ])->assertForbidden();
    }

    private function createTicket(User $actor): Ticket
    {
        $client = Client::factory()->create();
        $product = $this->product('WM-100', 'Washer 100');
        $warranty = $this->warranty($client, $product, 'SN-TICKET-BASE');

        $this->actingAs($actor)->postJson('/api/tickets', [
            'client_id' => $client->id,
            'product_id' => $product->id,
            'warranty_id' => $warranty->id,
            'title' => 'Washer is noisy',
            'problem_description' => 'The appliance makes a loud noise while spinning.',
        ])->assertCreated();

        return Ticket::query()->latest('id')->firstOrFail();
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function technician(): Technician
    {
        $user = $this->userWithRole('technician');

        return Technician::query()->create([
            'user_id' => $user->id,
            'employee_code' => 'TECH-'.Str::upper(Str::random(6)),
            'specialization' => 'Appliances',
            'skill_level' => 4,
            'availability_status' => 'available',
        ]);
    }

    private function product(string $sku, string $name): Product
    {
        $now = now();
        $brandId = DB::table('brands')->insertGetId([
            'name' => "Brand {$sku}",
            'slug' => "brand-{$sku}",
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $categoryId = DB::table('categories')->insertGetId([
            'name' => "Category {$sku}",
            'slug' => "category-{$sku}",
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => $sku,
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)),
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
}
