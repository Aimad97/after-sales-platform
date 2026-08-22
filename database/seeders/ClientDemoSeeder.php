<?php

namespace Database\Seeders;

use App\Models\Client;
use Illuminate\Database\Seeder;
use RuntimeException;

class ClientDemoSeeder extends Seeder
{
    /**
     * Seed a balanced sample set for local UI/API testing.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('ClientDemoSeeder may only run locally or in tests.');
        }

        Client::factory()->individual()->count(7)->create();
        Client::factory()->company()->count(3)->create();
    }
}
