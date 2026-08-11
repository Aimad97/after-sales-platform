<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Enums\WarrantyStatus;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\Warranty;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InvoiceManagementService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Invoice>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'invoice_date';
        $direction = $filters['direction'] ?? 'desc';

        return Invoice::query()
            ->with('client')
            ->withCount('items')
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('invoice_number', 'like', "%{$term}%")
                        ->orWhereHas('client', function ($query) use ($term): void {
                            $query->where('first_name', 'like', "%{$term}%")
                                ->orWhere('last_name', 'like', "%{$term}%")
                                ->orWhere('company_name', 'like', "%{$term}%")
                                ->orWhere('email', 'like', "%{$term}%");
                        });
                });
            })
            ->when($filters['client_id'] ?? null, fn ($query, int $clientId) => $query->where('client_id', $clientId))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('invoice_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('invoice_date', '<=', $date))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Invoice
    {
        return DB::transaction(function () use ($data): Invoice {
            $data = $this->normalize($data);
            $calculated = $this->calculateItems($data['items'], $data['invoice_date'], $data['tax_rate']);
            $this->ensureSerialNumbersAreAvailable($calculated['serial_numbers']);

            $invoice = Invoice::query()->create([
                'invoice_number' => $data['invoice_number'],
                'client_id' => $data['client_id'],
                'invoice_date' => $data['invoice_date'],
                'subtotal_amount' => $calculated['subtotal_amount'],
                'tax_rate' => $data['tax_rate'],
                'tax_amount' => $calculated['tax_amount'],
                'total_amount' => $calculated['total_amount'],
                'status' => $data['status'],
                'notes' => $data['notes'],
            ]);

            $this->persistItemsAndPurchases($invoice, $calculated['items']);

            return $this->loadInvoice($invoice);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Invoice $invoice, array $data): Invoice
    {
        return DB::transaction(function () use ($invoice, $data): Invoice {
            $invoice = Invoice::query()
                ->with('items')
                ->lockForUpdate()
                ->findOrFail($invoice->id);

            if (! $invoice->status->isEditable()) {
                throw ValidationException::withMessages([
                    'invoice' => 'Only draft invoices can be edited.',
                ]);
            }

            $data = $this->normalize($data, $invoice);
            $calculated = $this->calculateItems($data['items'], $data['invoice_date'], $data['tax_rate']);
            $this->ensureSerialNumbersAreAvailable($calculated['serial_numbers'], $invoice);
            $this->ensureDraftItemsCanBeReplaced($invoice);

            $this->removeItemsAndPurchases($invoice);
            $invoice->fill([
                'invoice_number' => $data['invoice_number'],
                'client_id' => $data['client_id'],
                'invoice_date' => $data['invoice_date'],
                'subtotal_amount' => $calculated['subtotal_amount'],
                'tax_rate' => $data['tax_rate'],
                'tax_amount' => $calculated['tax_amount'],
                'total_amount' => $calculated['total_amount'],
                'status' => $data['status'],
                'notes' => $data['notes'],
            ])->save();
            $this->persistItemsAndPurchases($invoice, $calculated['items']);

            return $this->loadInvoice($invoice);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{invoice_number: string, client_id: int, invoice_date: string, tax_rate: string, status: string, notes: string|null, items: array<int, array<string, mixed>>}
     */
    private function normalize(array $data, ?Invoice $invoice = null): array
    {
        $invoiceNumber = filled($data['invoice_number'] ?? null)
            ? Str::upper(trim((string) $data['invoice_number']))
            : ($invoice?->invoice_number ?? $this->generateInvoiceNumber());

        $duplicate = Invoice::query()->where('invoice_number', $invoiceNumber);

        if ($invoice !== null) {
            $duplicate->whereKeyNot($invoice->id);
        }

        if ($duplicate->exists()) {
            throw ValidationException::withMessages([
                'invoice_number' => 'The invoice number has already been taken.',
            ]);
        }

        $status = $data['status'] ?? $invoice?->status?->value ?? InvoiceStatus::Draft->value;
        $status = $status instanceof InvoiceStatus ? $status->value : (string) $status;

        $notes = array_key_exists('notes', $data)
            ? (filled($data['notes']) ? trim((string) $data['notes']) : null)
            : $invoice?->notes;

        return [
            'invoice_number' => $invoiceNumber,
            'client_id' => (int) ($data['client_id'] ?? $invoice?->client_id),
            'invoice_date' => CarbonImmutable::parse($data['invoice_date'] ?? $invoice?->invoice_date ?? today())->toDateString(),
            'tax_rate' => $this->normalizeTaxRate($data['tax_rate'] ?? $invoice?->tax_rate ?? config('invoices.default_tax_rate')),
            'status' => $status,
            'notes' => $notes,
            'items' => $data['items'],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array{items: array<int, array<string, mixed>>, serial_numbers: list<string>, subtotal_amount: string, tax_amount: string, total_amount: string}
     */
    private function calculateItems(array $items, string $invoiceDate, string $taxRate): array
    {
        $productIds = array_values(array_unique(array_map(
            fn (array $item): int => (int) $item['product_id'],
            $items,
        )));
        $products = Product::query()->whereIn('id', $productIds)->get()->keyBy('id');

        if ($products->count() !== count($productIds)) {
            throw ValidationException::withMessages([
                'items' => 'One or more selected products are no longer available.',
            ]);
        }

        $calculatedItems = [];
        $serialNumbers = [];
        $serialIndexes = [];
        $errors = [];
        $subtotalCents = 0;
        $taxCents = 0;
        $taxRateBasisPoints = $this->taxRateToBasisPoints($taxRate);

        foreach ($items as $index => $item) {
            $product = $products->get((int) $item['product_id']);
            $quantity = (int) $item['quantity'];
            $serialNumber = filled($item['serial_number'] ?? null)
                ? Str::upper(trim((string) $item['serial_number']))
                : null;

            if ($product->serial_number_required && $serialNumber === null) {
                $errors["items.{$index}.serial_number"] = 'A serial number is required for this product.';
            }

            if ($product->serial_number_required && $quantity !== 1) {
                $errors["items.{$index}.quantity"] = 'Serialized products must be invoiced one unit per line.';
            }

            if ($serialNumber !== null) {
                if (isset($serialIndexes[$serialNumber])) {
                    $errors["items.{$index}.serial_number"] = 'Each serial number may only appear once per invoice.';
                }

                $serialIndexes[$serialNumber] = $index;
                $serialNumbers[] = $serialNumber;
            }

            $warrantyMonths = filled($item['warranty_months'] ?? null)
                ? (int) $item['warranty_months']
                : $product->default_warranty_months;
            $warrantyStartDate = CarbonImmutable::parse($item['warranty_start_date'] ?? $invoiceDate);
            $warrantyEndDate = $warrantyStartDate->addMonthsNoOverflow($warrantyMonths);
            $unitPriceCents = $this->toCents($item['unit_price']);
            $lineSubtotalCents = $unitPriceCents * $quantity;
            $lineTaxCents = $this->calculateTaxCents($lineSubtotalCents, $taxRateBasisPoints);

            $subtotalCents += $lineSubtotalCents;
            $taxCents += $lineTaxCents;
            $calculatedItems[] = [
                'product_id' => $product->id,
                'serial_number' => $serialNumber,
                'quantity' => $quantity,
                'unit_price' => $this->fromCents($unitPriceCents),
                'warranty_months' => $warrantyMonths,
                'warranty_start_date' => $warrantyStartDate->toDateString(),
                'warranty_end_date' => $warrantyEndDate->toDateString(),
                'line_subtotal' => $this->fromCents($lineSubtotalCents),
                'line_tax' => $this->fromCents($lineTaxCents),
                'line_total' => $this->fromCents($lineSubtotalCents + $lineTaxCents),
            ];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return [
            'items' => $calculatedItems,
            'serial_numbers' => $serialNumbers,
            'subtotal_amount' => $this->fromCents($subtotalCents),
            'tax_amount' => $this->fromCents($taxCents),
            'total_amount' => $this->fromCents($subtotalCents + $taxCents),
        ];
    }

    /**
     * @param  list<string>  $serialNumbers
     */
    private function ensureSerialNumbersAreAvailable(array $serialNumbers, ?Invoice $invoice = null): void
    {
        if ($serialNumbers === []) {
            return;
        }

        $invoiceItems = InvoiceItem::query()->whereIn('serial_number', $serialNumbers);

        if ($invoice !== null) {
            $invoiceItems->where('invoice_id', '!=', $invoice->id);
        }

        if ($invoiceItems->exists()) {
            throw ValidationException::withMessages([
                'items' => 'One or more serial numbers are already used by another invoice.',
            ]);
        }

        $purchases = Warranty::query()->whereIn('serial_number', $serialNumbers);

        if ($invoice !== null) {
            $purchases->where(function ($query) use ($invoice): void {
                $query->whereNull('invoice_item_id')
                    ->orWhereHas('invoiceItem', fn ($query) => $query->where('invoice_id', '!=', $invoice->id));
            });
        }

        if ($purchases->exists()) {
            throw ValidationException::withMessages([
                'items' => 'One or more serial numbers are already registered to a client purchase.',
            ]);
        }
    }

    private function ensureDraftItemsCanBeReplaced(Invoice $invoice): void
    {
        $itemIds = $invoice->items->pluck('id');

        if ($itemIds->isNotEmpty() && Warranty::query()
            ->whereIn('invoice_item_id', $itemIds)
            ->whereHas('tickets')
            ->exists()) {
            throw ValidationException::withMessages([
                'invoice' => 'This draft cannot be edited because a linked purchase is already used by a SAV ticket.',
            ]);
        }
    }

    private function removeItemsAndPurchases(Invoice $invoice): void
    {
        $itemIds = $invoice->items->pluck('id');

        if ($itemIds->isNotEmpty()) {
            Warranty::query()->whereIn('invoice_item_id', $itemIds)->delete();
        }

        $invoice->items()->delete();
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function persistItemsAndPurchases(Invoice $invoice, array $items): void
    {
        foreach ($items as $itemData) {
            $item = $invoice->items()->create($itemData);

            for ($unit = 0; $unit < $item->quantity; $unit++) {
                Warranty::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'customer_id' => $invoice->client_id,
                    'product_id' => $item->product_id,
                    'invoice_item_id' => $item->id,
                    'serial_number' => $unit === 0 ? $item->serial_number : null,
                    'quantity' => 1,
                    'purchase_date' => $invoice->invoice_date->toDateString(),
                    'warranty_end' => $item->warranty_end_date->toDateString(),
                    'starts_at' => $item->warranty_start_date->toDateString(),
                    'expires_at' => $item->warranty_end_date->toDateString(),
                    'status' => $item->warranty_end_date->isBefore(today())
                        ? WarrantyStatus::Expired
                        : WarrantyStatus::Active,
                ]);
            }
        }
    }

    private function generateInvoiceNumber(): string
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $number = sprintf('INV-%s-%s', now()->format('Ymd'), Str::upper(Str::random(6)));

            if (! Invoice::query()->where('invoice_number', $number)->exists()) {
                return $number;
            }
        }

        throw ValidationException::withMessages([
            'invoice_number' => 'Unable to allocate a unique invoice number. Please try again.',
        ]);
    }

    private function normalizeTaxRate(mixed $taxRate): string
    {
        return $this->fromCents($this->decimalToScaledInteger($taxRate, 'tax_rate'));
    }

    private function taxRateToBasisPoints(string $taxRate): int
    {
        return $this->decimalToScaledInteger($taxRate, 'tax_rate');
    }

    private function toCents(mixed $amount): int
    {
        return $this->decimalToScaledInteger($amount, 'unit_price');
    }

    private function calculateTaxCents(int $subtotalCents, int $taxRateBasisPoints): int
    {
        return intdiv(($subtotalCents * $taxRateBasisPoints) + 5000, 10000);
    }

    private function fromCents(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $absoluteCents = abs($cents);

        return sprintf('%s%d.%02d', $sign, intdiv($absoluteCents, 100), $absoluteCents % 100);
    }

    private function decimalToScaledInteger(mixed $value, string $field): int
    {
        $value = trim((string) $value);

        if (! preg_match('/^(\d+)(?:\.(\d{1,2}))?$/', $value, $matches)) {
            throw ValidationException::withMessages([
                $field => 'The value must use no more than two decimal places.',
            ]);
        }

        $fraction = str_pad($matches[2] ?? '', 2, '0');

        return ((int) $matches[1] * 100) + (int) $fraction;
    }

    private function loadInvoice(Invoice $invoice): Invoice
    {
        return $invoice->refresh()->load(['client', 'items.product']);
    }
}
