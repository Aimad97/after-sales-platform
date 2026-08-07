<?php

namespace Tests\Feature\Users;

use App\Models\Technician;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAndTechnicianManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_an_admin_can_create_search_update_and_archive_a_standard_user(): void
    {
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin)->postJson('/api/users', [
            'first_name' => 'Zara',
            'last_name' => 'Benali',
            'email' => 'zara@example.test',
            'phone' => '+212600000000',
            'status' => 'active',
            'locale' => 'fr',
            'timezone' => 'Africa/Casablanca',
            'password' => 'Password!123456',
            'password_confirmation' => 'Password!123456',
            'roles' => ['client'],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'zara@example.test')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.roles.0', 'client');

        $user = User::query()->where('email', 'zara@example.test')->firstOrFail();

        $this->actingAs($admin)->getJson('/api/users?search=Zara&status=active&sort=first_name&direction=asc&per_page=1')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('data.0.uuid', $user->uuid);

        $this->actingAs($admin)->patchJson("/api/users/{$user->uuid}", [
            'status' => 'suspended',
            'phone' => '+212611111111',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->actingAs($admin)->deleteJson("/api/users/{$user->uuid}")
            ->assertOk()
            ->assertJsonPath('message', 'User archived successfully.');

        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertSame('archived', User::withTrashed()->findOrFail($user->id)->status->value);
    }

    public function test_only_super_administrators_can_assign_privileged_roles(): void
    {
        $admin = $this->userWithRole('admin');
        $payload = $this->userPayload(['roles' => ['admin']]);

        $this->actingAs($admin)->postJson('/api/users', $payload)->assertForbidden();

        $superAdmin = $this->userWithRole('super_admin');

        $this->actingAs($superAdmin)->postJson('/api/users', $payload)
            ->assertCreated()
            ->assertJsonPath('data.roles.0', 'admin');
    }

    public function test_a_user_without_user_permissions_cannot_access_user_management(): void
    {
        $agent = $this->userWithRole('sav_agent');

        $this->actingAs($agent)->getJson('/api/users')->assertForbidden();
    }

    public function test_an_admin_can_manage_a_technician_profile_only_for_a_technician_user(): void
    {
        $admin = $this->userWithRole('admin');
        $technicianUser = $this->userWithRole('technician');

        $response = $this->actingAs($admin)->postJson('/api/technicians', [
            'user_id' => $technicianUser->id,
            'employee_code' => 'TECH-001',
            'specialization' => 'Consumer electronics',
            'skill_level' => 4,
            'availability_status' => 'available',
            'notes' => 'Certified for priority repairs.',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user_id', $technicianUser->id)
            ->assertJsonPath('data.availability_status', 'available');

        $technician = Technician::query()->firstOrFail();

        $this->actingAs($admin)->getJson('/api/technicians?availability_status=available&skill_level=4')
            ->assertOk()
            ->assertJsonPath('data.0.id', $technician->id);

        $this->actingAs($admin)->patchJson("/api/technicians/{$technician->id}", [
            'availability_status' => 'busy',
            'skill_level' => 5,
        ])
            ->assertOk()
            ->assertJsonPath('data.availability_status', 'busy')
            ->assertJsonPath('data.skill_level', 5);

        $this->actingAs($admin)->deleteJson("/api/technicians/{$technician->id}")
            ->assertOk();

        $this->assertSoftDeleted('technicians', ['id' => $technician->id]);
    }

    public function test_a_technician_profile_requires_the_technician_role(): void
    {
        $admin = $this->userWithRole('admin');
        $client = $this->userWithRole('client');

        $this->actingAs($admin)->postJson('/api/technicians', [
            'user_id' => $client->id,
            'employee_code' => 'TECH-002',
            'skill_level' => 1,
            'availability_status' => 'available',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('user_id');
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function userPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Admin',
            'last_name' => 'Created',
            'email' => 'created@example.test',
            'status' => 'invited',
            'locale' => 'fr',
            'timezone' => 'Africa/Casablanca',
            'password' => 'Password!123456',
            'password_confirmation' => 'Password!123456',
            'roles' => ['client'],
        ], $overrides);
    }
}
