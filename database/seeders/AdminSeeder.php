<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('AdminSeeder creates a demo account and may only run locally or in tests.');
        }

        $this->call(RolesAndPermissionsSeeder::class);

        $admin = User::query()->firstOrNew(['email' => 'admin@servicedesk.test']);

        if (! $admin->exists) {
            $admin->uuid = (string) Str::uuid();
        }

        $admin->forceFill([
            'first_name' => 'Amine',
            'last_name' => 'Manager',
            'phone' => '+212620000002',
            'password' => Hash::make((string) config('demo.password')),
            'status' => 'active',
            'locale' => 'fr',
            'timezone' => 'Africa/Casablanca',
            'email_verified_at' => now(),
        ])->save();

        $admin->syncRoles('admin');
    }
}
