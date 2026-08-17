<?php

namespace Database\Factories;

use App\Enums\InvoiceStatus;
use App\Models\Client;
use App\Models\Invoice;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Invoice> */
class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'invoice_number' => 'INV-'.now()->format('Ymd').'-'.Str::upper(fake()->unique()->bothify('??####')),
            'client_id' => Client::factory(),
            'invoice_date' => fake()->dateTimeBetween('-1 year', 'now'),
            'subtotal_amount' => '0.00',
            'tax_rate' => '20.00',
            'tax_amount' => '0.00',
            'total_amount' => '0.00',
            'status' => InvoiceStatus::Draft,
            'notes' => fake()->optional()->sentence(),
        ];
    }

    public function issued(): static
    {
        return $this->state(fn (): array => ['status' => InvoiceStatus::Issued]);
    }

    public function void(): static
    {
        return $this->state(fn (): array => ['status' => InvoiceStatus::Void]);
    }
}
