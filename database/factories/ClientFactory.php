<?php

namespace Database\Factories;

use App\Enums\ClientType;
use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Client>
 */
class ClientFactory extends Factory
{
    /**
     * The model that the factory creates.
     *
     * @var class-string<Client>
     */
    protected $model = Client::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'type' => ClientType::Individual,
            'company_name' => null,
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '+2126'.fake()->numerify('########'),
            'address' => fake()->streetAddress(),
            'city' => fake()->city(),
            'tax_identifier' => null,
            'notes' => fake()->optional()->sentence(),
        ];
    }

    public function individual(): static
    {
        return $this->state(fn (): array => [
            'type' => ClientType::Individual,
            'company_name' => null,
            'tax_identifier' => null,
        ]);
    }

    public function company(): static
    {
        return $this->state(fn (): array => [
            'type' => ClientType::Company,
            'company_name' => fake()->company(),
            'tax_identifier' => 'MA-'.fake()->unique()->numerify('########'),
        ]);
    }
}
