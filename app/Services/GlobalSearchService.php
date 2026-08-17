<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use BackedEnum;
use Illuminate\Support\Facades\Gate;

class GlobalSearchService
{
    public const DEFAULT_LIMIT = 5;

    /**
     * @return array{
     *     query: string,
     *     groups: array<string, list<array{id: string, title: string, subtitle: string|null, url: string}>>,
     *     total: int,
     *     limit_per_category: int
     * }
     */
    public function search(User $user, string $query, int $limit = self::DEFAULT_LIMIT): array
    {
        $query = trim($query);
        $limit = min(max($limit, 1), 10);
        $groups = $user->hasRole('client')
            ? ($user->hasClientPortalAccess() ? $this->clientPortalGroups($user, $query, $limit) : $this->emptyGroups())
            : $this->staffGroups($user, $query, $limit);

        return [
            'query' => $query,
            'groups' => $groups,
            'total' => array_sum(array_map('count', $groups)),
            'limit_per_category' => $limit,
        ];
    }

    /**
     * @return array<string, list<array{id: string, title: string, subtitle: string|null, url: string}>>
     */
    private function staffGroups(User $user, string $term, int $limit): array
    {
        $prefix = $this->prefixPattern($term);
        $groups = $this->emptyGroups();

        if (Gate::forUser($user)->allows('viewAny', Client::class)) {
            $groups['clients'] = Client::query()
                ->where(function ($query) use ($prefix): void {
                    $query->where('company_name', 'like', $prefix)
                        ->orWhere('first_name', 'like', $prefix)
                        ->orWhere('last_name', 'like', $prefix)
                        ->orWhere('email', 'like', $prefix)
                        ->orWhere('phone', 'like', $prefix);
                })
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->limit($limit)
                ->get()
                ->map(fn (Client $client): array => $this->result(
                    (string) $client->uuid,
                    $this->clientName($client),
                    $this->details($client->email, $client->phone),
                    "/admin/clients/{$client->uuid}",
                ))
                ->all();
        }

        if (Gate::forUser($user)->allows('viewAny', Ticket::class)) {
            $groups['tickets'] = Ticket::query()
                ->with('client')
                ->where('ticket_number', 'like', $prefix)
                ->orderByRaw('CASE WHEN ticket_number = ? THEN 0 ELSE 1 END', [$term])
                ->orderByDesc('received_at')
                ->limit($limit)
                ->get()
                ->map(fn (Ticket $ticket): array => $this->result(
                    (string) $ticket->uuid,
                    $ticket->ticket_number,
                    $this->details($ticket->title, $ticket->client ? $this->clientName($ticket->client) : null, $this->enumValue($ticket->status)),
                    "/admin/tickets/{$ticket->uuid}",
                ))
                ->all();
        }

        if (Gate::forUser($user)->allows('viewAny', Invoice::class)) {
            $groups['invoices'] = Invoice::query()
                ->with('client')
                ->where('invoice_number', 'like', $prefix)
                ->orderByRaw('CASE WHEN invoice_number = ? THEN 0 ELSE 1 END', [$term])
                ->orderByDesc('invoice_date')
                ->limit($limit)
                ->get()
                ->map(fn (Invoice $invoice): array => $this->result(
                    (string) $invoice->id,
                    $invoice->invoice_number,
                    $this->details($invoice->client ? $this->clientName($invoice->client) : null, $invoice->invoice_date?->toDateString()),
                    "/admin/invoices/{$invoice->id}",
                ))
                ->all();
        }

        if (Gate::forUser($user)->allows('viewAny', Warranty::class)) {
            $groups['serial_numbers'] = Warranty::query()
                ->with(['product', 'client'])
                ->where('serial_number', 'like', $prefix)
                ->orderByRaw('CASE WHEN serial_number = ? THEN 0 ELSE 1 END', [$term])
                ->orderByDesc('purchase_date')
                ->limit($limit)
                ->get()
                ->map(fn (Warranty $warranty): array => $this->warrantyResult($warranty, false))
                ->all();
        }

        if (Gate::forUser($user)->allows('viewAny', Product::class)) {
            $groups['products'] = Product::query()
                ->with('brand')
                ->where(function ($query) use ($prefix): void {
                    $query->where('name', 'like', $prefix)
                        ->orWhere('model', 'like', $prefix)
                        ->orWhere('sku', 'like', $prefix);
                })
                ->orderBy('name')
                ->limit($limit)
                ->get()
                ->map(fn (Product $product): array => $this->result(
                    (string) $product->uuid,
                    $product->name,
                    $this->details($product->sku, $product->model, $product->brand?->name),
                    "/admin/products/{$product->uuid}",
                ))
                ->all();
        }

        if (Gate::forUser($user)->allows('viewAny', Technician::class)) {
            $groups['technicians'] = Technician::query()
                ->with('user')
                ->where(function ($query) use ($prefix): void {
                    $query->where('employee_code', 'like', $prefix)
                        ->orWhere('specialization', 'like', $prefix)
                        ->orWhereHas('user', fn ($query) => $query->where(fn ($query) => $query
                            ->where('first_name', 'like', $prefix)
                            ->orWhere('last_name', 'like', $prefix)
                            ->orWhere('email', 'like', $prefix)));
                })
                ->orderBy('employee_code')
                ->limit($limit)
                ->get()
                ->map(fn (Technician $technician): array => $this->result(
                    (string) $technician->id,
                    trim("{$technician->user->first_name} {$technician->user->last_name}"),
                    $this->details($technician->employee_code, $technician->specialization, $this->enumValue($technician->availability_status)),
                    "/admin/technicians/{$technician->id}",
                ))
                ->all();
        }

        return $groups;
    }

