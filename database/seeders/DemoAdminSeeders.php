<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DemoAdminSeeders extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->call(AdminSeeder::class);
    }
}
