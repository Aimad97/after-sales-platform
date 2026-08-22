<?php

namespace Tests\Feature\ClientPortal;

use App\Enums\TicketStatus;
use App\Models\Attachment;
use App\Models\Client;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use App\Services\RealtimePayloadService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ClientPortalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        config(['attachments.disk' => 'portal_test']);
        Storage::fake('portal_test');
        Queue::fake();
        $this->withHeader('Origin', 'http://localhost:5173');
    }

    public function test_linked_client_can_log_in_and_view_only_their_safe_profile(): void
    {
        $client = Client::factory()->create(['notes' => 'Internal account note.']);
        $otherClient = Client::factory()->create();
        $user = $this->clientUser($client, ['password' => 'Correct-Horse-Battery-123']);

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-Battery-123',
        ])->assertOk()->assertJsonPath('data.roles.0', 'client');

        $this->getJson('/api/client/profile')
            ->assertOk()
            ->assertJsonPath('data.uuid', $client->uuid)
            ->assertJsonMissingPath('data.notes');

        $this->getJson("/api/clients/{$otherClient->uuid}/profile")->assertForbidden();
        $this->getJson("/api/clients/{$client->uuid}/profile")->assertForbidden();
    }

    public function test_products_and_warranties_are_strictly_scoped_to_the_linked_client(): void
    {
        $client = Client::factory()->create();
        $otherClient = Client::factory()->create();
        $user = $this->clientUser($client);
        $ownProduct = $this->product('PORTAL-OWN');
        $otherProduct = $this->product('PORTAL-OTHER');
        $ownWarranty = $this->warranty($client, $ownProduct, 'OWN-SERIAL');
        $otherWarranty = $this->warranty($otherClient, $otherProduct, 'OTHER-SERIAL');

        $this->actingAs($user)->getJson('/api/client/products')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $ownWarranty->uuid)
            ->assertJsonPath('data.0.warranty.status', 'active')
            ->assertJsonMissing(['uuid' => $otherWarranty->uuid]);

        $this->actingAs($user)->getJson("/api/client/products/{$ownWarranty->uuid}")
            ->assertOk()
            ->assertJsonPath('data.product.uuid', $ownProduct->uuid);
        $this->actingAs($user)->getJson("/api/client/products/{$otherWarranty->uuid}")->assertNotFound();
        $this->actingAs($user)->getJson("/api/client/warranties/{$otherWarranty->uuid}")->assertNotFound();
        $this->actingAs($user)->getJson("/api/products/{$otherProduct->uuid}")->assertForbidden();
        $this->actingAs($user)->getJson("/api/warranties/{$otherWarranty->uuid}")->assertForbidden();
    }

    public function test_client_can_submit_a_request_only_for_their_purchased_product(): void
    {
        $client = Client::factory()->create();
        $otherClient = Client::factory()->create();
        $user = $this->clientUser($client);
        $ownWarranty = $this->warranty($client, $this->product('PORTAL-REQUEST'), 'REQUEST-OWN');
        $otherWarranty = $this->warranty($otherClient, $this->product('PORTAL-FOREIGN'), 'REQUEST-FOREIGN');

        $this->actingAs($user)->postJson('/api/client/tickets', [
            'purchased_product_uuid' => $otherWarranty->uuid,
            'title' => 'Foreign product request',
            'problem_description' => 'This request must never be created for another client.',
        ])->assertNotFound();

        $response = $this->actingAs($user)->postJson('/api/client/tickets', [
            'purchased_product_uuid' => $ownWarranty->uuid,
            'title' => 'Device does not power on',
            'problem_description' => 'The power indicator stays off after using a known-good outlet.',
        ])->assertCreated()
            ->assertJsonPath('data.product.uuid', $ownWarranty->product->uuid)
            ->assertJsonPath('data.warranty.uuid', $ownWarranty->uuid)
            ->assertJsonPath('data.priority', 'normal')
            ->assertJsonPath('data.source', 'web');

        $ticket = Ticket::query()->where('uuid', $response->json('data.uuid'))->firstOrFail();
        $this->assertSame($client->id, $ticket->client_id);
        $this->assertSame($user->id, $ticket->created_by);
        $this->assertSame($ownWarranty->id, $ticket->warranty_id);
        $this->assertDatabaseCount('tickets', 1);
    }

    public function test_ticket_history_and_repair_outcome_never_expose_internal_fields(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $otherClient = Client::factory()->create();
        $clientUser = $this->clientUser($client);
        $ownTicket = $this->ticket($client, $admin, $this->warranty($client, $this->product('PORTAL-TICKET'), 'TICKET-OWN'));
        $otherTicket = $this->ticket($otherClient, $admin, $this->warranty($otherClient, $this->product('PORTAL-HIDDEN'), 'TICKET-HIDDEN'));
        $ownTicket->statusHistory()->create([
            'from_status' => 'opened',
            'to_status' => 'received',
            'transitioned_by' => $admin->id,
            'notes' => 'Internal technician transition note.',
            'transitioned_at' => now(),
        ]);
        $technician = $this->technician();
        $repair = Repair::query()->create([
            'ticket_id' => $ownTicket->id,
            'technician_id' => $technician->id,
            'diagnosis' => 'Power delivery failure confirmed.',
            'root_cause' => 'Supplier batch analysis is internal.',
            'repair_action' => 'Power board replaced.',
            'internal_notes' => 'Never show this technician note.',
            'customer_notes' => 'The unit passed final testing.',
            'labor_cost' => 500,
            'parts_cost' => 700,
            'total_cost' => 1200,
            'started_at' => now()->subHour(),
            'completed_at' => now(),
            'result' => 'repaired',
        ]);

        $this->actingAs($clientUser)->getJson('/api/client/tickets')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $ownTicket->uuid)
            ->assertJsonMissing(['uuid' => $otherTicket->uuid]);

        $this->actingAs($clientUser)->getJson("/api/client/tickets/{$ownTicket->uuid}")
            ->assertOk()
            ->assertJsonPath('data.repair_outcome.result', 'repaired')
            ->assertJsonPath('data.repair_outcome.customer_notes', 'The unit passed final testing.')
            ->assertJsonMissingPath('data.repair_outcome.internal_notes')
            ->assertJsonMissingPath('data.repair_outcome.root_cause')
            ->assertJsonMissingPath('data.repair_outcome.labor_cost')
            ->assertJsonMissingPath('data.status_timeline.0.notes')
            ->assertJsonMissingPath('data.status_timeline.0.transitioned_by');

        $realtimeRepair = app(RealtimePayloadService::class)->repair($repair);
        $realtimeTicket = app(RealtimePayloadService::class)->ticket($ownTicket->fresh());
        $this->assertArrayNotHasKey('internal_notes', $realtimeRepair);
        $this->assertArrayNotHasKey('root_cause', $realtimeRepair);
        $this->assertArrayNotHasKey('status_history', $realtimeTicket);

        $this->actingAs($clientUser)->getJson("/api/client/tickets/{$otherTicket->uuid}")->assertNotFound();
        $this->actingAs($clientUser)->getJson("/api/tickets/{$ownTicket->uuid}")->assertForbidden();
        $this->actingAs($clientUser)->getJson('/api/repairs/'.$ownTicket->repair->id)->assertForbidden();
        $this->actingAs($clientUser)->getJson('/api/audit-logs')->assertForbidden();
    }

    public function test_client_can_approve_only_their_own_repair_plan_once(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $otherClient = Client::factory()->create();
        $clientUser = $this->clientUser($client);
        $otherClientUser = $this->clientUser($otherClient);
        $technician = $this->technician();
        $ticket = $this->ticket(
            $client,
            $admin,
            $this->warranty($client, $this->product('PORTAL-APPROVAL'), 'APPROVAL-OWN'),
        );
        $ticket->forceFill([
            'status' => TicketStatus::AwaitingCustomerApproval,
            'assigned_technician_id' => $technician->id,
        ])->save();
        $repair = Repair::query()->create([
            'ticket_id' => $ticket->id,
            'technician_id' => $technician->id,
            'customer_notes' => 'Please approve replacement of the paper-feed assembly.',
        ]);

        $this->actingAs($otherClientUser)
            ->postJson("/api/client/tickets/{$ticket->uuid}/repair-approval", [
                'decision' => 'approved',
            ])
            ->assertNotFound();

        $this->actingAs($clientUser)
            ->postJson("/api/client/tickets/{$ticket->uuid}/repair-approval", [
                'decision' => 'approved',
                'notes' => 'Approved. Please continue with the repair.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'diagnosing')
            ->assertJsonPath('data.can_respond_to_repair_approval', false);

        $this->assertDatabaseHas('tickets', [
            'id' => $ticket->id,
            'status' => TicketStatus::Diagnosing->value,
        ]);
        $this->assertDatabaseHas('ticket_status_histories', [
            'ticket_id' => $ticket->id,
            'from_status' => TicketStatus::AwaitingCustomerApproval->value,
            'to_status' => TicketStatus::Diagnosing->value,
            'transitioned_by' => $clientUser->id,
        ]);
        $this->assertDatabaseHas('repair_histories', [
            'repair_id' => $repair->id,
            'event' => 'customer_approval_approved',
            'changed_by' => $clientUser->id,
        ]);

        $this->actingAs($clientUser)
            ->postJson("/api/client/tickets/{$ticket->uuid}/repair-approval", [
                'decision' => 'approved',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('decision');
    }

    public function test_client_can_request_changes_to_a_repair_plan(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $clientUser = $this->clientUser($client);
        $technician = $this->technician();
        $ticket = $this->ticket(
            $client,
            $admin,
            $this->warranty($client, $this->product('PORTAL-CHANGES'), 'CHANGES-OWN'),
        );
        $ticket->forceFill([
            'status' => TicketStatus::AwaitingCustomerApproval,
            'assigned_technician_id' => $technician->id,
        ])->save();
        $repair = Repair::query()->create([
            'ticket_id' => $ticket->id,
            'technician_id' => $technician->id,
            'started_at' => now()->subHours(2),
            'completed_at' => now()->subHour(),
            'result' => 'replacement_required',
        ]);

        $this->actingAs($clientUser)
            ->postJson("/api/client/tickets/{$ticket->uuid}/repair-approval", [
                'decision' => 'changes_requested',
                'notes' => 'Please contact me with an alternative before continuing.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'diagnosing');

        $this->assertDatabaseHas('repair_histories', [
            'repair_id' => $repair->id,
            'event' => 'customer_approval_changes_requested',
            'changed_by' => $clientUser->id,
        ]);
        $this->assertDatabaseHas('repairs', [
            'id' => $repair->id,
            'completed_at' => null,
            'result' => null,
        ]);
    }

    public function test_client_uploads_are_private_and_staff_attachments_are_not_visible_in_the_portal(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $otherClient = Client::factory()->create();
        $clientUser = $this->clientUser($client);
        $otherUser = $this->clientUser($otherClient);
        $ticket = $this->ticket($client, $admin, $this->warranty($client, $this->product('PORTAL-FILE'), 'FILE-OWN'));
        $otherTicket = $this->ticket($otherClient, $admin, $this->warranty($otherClient, $this->product('PORTAL-FILE-OTHER'), 'FILE-OTHER'));
        $staffAttachment = $this->attachment($ticket, $admin, 'internal-diagnostic.txt', 'private staff document');
        $ownAttachment = $this->attachment($ticket, $clientUser, 'customer-proof.txt', 'customer document');
        $otherAttachment = $this->attachment($otherTicket, $otherUser, 'other-client.txt', 'other customer document');

        $this->actingAs($clientUser)->getJson("/api/client/tickets/{$ticket->uuid}/attachments")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $ownAttachment->uuid)
            ->assertJsonMissing(['uuid' => $staffAttachment->uuid]);

        $this->actingAs($clientUser)->get("/api/attachments/{$ownAttachment->uuid}/download")->assertOk();
        $this->actingAs($clientUser)->get("/api/attachments/{$staffAttachment->uuid}/download")->assertNotFound();
        $this->actingAs($clientUser)->get("/api/attachments/{$otherAttachment->uuid}/download")->assertNotFound();
        $this->actingAs($clientUser)->post("/api/client/tickets/{$otherTicket->uuid}/attachments", [
            'file' => UploadedFile::fake()->createWithContent('forbidden.txt', 'forbidden client file'),
        ], ['Accept' => 'application/json'])->assertNotFound();

        $this->actingAs($clientUser)->post("/api/client/tickets/{$ticket->uuid}/attachments", [
            'file' => UploadedFile::fake()->createWithContent('damage.txt', 'customer damage description'),
        ], ['Accept' => 'application/json'])->assertCreated();
        $this->assertDatabaseHas('attachments', ['attachable_id' => $ticket->id, 'uploaded_by' => $clientUser->id, 'original_filename' => 'damage.txt']);
    }

    public function test_linked_client_receives_scoped_database_notifications_with_portal_links(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $clientUser = $this->clientUser($client);
        $warranty = $this->warranty($client, $this->product('PORTAL-NOTIFY'), 'NOTIFY-OWN');

        $this->actingAs($admin)->postJson('/api/tickets', [
            'client_id' => $client->id,
            'product_id' => $warranty->product_id,
            'warranty_id' => $warranty->id,
            'title' => 'Notification portal request',
            'problem_description' => 'The client must receive updates even when staff created the ticket.',
            'priority' => 'normal',
            'source' => 'web',
        ])->assertCreated();

        $ticket = Ticket::query()->latest('id')->firstOrFail();
        $notification = $clientUser->notifications()->firstOrFail();
        $this->actingAs($clientUser)->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.id', $notification->id)
            ->assertJsonPath('data.0.action_url', "/client/tickets/{$ticket->uuid}");
        Queue::assertPushed(SendQueuedNotifications::class);
    }

    public function test_client_account_linking_requires_an_exclusive_client_role_and_profile(): void
    {
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $basePayload = [
            'first_name' => 'Portal',
            'last_name' => 'User',
            'email' => 'portal-user@example.test',
            'phone' => null,
            'status' => 'active',
            'locale' => 'en',
            'timezone' => 'Africa/Casablanca',
            'password' => 'Correct-Horse-Battery-123',
            'password_confirmation' => 'Correct-Horse-Battery-123',
        ];

        $this->actingAs($admin)->postJson('/api/users', [...$basePayload, 'roles' => ['client']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('client_id');
        $this->actingAs($admin)->postJson('/api/users', [...$basePayload, 'client_id' => $client->id, 'roles' => ['client', 'sav_agent']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('roles');
        $this->actingAs($admin)->postJson('/api/users', [...$basePayload, 'client_id' => $client->id, 'roles' => ['client']])
            ->assertCreated()
            ->assertJsonPath('data.client.uuid', $client->uuid);
    }

    public function test_a_legacy_mixed_client_and_staff_role_account_is_denied_all_privileged_surfaces(): void
    {
        $client = Client::factory()->create();
        $misconfiguredUser = $this->clientUser($client);
        $misconfiguredUser->assignRole('admin');
        $product = $this->product('PORTAL-MIXED-ROLE');

        $this->actingAs($misconfiguredUser)->getJson('/api/audit-logs')->assertForbidden();
        $this->actingAs($misconfiguredUser)->getJson('/api/clients')->assertForbidden();
        $this->actingAs($misconfiguredUser)->getJson("/api/products/{$product->uuid}")->assertForbidden();
        $this->actingAs($misconfiguredUser)->getJson('/api/dashboard')->assertForbidden();
        $this->actingAs($misconfiguredUser)->getJson('/api/client/profile')->assertForbidden();
    }

    /** @param array<string, mixed> $attributes */
    private function clientUser(Client $client, array $attributes = []): User
    {
        return $this->user('client', ['client_id' => $client->id, ...$attributes]);
    }

    /** @param array<string, mixed> $attributes */
    private function user(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
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

    private function warranty(Client $client, Product $product, string $serial): Warranty
    {
        return Warranty::query()->create([
            'uuid' => (string) Str::uuid(),
            'customer_id' => $client->id,
            'product_id' => $product->id,
            'serial_number' => $serial,
            'quantity' => 1,
            'purchase_date' => today()->subMonth(),
            'warranty_end' => today()->addYear(),
            'starts_at' => today()->subMonth(),
            'expires_at' => today()->addYear(),
            'status' => 'active',
        ]);
    }

    private function ticket(Client $client, User $actor, Warranty $warranty): Ticket
    {
        return Ticket::query()->create([
            'uuid' => (string) Str::uuid(),
            'ticket_number' => 'TKT-PORTAL-'.Str::upper(Str::random(8)),
            'customer_id' => $client->id,
            'client_id' => $client->id,
            'customer_product_id' => $warranty->id,
            'warranty_id' => $warranty->id,
            'product_id' => $warranty->product_id,
            'title' => 'Portal ticket issue',
            'problem_description' => 'A customer-visible ticket used for portal authorization tests.',
            'priority' => 'normal',
            'status' => 'opened',
            'source' => 'web',
            'warranty_eligible' => true,
            'created_by' => $actor->id,
            'received_at' => now(),
        ]);
    }

    private function technician(): Technician
    {
        $user = $this->user('technician');

        return Technician::query()->create([
            'user_id' => $user->id,
            'employee_code' => 'PORTAL-'.Str::upper(Str::random(6)),
            'skill_level' => 3,
            'availability_status' => 'available',
        ]);
    }

    private function attachment(Ticket $ticket, User $uploader, string $filename, string $contents): Attachment
    {
        $path = "ticket/{$ticket->id}/".Str::uuid().'.txt';
        Storage::disk('portal_test')->put($path, $contents);

        return $ticket->attachments()->create([
            'uuid' => (string) Str::uuid(),
            'uploaded_by' => $uploader->id,
            'disk' => 'portal_test',
            'path' => $path,
            'original_filename' => $filename,
            'stored_filename' => basename($path),
            'mime_type' => 'text/plain',
            'size' => strlen($contents),
        ]);
    }
}
