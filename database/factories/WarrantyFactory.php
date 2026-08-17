<?php

namespace Database\Factories;

use App\Enums\WarrantyStatus;
use App\Models\Client;
use App\Models\Product;
use App\Models\Warranty;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Warranty> */
class WarrantyFactory extends Factory
{
    protected $model = Warranty::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $startsAt = today()->subMonth();
        $expiresAt = today()->addYear();

        return [
            'uuid' => (string) Str::uuid(),
            'customer_id' => Client::factory(),
            'product_id' => Product::factory(),
            'invoice_item_id' => null,
            'serial_number' => 'SN-'.Str::upper(fake()->unique()->bothify('????-########')),
            'quantity' => 1,
            'purchase_date' => $startsAt,
            'warranty_end' => $expiresAt,
            'starts_at' => $startsAt,
            'expires_at' => $expiresAt,
            'status' => WarrantyStatus::Active,
            'void_reason' => null,
            'notes' => null,
        ];
    }

    public function expired(): static
    {
        return $this->state(function (): array {
            $startsAt = today()->subYears(2);
            $expiresAt = today()->subDay();

            return [
                'purchase_date' => $startsAt,
                'warranty_end' => $expiresAt,
                'starts_at' => $startsAt,
                'expires_at' => $expiresAt,
                'status' => WarrantyStatus::Expired,
            ];
        });
    }

    public function future(): static
    {
        return $this->state(function (): array {
            $startsAt = today()->addMonth();
            $expiresAt = today()->addYear();

            return [
                'purchase_date' => today(),
                'warranty_end' => $expiresAt,
                'starts_at' => $startsAt,
                'expires_at' => $expiresAt,
                'status' => WarrantyStatus::Active,
            ];
        });
    }

    public function void(string $reason = 'Coverage voided by an authorized decision.'): static
    {
        return $this->state(fn (): array => [
            'status' => WarrantyStatus::Void,
            'void_reason' => $reason,
        ]);
    }

    public function replaced(): static
    {
        return $this->state(fn (): array => [
            'status' => WarrantyStatus::Replaced,
            'void_reason' => null,
        ]);
    }
}
