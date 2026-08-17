<?php

namespace Database\Factories;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<InvoiceItem> */
class InvoiceItemFactory extends Factory
{
    protected $model = InvoiceItem::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $start = today()->subMonth();

        return [
            'invoice_id' => Invoice::factory(),
            'product_id' => Product::factory(),
            'serial_number' => 'SN-'.Str::upper(fake()->unique()->bothify('????-########')),
            'quantity' => 1,
            'unit_price' => '100.00',
            'warranty_months' => 24,
            'warranty_start_date' => $start,
            'warranty_end_date' => $start->copy()->addMonthsNoOverflow(24),
            'line_subtotal' => '100.00',
            'line_tax' => '20.00',
            'line_total' => '120.00',
        ];
    }

    public function withoutSerialNumber(): static
    {
        return $this
            ->for(Product::factory()->withoutSerialNumber())
            ->state(fn (): array => ['serial_number' => null]);
    }

    public function priced(int $quantity, string $unitPrice, string $taxRate = '20.00'): static
    {
        return $this->state(function () use ($quantity, $unitPrice, $taxRate): array {
            $subtotal = round(((float) $unitPrice) * $quantity, 2);
            $tax = round($subtotal * ((float) $taxRate / 100), 2);

            return [
                'quantity' => $quantity,
                'unit_price' => number_format((float) $unitPrice, 2, '.', ''),
                'line_subtotal' => number_format($subtotal, 2, '.', ''),
                'line_tax' => number_format($tax, 2, '.', ''),
                'line_total' => number_format($subtotal + $tax, 2, '.', ''),
            ];
        });
    }
}
