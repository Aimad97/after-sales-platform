<?php

namespace Tests\Feature\Reports;

use App\Enums\ReportExportStatus;
use App\Jobs\GenerateReportExport;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Client;
use App\Models\Product;
use App\Models\Repair;
use App\Models\ReportExport;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use App\Services\ReportService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReportingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_reports_require_authentication_and_the_reports_view_permission(): void
    {
        $this->getJson('/api/reports/tickets')->assertUnauthorized();

        $this->actingAs($this->userWithRole('sav_agent'))
            ->getJson('/api/reports/tickets')
            ->assertForbidden();

        $this->actingAs($this->userWithRole('client'))
            ->getJson('/api/reports/tickets')
            ->assertForbidden();

        $this->actingAs($this->userWithRole('admin'))
            ->getJson('/api/reports/tickets')
            ->assertOk()
            ->assertJsonPath('report_type', 'tickets');
    }

    public function test_an_authorized_user_can_request_each_supported_report_type(): void
    {
        $admin = $this->userWithRole('admin');

        foreach ([
            'tickets',
            'repairs',
            'warranties',
            'technician_performance',
            'defective_products',
            'client_history',
        ] as $type) {
            $this->actingAs($admin)
                ->getJson("/api/reports/{$type}")
                ->assertOk()
                ->assertJsonPath('report_type', $type)
                ->assertJsonStructure([
                    'data',
                    'columns',
                    'filters',
                    'meta' => ['current_page', 'last_page', 'per_page', 'total'],
                    'links',
                ]);
        }
    }

    public function test_ticket_repair_warranty_and_client_history_reports_apply_their_filters(): void
    {
        $admin = $this->userWithRole('admin');
        $technician = $this->technician();
        $client = Client::factory()->create();
        $otherClient = Client::factory()->create();
        [$product, $brand, $category] = $this->product('REPORT-MATCH');
        [$otherProduct] = $this->product('REPORT-OTHER');
        $activeWarranty = $this->warranty($client, $product, 'REPORT-ACTIVE-001');
        $expiredWarranty = $this->warranty($client, $product, 'REPORT-EXPIRED-001', [
            'status' => 'active',
            'expires_at' => today()->subDay(),
            'warranty_end' => today()->subDay(),
        ]);
        $otherWarranty = $this->warranty($otherClient, $otherProduct, 'REPORT-OTHER-001');

        $matchingTicket = $this->ticket($admin, $client, $product, $activeWarranty, 'Matching report ticket');
        $otherTicket = $this->ticket($admin, $otherClient, $otherProduct, $otherWarranty, 'Other report ticket');
        $reportedAt = now()->subDays(2)->setTime(10, 0);

        DB::table('tickets')->where('id', $matchingTicket->id)->update([
            'assigned_technician_id' => $technician->id,
            'status' => 'repairing',
            'priority' => 'urgent',
            'warranty_eligible' => true,
            'received_at' => $reportedAt,
            'created_at' => $reportedAt,
            'updated_at' => $reportedAt,
        ]);
        DB::table('tickets')->where('id', $otherTicket->id)->update([
            'status' => 'closed',
            'priority' => 'low',
            'warranty_eligible' => false,
            'received_at' => now()->subDay(),
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);

        Repair::query()->create([
            'ticket_id' => $matchingTicket->id,
            'technician_id' => $technician->id,
            'started_at' => $reportedAt,
            'completed_at' => $reportedAt->copy()->addHours(2),
            'result' => 'partially_repaired',
            'labor_cost' => 120,
            'parts_cost' => 80,
            'total_cost' => 200,
        ]);

        $ticketQuery = http_build_query([
            'date_from' => $reportedAt->toDateString(),
            'date_to' => $reportedAt->toDateString(),
            'technician_id' => $technician->id,
            'status' => 'repairing',
            'priority' => 'urgent',
            'brand_id' => $brand->id,
            'category_id' => $category->id,
            'product_id' => $product->id,
            'warranty_state' => 'active',
        ]);

        $this->actingAs($admin)->getJson("/api/reports/tickets?{$ticketQuery}")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.ticket_number', $matchingTicket->ticket_number)
            ->assertJsonPath('filters.status', 'repairing')
            ->assertJsonPath('filters.technician_id', (string) $technician->id);

        $this->actingAs($admin)->getJson('/api/reports/repairs?'.http_build_query([
            'technician_id' => $technician->id,
            'status' => 'partially_repaired',
            'product_id' => $product->id,
        ]))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.ticket_number', $matchingTicket->ticket_number);

        $this->actingAs($admin)->getJson('/api/reports/warranties?'.http_build_query([
            'product_id' => $product->id,
            'warranty_state' => 'expired',
        ]))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.serial_number', $expiredWarranty->serial_number);

        $this->actingAs($admin)->getJson('/api/reports/client_history?client_id='.$client->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.ticket_number', $matchingTicket->ticket_number);
    }

    public function test_report_filters_validate_the_date_range_and_known_values(): void
    {
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)->getJson('/api/reports/tickets?date_from=2026-08-10&date_to=2026-08-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_to');

        $this->actingAs($admin)->getJson('/api/reports/tickets?status=not-a-ticket-status')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->actingAs($admin)->postJson('/api/reports/tickets/exports', ['format' => 'xlsx'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('format');
    }

    public function test_csv_exports_are_queued_and_are_only_available_to_authorized_users(): void
    {
        Queue::fake();
        Storage::fake('local');

        $owner = $this->userWithRole('admin');
        $otherAdmin = $this->userWithRole('admin');
        $technician = $this->userWithRole('technician');

        $response = $this->actingAs($owner)->postJson('/api/reports/tickets/exports', [
            'format' => 'csv',
            'status' => 'opened',
        ]);

        $response->assertAccepted()
            ->assertJsonPath('data.report_type', 'tickets')
            ->assertJsonPath('data.format', 'csv')
            ->assertJsonPath('data.status', ReportExportStatus::Queued->value);

        $uuid = (string) $response->json('data.uuid');
        $export = ReportExport::query()->where('uuid', $uuid)->firstOrFail();

        $this->assertSame($owner->id, $export->requested_by);
        $this->assertSame(ReportExportStatus::Queued, $export->status);
        Queue::assertPushed(GenerateReportExport::class);

        $this->actingAs($owner)->getJson("/api/reports/exports/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.uuid', $uuid)
            ->assertJsonPath('data.status', ReportExportStatus::Queued->value);

        $this->actingAs($otherAdmin)->getJson("/api/reports/exports/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.uuid', $uuid);

        $this->actingAs($technician)->getJson("/api/reports/exports/{$uuid}")
            ->assertForbidden();

        $path = "reports/{$uuid}.csv";
        Storage::disk('local')->put($path, "Ticket number,Status\n{$uuid},opened\n");
        $export->update([
            'status' => ReportExportStatus::Completed,
            'disk' => 'local',
            'path' => $path,
            'filename' => 'tickets-report.csv',
            'mime_type' => 'text/csv',
            'expires_at' => now()->addDay(),
        ]);

        $this->actingAs($owner)->get("/api/reports/exports/{$uuid}/download")
            ->assertOk()
            ->assertDownload('tickets-report.csv');

        $this->actingAs($technician)->getJson("/api/reports/exports/{$uuid}/download")
            ->assertForbidden();

        $export->update(['expires_at' => now()->subMinute()]);

        $this->actingAs($owner)->getJson("/api/reports/exports/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.status', ReportExportStatus::Expired->value)
            ->assertJsonPath('data.download_url', null);

        $this->actingAs($owner)->get("/api/reports/exports/{$uuid}/download")
            ->assertGone();
    }

    public function test_report_export_job_generates_a_private_csv_and_safely_escapes_formula_values(): void
    {
        Storage::fake('report_exports');

        $owner = $this->userWithRole('admin');
        $client = Client::factory()->create(['first_name' => '=CLIENT-FORMULA']);
        [$product] = $this->product('REPORT-CSV');
        $product->update(['name' => '=PRODUCT-FORMULA']);
        $warranty = $this->warranty($client, $product, 'REPORT-CSV-001');
        $this->ticket($owner, $client, $product, $warranty, 'CSV report ticket');

        $export = ReportExport::query()->create([
            'requested_by' => $owner->id,
            'report_type' => 'tickets',
            'format' => 'csv',
            'filters' => ['status' => 'opened'],
            'status' => ReportExportStatus::Queued,
        ]);

        (new GenerateReportExport($export->id))->handle(app(ReportService::class));

        $export->refresh();

        $this->assertSame(ReportExportStatus::Completed, $export->status);
        $this->assertSame(1, $export->row_count);
        $this->assertSame('report_exports', $export->disk);
        $this->assertNotNull($export->path);
        $this->assertNotNull($export->expires_at);
        Storage::disk('report_exports')->assertExists($export->path);

        $csv = Storage::disk('report_exports')->get($export->path);

        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString('"Ticket number",Client,Product', $csv);
        $this->assertStringContainsString("'=CLIENT-FORMULA", $csv);
        $this->assertStringContainsString("'=PRODUCT-FORMULA", $csv);
    }

    public function test_expired_report_exports_are_pruned_and_storage_failures_are_retried(): void
    {
        Storage::fake('report_exports');

        $expiredUuid = (string) Str::uuid();
        $expired = ReportExport::query()->create([
            'uuid' => $expiredUuid,
            'report_type' => 'tickets',
            'format' => 'csv',
            'filters' => [],
            'status' => ReportExportStatus::Completed,
            'disk' => 'report_exports',
            'path' => "{$expiredUuid}/expired.csv",
            'filename' => 'expired.csv',
            'expires_at' => now()->subMinute(),
        ]);
        Storage::disk('report_exports')->put($expired->path, 'expired export');

        $futureUuid = (string) Str::uuid();
        $future = ReportExport::query()->create([
            'uuid' => $futureUuid,
            'report_type' => 'tickets',
            'format' => 'csv',
            'filters' => [],
            'status' => ReportExportStatus::Completed,
            'disk' => 'report_exports',
            'path' => "{$futureUuid}/future.csv",
            'filename' => 'future.csv',
            'expires_at' => now()->addDay(),
        ]);
        Storage::disk('report_exports')->put($future->path, 'future export');

        $this->artisan('reports:prune-expired')->assertSuccessful();

        $this->assertModelMissing($expired);
        Storage::disk('report_exports')->assertMissing($expired->path);
        $this->assertModelExists($future);
        Storage::disk('report_exports')->assertExists($future->path);

        $failedUuid = (string) Str::uuid();
        $failed = ReportExport::query()->create([
            'uuid' => $failedUuid,
            'report_type' => 'tickets',
            'format' => 'csv',
            'filters' => [],
            'status' => ReportExportStatus::Completed,
            'disk' => 'unconfigured-report-exports',
            'path' => "{$failedUuid}/retry.csv",
            'filename' => 'retry.csv',
            'expires_at' => now()->subMinute(),
        ]);

        $this->artisan('reports:prune-expired')->assertFailed();

        $this->assertModelExists($failed);
    }

    /** @return array{0: Product, 1: Brand, 2: Category} */
    private function product(string $suffix): array
    {
        $lowercaseSuffix = Str::lower($suffix);
        $category = Category::query()->create([
            'name' => "Report category {$suffix}",
            'slug' => "report-category-{$lowercaseSuffix}",
            'active' => true,
        ]);
        $brand = Brand::query()->create([
            'name' => "Report brand {$suffix}",
            'slug' => "report-brand-{$lowercaseSuffix}",
            'active' => true,
        ]);

        return [Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => $suffix,
            'name' => "Report product {$suffix}",
            'slug' => "report-product-{$lowercaseSuffix}",
            'category_id' => $category->id,
            'brand_id' => $brand->id,
            'model' => $suffix,
            'default_warranty_months' => 24,
            'serial_number_required' => true,
            'active' => true,
        ]), $brand, $category];
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

    private function ticket(User $actor, Client $client, Product $product, Warranty $warranty, string $title): Ticket
    {
        $response = $this->actingAs($actor)->postJson('/api/tickets', [
            'client_id' => $client->id,
            'product_id' => $product->id,
            'warranty_id' => $warranty->id,
            'title' => $title,
            'problem_description' => 'A reproducible reporting issue.',
            'source' => 'web',
        ]);

        $response->assertCreated();

        return Ticket::query()->findOrFail($response->json('data.id'));
    }

    private function technician(): Technician
    {
        $user = $this->userWithRole('technician');

        return Technician::query()->create([
            'user_id' => $user->id,
            'employee_code' => 'REPORT-'.Str::upper(Str::random(8)),
            'skill_level' => 4,
            'availability_status' => 'available',
        ]);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
