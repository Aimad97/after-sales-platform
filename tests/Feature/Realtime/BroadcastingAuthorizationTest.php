<?php

namespace Tests\Feature\Realtime;

use App\Enums\NotificationType;
use App\Events\NotificationCreated;
use App\Events\RepairUpdated;
use App\Events\TicketUpdated;
use App\Models\Client;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\DatabaseSavNotification;
use App\Notifications\SavNotificationData;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BroadcastingAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        config(['broadcasting.default' => 'reverb']);
        Broadcast::forgetDrivers();
        require base_path('routes/channels.php');
    }

    public function test_only_the_owner_can_authorize_a_private_user_channel(): void
    {
        $owner = $this->user('admin');
        $otherUser = $this->user('admin');

        Sanctum::actingAs($owner);
        $this->postJson('/api/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => "private-user.{$owner->id}",
        ])
            ->assertOk()
            ->assertJsonStructure(['auth']);

        Sanctum::actingAs($otherUser);
        $this->postJson('/api/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => "private-user.{$owner->id}",
        ])
            ->assertForbidden();

        $this->actingAsGuest('sanctum');
        $this->postJson('/api/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => "private-user.{$owner->id}",
        ])->assertUnauthorized();
    }

    public function test_ticket_channel_uses_the_ticket_policy_and_never_exposes_tickets_to_clients(): void
    {
        $agent = $this->user('sav_agent');
        $client = Client::factory()->create();
        $ticket = $this->ticket($client, $agent);
        $unprivilegedUser = User::factory()->create();
        $clientUser = $this->user('client');

        Sanctum::actingAs($agent);
        $this->postJson('/api/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => "private-ticket.{$ticket->id}",
        ])
            ->assertOk();

        Sanctum::actingAs($unprivilegedUser);
        $this->postJson('/api/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => "private-ticket.{$ticket->id}",
        ])
            ->assertForbidden();

        Sanctum::actingAs($clientUser);
        $this->postJson('/api/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => "private-ticket.{$ticket->id}",
        ])
            ->assertForbidden();
    }

    public function test_realtime_ticket_event_uses_private_ticket_and_recipient_channels(): void
    {
        $agent = $this->user('sav_agent');
        $ticket = $this->ticket(Client::factory()->create(), $agent);
        $event = new TicketUpdated($ticket, $agent, [$agent->id], ['uuid' => $ticket->uuid]);

        $this->assertSame('ticket.updated', $event->broadcastAs());
        $this->assertSame([
            "private-ticket.{$ticket->id}",
            "private-user.{$agent->id}",
        ], array_map(static fn ($channel): string => (string) $channel, $event->broadcastOn()));
        $this->assertSame([
            'ticket' => ['uuid' => $ticket->uuid],
            'actor_id' => $agent->id,
        ], $event->broadcastWith());
    }

    public function test_database_sav_notifications_emit_a_private_realtime_event(): void
    {
        $recipient = $this->user('admin');
        Event::fake([NotificationCreated::class]);

        Notification::sendNow($recipient, new DatabaseSavNotification(new SavNotificationData(
            NotificationType::TicketCreated,
            'Ticket created',
            'A ticket has been created.',
            '/admin/tickets/example',
        )));

        Event::assertDispatched(NotificationCreated::class, function (NotificationCreated $event) use ($recipient): bool {
            return $event->recipient->is($recipient)
                && $event->broadcastAs() === 'notification.created'
                && $event->broadcastWith()['notification']['type'] === NotificationType::TicketCreated->value
                && (string) $event->broadcastOn()[0] === "private-user.{$recipient->id}";
        });
    }

    public function test_repair_updates_are_sent_only_to_repair_authorized_user_channels(): void
    {
        $recipient = $this->user('admin');
        $repair = new Repair(['ticket_id' => 99]);
        $repair->id = 42;
        $event = new RepairUpdated($repair, $recipient, [$recipient->id], [], []);

        $this->assertSame('repair.updated', $event->broadcastAs());
        $this->assertSame([
            "private-user.{$recipient->id}",
        ], array_map(static fn ($channel): string => (string) $channel, $event->broadcastOn()));
    }

    private function ticket(Client $client, User $actor): Ticket
    {
        $suffix = Str::lower(Str::random(8));
        $now = now();
        $brandId = DB::table('brands')->insertGetId([
            'name' => "Realtime Brand {$suffix}",
            'slug' => "realtime-brand-{$suffix}",
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $categoryId = DB::table('categories')->insertGetId([
            'name' => "Realtime Category {$suffix}",
            'slug' => "realtime-category-{$suffix}",
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $product = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => "REALTIME-{$suffix}",
            'name' => 'Realtime Product',
            'slug' => "realtime-product-{$suffix}",
            'brand_id' => $brandId,
            'category_id' => $categoryId,
            'model' => 'REALTIME-100',
            'default_warranty_months' => 24,
            'serial_number_required' => false,
            'active' => true,
        ]);

        return Ticket::query()->create([
            'uuid' => (string) Str::uuid(),
            'ticket_number' => "TKT-REALTIME-{$suffix}",
            'customer_id' => $client->id,
            'client_id' => $client->id,
            'product_id' => $product->id,
            'title' => 'Realtime authorization test',
            'problem_description' => 'A ticket used to verify private broadcasting authorization.',
            'priority' => 'normal',
            'status' => 'opened',
            'source' => 'web',
            'warranty_eligible' => false,
            'created_by' => $actor->id,
            'received_at' => $now,
        ]);
    }

    private function user(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