    /**
     * @return array<string, list<array{id: string, title: string, subtitle: string|null, url: string}>>
     */
    private function clientPortalGroups(User $user, string $term, int $limit): array
    {
        $prefix = $this->prefixPattern($term);
        $groups = $this->emptyGroups();

        $groups['clients'] = Client::query()
            ->whereKey($user->client_id)
            ->where(function ($query) use ($prefix): void {
                $query->where('company_name', 'like', $prefix)
                    ->orWhere('first_name', 'like', $prefix)
                    ->orWhere('last_name', 'like', $prefix)
                    ->orWhere('email', 'like', $prefix)
                    ->orWhere('phone', 'like', $prefix);
            })
            ->limit(1)
            ->get()
            ->map(fn (Client $client): array => $this->result(
                (string) $client->uuid,
                $this->clientName($client),
                $this->details($client->email, $client->phone),
                '/client/profile',
            ))
            ->all();

        $groups['tickets'] = Ticket::query()
            ->where('client_id', $user->client_id)
            ->where('ticket_number', 'like', $prefix)
            ->orderByRaw('CASE WHEN ticket_number = ? THEN 0 ELSE 1 END', [$term])
            ->orderByDesc('received_at')
            ->limit($limit)
            ->get()
            ->map(fn (Ticket $ticket): array => $this->result(
                (string) $ticket->uuid,
                $ticket->ticket_number,
                $this->details($ticket->title, $this->enumValue($ticket->status)),
                "/client/tickets/{$ticket->uuid}",
            ))
            ->all();

        $groups['serial_numbers'] = Warranty::query()
            ->with('product')
            ->where('customer_id', $user->client_id)
            ->where('serial_number', 'like', $prefix)
            ->orderByRaw('CASE WHEN serial_number = ? THEN 0 ELSE 1 END', [$term])
            ->orderByDesc('purchase_date')
            ->limit($limit)
            ->get()
            ->map(fn (Warranty $warranty): array => $this->warrantyResult($warranty, true))
            ->all();

        $groups['products'] = Warranty::query()
            ->with('product.brand')
            ->where('customer_id', $user->client_id)
            ->whereHas('product', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', $prefix)
                ->orWhere('model', 'like', $prefix)
                ->orWhere('sku', 'like', $prefix)))
            ->orderByDesc('purchase_date')
            ->limit($limit)
            ->get()
            ->map(fn (Warranty $warranty): array => $this->result(
                (string) $warranty->uuid,
                $warranty->product->name,
                $this->details($warranty->product->sku, $warranty->product->model, $warranty->serial_number),
                "/client/products/{$warranty->uuid}",
            ))
            ->all();

        return $groups;
    }

    /**
     * @return array<string, list<array{id: string, title: string, subtitle: string|null, url: string}>>
     */
    private function emptyGroups(): array
    {
        return [
            'clients' => [],
            'tickets' => [],
            'invoices' => [],
            'serial_numbers' => [],
            'products' => [],
            'technicians' => [],
        ];
    }

    /** @return array{id: string, title: string, subtitle: string|null, url: string} */
    private function warrantyResult(Warranty $warranty, bool $clientPortal): array
    {
        return $this->result(
            (string) $warranty->uuid,
            $warranty->serial_number,
            $this->details($warranty->product?->name, $clientPortal ? null : ($warranty->client ? $this->clientName($warranty->client) : null), $this->enumValue($warranty->status)),
            $clientPortal ? "/client/products/{$warranty->uuid}" : "/admin/warranties/{$warranty->uuid}",
        );
    }

    /** @return array{id: string, title: string, subtitle: string|null, url: string} */
    private function result(string $id, string $title, ?string $subtitle, string $url): array
    {
        return compact('id', 'title', 'subtitle', 'url');
    }

    private function clientName(Client $client): string
    {
        return filled($client->company_name)
            ? $client->company_name
            : trim("{$client->first_name} {$client->last_name}");
    }

    private function prefixPattern(string $term): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term).'%';
    }

    private function details(?string ...$values): ?string
    {
        $details = array_values(array_filter($values, fn (?string $value): bool => filled($value)));

        return $details === [] ? null : implode(' · ', $details);
    }

    private function enumValue(mixed $value): ?string
    {
        if ($value instanceof BackedEnum) {
            return (string) $value->value;
        }

        return is_string($value) ? $value : null;
    }
}
