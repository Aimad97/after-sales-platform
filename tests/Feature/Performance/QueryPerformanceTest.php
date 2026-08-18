<?php

namespace Tests\Feature\Performance;

use App\Models\User;
use App\Services\DashboardMetricsService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class QueryPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_user_collection_query_count_does_not_grow_with_page_size(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('super_admin');

        User::factory()->count(15)->create()->each(
            fn (User $user) => $user->assignRole('sav_agent'),
        );

        DB::enableQueryLog();
        $this->actingAs($admin)->getJson('/api/users?per_page=1')->assertOk();
        $smallQueries = DB::getQueryLog();
        DB::flushQueryLog();

        $this->actingAs($admin)->getJson('/api/users?per_page=15')->assertOk();
        $largeQueries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(
            count($smallQueries) + 2,
            count($largeQueries),
            "The users endpoint query count grows with its page size:\n".implode("\n", array_column($largeQueries, 'query')),
        );
    }

    public function test_uncached_admin_dashboard_uses_a_bounded_number_of_queries(): void
    {
        config()->set('dashboard.cache_ttl_seconds', 0);

        $admin = User::factory()->create();
        $admin->assignRole('super_admin');
        DB::enableQueryLog();
        app(DashboardMetricsService::class)->for($admin);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(
            12,
            count($queries),
            "The uncached admin dashboard exceeded its query budget:\n".implode("\n", array_column($queries, 'query')),
        );
    }
}
