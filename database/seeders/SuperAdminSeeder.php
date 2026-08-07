<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);

        $email = (string) env('SUPER_ADMIN_EMAIL', 'superadmin@servicedesk.test');
        $password = env('SUPER_ADMIN_PASSWORD');

        if (blank($password)) {
            throw new RuntimeException('Set SUPER_ADMIN_PASSWORD before running the SuperAdminSeeder.');
        }

        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            $user = User::query()->forceCreate([
                'uuid' => (string) Str::uuid(),
                'first_name' => (string) env('SUPER_ADMIN_FIRST_NAME', 'Super'),
                'last_name' => (string) env('SUPER_ADMIN_LAST_NAME', 'Admin'),
                'email' => $email,
                'password' => Hash::make($password),
                'status' => 'active',
                'locale' => 'en',
                'timezone' => 'Africa/Casablanca',
            ]);
        }

        $user->syncRoles('super_admin');
    }
}
