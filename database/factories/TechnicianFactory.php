<?php

namespace Database\Factories;

use App\Enums\TechnicianAvailabilityStatus;
use App\Models\Technician;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/** @extends Factory<Technician> */
class TechnicianFactory extends Factory
{
    protected $model = Technician::class;

    public function configure(): static
    {
        return $this->afterCreating(function (Technician $technician): void {
            Role::findOrCreate('technician', 'web');
            $technician->user->syncRoles('technician');
        });
    }

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'employee_code' => 'TECH-'.Str::upper(fake()->unique()->bothify('??####')),
            'specialization' => fake()->randomElement(['Consumer electronics', 'Home appliances', 'Computers']),
            'skill_level' => fake()->numberBetween(1, 5),
            'availability_status' => TechnicianAvailabilityStatus::Available,
            'notes' => null,
        ];
    }

    public function busy(): static
    {
        return $this->state(fn (): array => ['availability_status' => TechnicianAvailabilityStatus::Busy]);
    }

    public function unavailable(): static
    {
        return $this->state(fn (): array => ['availability_status' => TechnicianAvailabilityStatus::Unavailable]);
    }

    public function onLeave(): static
    {
        return $this->state(fn (): array => ['availability_status' => TechnicianAvailabilityStatus::Leave]);
    }
}
