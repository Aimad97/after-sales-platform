<?php

namespace Database\Factories;

use App\Enums\UserStatus;
use App\Models\Client;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'phone' => fake()->phoneNumber(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'locale' => 'fr',
            'timezone' => 'Africa/Casablanca',
            'status' => UserStatus::Active,
        ];
    }

    public function superAdmin(): static
    {
        return $this->withRole('super_admin');
    }

    public function admin(): static
    {
        return $this->withRole('admin');
    }

    public function savAgent(): static
    {
        return $this->withRole('sav_agent');
    }

    public function technician(): static
    {
        return $this->withRole('technician');
    }

    public function clientPortal(?Client $client = null): static
    {
        $factory = $client === null
            ? $this->state(fn (): array => ['client_id' => Client::factory()])
            : $this->forClient($client);

        return $factory->withRole('client');
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    public function invited(): static
    {
        return $this->state(fn (): array => ['status' => UserStatus::Invited]);
    }

    public function suspended(): static
    {
        return $this->state(fn (): array => ['status' => UserStatus::Suspended]);
    }

    public function archived(): static
    {
        return $this->state(fn (): array => ['status' => UserStatus::Archived]);
    }

    public function forClient(Client $client): static
    {
        return $this->state(fn (): array => ['client_id' => $client->id]);
    }

    private function withRole(string $role): static
    {
        return $this->afterCreating(function (User $user) use ($role): void {
            Role::findOrCreate($role, 'web');
            $user->syncRoles($role);
        });
    }
}
