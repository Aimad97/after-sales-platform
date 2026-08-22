<?php

namespace Tests\Feature\Seeders;

use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use App\Services\DashboardMetricsService;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class DemoDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_a_realistic_connected_dataset_for_every_dashboard_dimension(): void
    {
        $this->seed(DemoDataSeeder::class);

        $this->assertSame(18, Client::query()->count());
        $this->assertSame(8, Brand::query()->count());
        $this->assertSame(6, Category::query()->count());
        $this->assertSame(18, Product::query()->count());
        $this->assertSame(36, Invoice::query()->count());
        $this->assertSame(56, Warranty::query()->count());
        $this->assertSame(72, Ticket::query()->count());
        $this->assertGreaterThan(20, Repair::query()->count());
        $this->assertSame(6, Technician::query()->count());
        $this->assertSame(114, DatabaseNotification::query()->count());

        foreach (TicketStatus::cases() as $status) {
            $this->assertTrue(Ticket::query()->where('status', $status->value)->exists(), "Missing {$status->value} tickets.");
        }

        foreach (TicketPriority::cases() as $priority) {
            $this->assertTrue(Ticket::query()->where('priority', $priority->value)->exists(), "Missing {$priority->value} tickets.");
        }

        $this->assertTrue(Ticket::query()->where('warranty_eligible', true)->exists());
        $this->assertTrue(Ticket::query()->where('warranty_eligible', false)->exists());
        $this->assertTrue(Ticket::query()->whereNotNull('assigned_technician_id')->exists());
        $this->assertTrue(Ticket::query()->whereNull('assigned_technician_id')->exists());
        $this->assertSame(
            6,
            Ticket::query()->get()->map(fn (Ticket $ticket): string => $ticket->created_at->format('Y-m'))->unique()->count(),
        );

        Ticket::query()->whereNotNull('warranty_id')->with('warranty')->each(function (Ticket $ticket): void {
            $this->assertSame($ticket->client_id, $ticket->warranty->customer_id);
            $this->assertSame($ticket->product_id, $ticket->warranty->product_id);
        });

        Warranty::query()->with('invoiceItem.invoice')->each(function (Warranty $warranty): void {
            $this->assertNotNull($warranty->invoiceItem);
            $this->assertSame($warranty->customer_id, $warranty->invoiceItem->invoice->client_id);
            $this->assertSame($warranty->product_id, $warranty->invoiceItem->product_id);
        });

        $admin = User::query()->where('email', 'admin@servicedesk.test')->firstOrFail();
        $dashboard = app(DashboardMetricsService::class)->for($admin);

        $this->assertTrue($admin->hasRole('admin'));
        $this->assertTrue(Hash::check((string) config('demo.password'), $admin->password));
        $this->assertNotEmpty($dashboard['technicians']['workload']);
        $this->assertTrue(collect($dashboard['technicians']['performance'])->contains('completed_count', '>', 0));
        $this->assertTrue(collect($dashboard['charts']['tickets_by_month'])->every(fn (array $point): bool => $point['value'] > 0));
        $this->assertTrue(collect($dashboard['charts']['tickets_by_status'])->every(fn (array $point): bool => $point['value'] > 0));
        $this->assertGreaterThan(0, $dashboard['charts']['warranty_claims']['covered']);
        $this->assertGreaterThan(0, $dashboard['charts']['warranty_claims']['out_of_warranty']);
    }

    public function test_primary_demo_accounts_cover_each_login_role(): void
    {
        $this->seed(DemoDataSeeder::class);

        $accounts = [
            'superadmin@servicedesk.test' => 'super_admin',
            'admin@servicedesk.test' => 'admin',
            'agent@servicedesk.test' => 'sav_agent',
            'technician@servicedesk.test' => 'technician',
            'client@servicedesk.test' => 'client',
        ];

        foreach ($accounts as $email => $role) {
            $user = User::query()->where('email', $email)->firstOrFail();

            $this->assertTrue($user->hasRole($role));
            $this->assertTrue(Hash::check((string) config('demo.password'), $user->password));
        }

        $this->assertNotNull(User::query()->where('email', 'technician@servicedesk.test')->firstOrFail()->technician);
        $this->assertNotNull(User::query()->where('email', 'client@servicedesk.test')->firstOrFail()->client);
    }

    public function test_demo_seeder_refuses_to_run_in_production(): void
    {
        $originalEnvironment = $this->app['env'];
        $this->app['env'] = 'production';

        try {
            app(DemoDataSeeder::class)->run();
            $this->fail('The demo seeder ran in production.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('local or testing', $exception->getMessage());
        } finally {
            $this->app['env'] = $originalEnvironment;
        }

        $this->assertDatabaseCount('users', 0);
    }
}
