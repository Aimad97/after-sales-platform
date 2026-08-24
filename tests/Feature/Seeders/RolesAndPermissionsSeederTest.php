<?php

namespace Tests\Feature\Seeders;

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RolesAndPermissionsSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_assigns_permissions_when_database_seeding_disables_model_events(): void
    {
        Model::withoutEvents(fn () => $this->seed(RolesAndPermissionsSeeder::class));

        $this->assertSame(29, Role::findByName('admin', 'web')->permissions()->count());
        $this->assertTrue(Role::findByName('sav_agent', 'web')->hasPermissionTo('tickets.create'));
        $this->assertTrue(Role::findByName('technician', 'web')->hasPermissionTo('repairs.update'));
        $this->assertTrue(Role::findByName('technician', 'web')->hasPermissionTo('technicians.profile.view'));
        $this->assertTrue(Role::findByName('technician', 'web')->hasPermissionTo('technicians.profile.update'));
        $this->assertTrue(Role::findByName('client', 'web')->hasPermissionTo('warranties.view'));
    }
}
