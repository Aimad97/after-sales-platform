<?php

namespace Tests\Feature\Notifications;

use App\Models\Client;
use App\Models\Product;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationSystemTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Queue::fake();
    }

    public function test_ticket_events_create_database_notifications_and_queue_email_delivery(): void
    {
        $admin = $this->user('admin');
        $ticket = $this->ticket($admin);

        $createdNotification = $admin->notifications()->firstOrFail();
        $this->assertSame('ticket_created', $createdNotification->data['type']);
        Queue::assertPushed(SendQueuedNotifications::class);

        $technicianUser = $this->user('technician');
        $technician = Technician::query()->create([
            'user_id' => $technicianUser->id,
            'employee_code' => 'NOTIFY-TECH-001',
            'skill_level' => 3,
            'availability_status' => 'available',
        ]);

        $this->actingAs($admin)
            ->postJson("/api/tickets/{$ticket->uuid}/assign", [
                'assigned_technician_id' => $technician->id,
            ])
            ->assertOk();

        $this->assertTrue(
            $technicianUser->fresh()->notifications
                ->contains(fn ($notification): bool => $notification->data['type'] === 'technician_assigned'),
        );

        $this->actingAs($admin)
            ->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'received'])
            ->assertOk();

        $this->assertTrue(
            $admin->fresh()->notifications
                ->contains(fn ($notification): bool => $notification->data['type'] === 'ticket_status_changed'),
        );
    }

    public function test_notification_endpoints_are_scoped_to_the_authenticated_user_and_manage_read_state(): void
    {
        $admin = $this->user('admin');
        $otherAdmin = $this->user('admin');
        $ticket = $this->ticket($admin);
        $notification = $admin->notifications()->firstOrFail();

        $this->actingAs($admin)
            ->getJson('/api/notifications?unread=true')
            ->assertOk()
            ->assertJsonPath('data.0.id', $notification->id)
            ->assertJsonPath('data.0.type', 'ticket_created');

        $this->actingAs($admin)
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('data.count', 1);

        $this->actingAs($otherAdmin)
            ->patchJson("/api/notifications/{$notification->id}/read")
            ->assertNotFound();

        $this->actingAs($admin)
            ->patchJson("/api/notifications/{$notification->id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $notification->id);
        $this->assertNotNull($notification->fresh()->read_at);

        $this->ticket($admin);
        $this->actingAs($admin)
            ->postJson('/api/notifications/mark-all-read')
            ->assertOk()
            ->assertJsonPath('data.marked_as_read', 1);
        $this->assertSame(0, $admin->fresh()->unreadNotifications()->count());
    }

    public function test_notification_endpoints_require_authentication(): void
    {
        $this->getJson('/api/notifications')->assertUnauthorized();
        $this->getJson('/api/notifications/unread-count')->assertUnauthorized();
    }

    public function test_repair_workflow_emits_diagnosis_approval_completion_and_pickup_notifications(): void
    {
        $admin = $this->user('admin');
        $technicianUser = $this->user('technician');
        $technician = Technician::query()->create([
            'user_id' => $technicianUser->id,
            'employee_code' => 'NOTIFY-REPAIR-TECH-001',
            'skill_level' => 3,
            'availability_status' => 'available',
        ]);
        $ticket = $this->ticket($admin);

        $this->actingAs($admin)->postJson("/api/tickets/{$ticket->uuid}/assign", [
            'assigned_technician_id' => $technician->id,
        ])->assertOk();
        $this->actingAs($admin)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'received'])->assertOk();
        $this->actingAs($admin)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'awaiting_diagnosis'])->assertOk();
        $this->actingAs($technicianUser)->postJson("/api/tickets/{$ticket->uuid}/repair/diagnosis")->assertCreated();

        $repair = $ticket->fresh()->repair()->firstOrFail();
        $this->actingAs($technicianUser)->postJson("/api/repairs/{$repair->id}/diagnosis", [
            'diagnosis' => 'The main board has a recoverable power fault.',
            'labor_cost' => '50.00',
            'parts_cost' => '150.00',
            'next_status' => 'awaiting_customer_approval',
        ])->assertOk();
        $this->assertNotificationType($admin, 'diagnosis_completed');
        $this->assertNotificationType($admin, 'awaiting_customer_approval');

        $this->actingAs($admin)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'diagnosing'])->assertOk();
        $this->actingAs($technicianUser)->postJson("/api/repairs/{$repair->id}/start")->assertOk();
        $this->actingAs($technicianUser)->postJson("/api/repairs/{$repair->id}/complete", [
            'result' => 'repaired',
        ])->assertOk();
        $this->assertNotificationType($admin, 'repair_completed');

        $this->actingAs($admin)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'repaired'])->assertOk();
        $this->actingAs($admin)->postJson("/api/tickets/{$ticket->uuid}/transition", ['status' => 'ready_for_pickup'])->assertOk();
        $this->assertNotificationType($admin, 'ready_for_pickup');
    }

    public function test_enabled_warranty_expiration_alerts_are_idempotent(): void
    {
        config([
            'notifications.warranty_expiration.enabled' => true,
            'notifications.warranty_expiration.days_before_expiry' => 30,
        ]);
        $admin = $this->user('admin');
        $client = Client::factory()->create();
        $product = $this->product();
        $warranty = Warranty::query()->create([
            'uuid' => (string) Str::uuid(),
            'customer_id' => $client->id,
            'product_id' => $product->id,
            'serial_number' => 'NOTIFY-WARRANTY-001',
            'quantity' => 1,
            'purchase_date' => today()->subMonths(11),
            'warranty_end' => today()->addDays(30),
            'starts_at' => today()->subMonths(11),
            'expires_at' => today()->addDays(30),
            'status' => 'active',
        ]);

        $this->artisan('notifications:send-warranty-expiration')
            ->expectsOutputToContain('Dispatched 1 warranty expiration notification')
            ->assertSuccessful();
        $this->artisan('notifications:send-warranty-expiration')
            ->expectsOutputToContain('Dispatched 0 warranty expiration notification')
            ->assertSuccessful();

        $this->assertDatabaseHas('warranty_expiration_notification_logs', [
            'warranty_id' => $warranty->id,
            'days_before_expiry' => 30,
        ]);
        $this->assertDatabaseCount('warranty_expiration_notification_logs', 1);
        $this->assertTrue(
            $admin->fresh()->notifications
                ->contains(fn ($notification): bool => $notification->data['type'] === 'warranty_nearing_expiration'),
        );
    }

    private function ticket(User $actor): Ticket
    {
        $client = Client::factory()->create();
        $product = $this->product();

        $this->actingAs($actor)
            ->postJson('/api/tickets', [
                'client_id' => $client->id,
                'product_id' => $product->id,
                'title' => 'Notification test ticket',
                'problem_description' => 'A ticket used to verify notification delivery.',
                'priority' => 'normal',
                'source' => 'web',
            ])
            ->assertCreated();

        return Ticket::query()->latest('id')->firstOrFail();
    }

    private function product(): Product
    {
        $suffix = Str::lower(Str::random(8));
        $now = now();
        $brandId = DB::table('brands')->insertGetId([
            'name' => "Notification Brand {$suffix}",
            'slug' => "notification-brand-{$suffix}",
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $categoryId = DB::table('categories')->insertGetId([
            'name' => "Notification Category {$suffix}",
            'slug' => "notification-category-{$suffix}",
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => "NOTIFY-{$suffix}",
            'name' => 'Notification Product',
            'slug' => "notification-product-{$suffix}",
            'brand_id' => $brandId,
            'category_id' => $categoryId,
            'model' => 'NOTIFY-100',
            'default_warranty_months' => 24,
            'serial_number_required' => true,
            'active' => true,
        ]);
    }

    private function user(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function assertNotificationType(User $user, string $type): void
    {
        $this->assertTrue(
            $user->fresh()->notifications
                ->contains(fn ($notification): bool => $notification->data['type'] === $type),
        );
    }
}
