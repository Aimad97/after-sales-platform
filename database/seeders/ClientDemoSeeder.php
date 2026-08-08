<?php

namespace Database\Seeders;

use App\Models\Client;
use Illuminate\Database\Seeder;

class ClientDemoSeeder extends Seeder
{
    /**
     * Seed a balanced sample set for local UI/API testing.
     */
    public function run(): void
    {
        Client::factory()->individual()->count(7)->create();
        Client::factory()->company()->count(3)->create();
    }
}
