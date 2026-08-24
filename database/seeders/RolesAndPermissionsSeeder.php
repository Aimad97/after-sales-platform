<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /** @var list<string> */
    private const PERMISSIONS = [
        'users.view', 'users.create', 'users.update', 'users.delete',
        'technicians.profile.view', 'technicians.profile.update',
        'clients.view', 'clients.create', 'clients.update', 'clients.delete',
        'products.view', 'products.create', 'products.update', 'products.delete',
        'invoices.view', 'invoices.create', 'invoices.update',
        'tickets.view', 'tickets.create', 'tickets.update', 'tickets.assign', 'tickets.close',
        'repairs.view', 'repairs.update',
        'warranties.view', 'warranties.manage',
        'reports.view', 'dashboard.view',
        'audit_logs.view',
    ];

    /** @var array<string, list<string>> */
    private const ROLE_PERMISSIONS = [
        'super_admin' => self::PERMISSIONS,
        'admin' => self::PERMISSIONS,
        'sav_agent' => [
            'clients.view', 'clients.create', 'clients.update',
            'products.view', 'tickets.view', 'tickets.create', 'tickets.update', 'tickets.assign', 'tickets.close',
            'invoices.view', 'invoices.create', 'invoices.update',
            'repairs.view', 'warranties.view', 'dashboard.view',
        ],
        'technician' => [
            'technicians.profile.view', 'technicians.profile.update',
            'tickets.view', 'tickets.update', 'repairs.view', 'repairs.update', 'warranties.view', 'dashboard.view',
        ],
        'client' => ['tickets.view', 'tickets.create', 'warranties.view'],
    ];

    public function run(): void
    {
        $permissionRegistrar = app(PermissionRegistrar::class);
        $permissionRegistrar->forgetCachedPermissions();

        foreach (self::PERMISSIONS as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        // DatabaseSeeder uses WithoutModelEvents, so Spatie's model-event cache
        // invalidation does not run while permissions are created. Refresh the
        // registrar explicitly before resolving permission names for roles.
        $permissionRegistrar->forgetCachedPermissions();

        foreach (self::ROLE_PERMISSIONS as $name => $permissions) {
            $role = Role::findOrCreate($name, 'web');
            $role->syncPermissions($permissions);
        }

        $permissionRegistrar->forgetCachedPermissions();
    }
}
