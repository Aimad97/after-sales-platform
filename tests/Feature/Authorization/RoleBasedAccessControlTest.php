<?php

namespace Tests\Feature\Authorization;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class RoleBasedAccessControlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);

        Route::get('/api/testing/rbac/users', fn () => response()->json(['data' => []]))
            ->middleware(['auth:sanctum', 'permission:users.view']);
    }

    public function test_role_assignments_grant_only_their_configured_permissions(): void
    {
        $agent = User::factory()->create();
        $agent->assignRole('sav_agent');

        $this->assertTrue($agent->can('tickets.assign'));
        $this->assertFalse($agent->can('users.delete'));
    }

    public function test_permission_middleware_rejects_an_authenticated_user_without_permission(): void
    {
        $technician = User::factory()->create();
        $technician->assignRole('technician');

        $this->actingAs($technician)->getJson('/api/testing/rbac/users')->assertForbidden();
    }

    public function test_permission_middleware_allows_an_authorized_user(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)->getJson('/api/testing/rbac/users')->assertOk();
    }

    public function test_super_admin_is_authorized_by_the_global_gate_override(): void
    {
        $superAdmin = User::factory()->create();
        $superAdmin->assignRole('super_admin');

        $this->assertTrue(Gate::forUser($superAdmin)->allows('delete', User::factory()->make()));
    }
}
