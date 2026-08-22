<?php

namespace App\Services;

use App\Enums\TicketPriority;
use App\Enums\TicketSource;
use App\Enums\WarrantyStatus;
use App\Models\Client;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ClientPortalService
{
    public function __construct(private readonly TicketManagementService $tickets) {}

    public function clientFor(User $user): Client
    {
        if (! $user->hasClientPortalAccess()) {
            throw new AuthorizationException('This client portal account is not linked to a client profile.');
        }

        return $user->client()->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Warranty>
     */
    public function products(User $user, array $filters): LengthAwarePaginator
    {
        $client = $this->clientFor($user);
        $search = $filters['search'] ?? null;
        $status = $filters['status'] ?? null;

        return Warranty::query()
            ->where('customer_id', $client->id)
            ->with(['product.brand', 'product.category'])
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('serial_number', 'like', "%{$term}%")
                        ->orWhereHas('product', fn ($query) => $query
                            ->where('name', 'like', "%{$term}%")
                            ->orWhere('sku', 'like', "%{$term}%")
                            ->orWhere('model', 'like', "%{$term}%"));
                });
            })
            ->when($status, function ($query, string $status): void {
                match ($status) {
                    WarrantyStatus::Active->value => $query->active(),
                    WarrantyStatus::Expired->value => $query->expired(),
                    default => $query->where('status', $status),
                };
            })
            ->latest('purchase_date')
            ->latest('id')
            ->paginate((int) ($filters['per_page'] ?? 12))
            ->withQueryString();
    }

    public function product(Warranty $warranty): Warranty
    {
        return $warranty->load(['product.brand', 'product.category']);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Ticket>
     */
    public function ticketHistory(User $user, array $filters): LengthAwarePaginator
    {
        $client = $this->clientFor($user);
        $search = $filters['search'] ?? null;

        return Ticket::query()
            ->where('client_id', $client->id)
            ->with(['product', 'warranty'])
            ->when($search, fn ($query, string $term) => $query->where(function ($query) use ($term): void {
                $query->where('ticket_number', 'like', "%{$term}%")
                    ->orWhere('title', 'like', "%{$term}%")
                    ->orWhere('problem_description', 'like', "%{$term}%")
                    ->orWhereHas('product', fn ($query) => $query->where('name', 'like', "%{$term}%"));
            }))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->latest('received_at')
            ->latest('id')
            ->paginate((int) ($filters['per_page'] ?? 10))
            ->withQueryString();
    }

    /** @param array<string, mixed> $data */
    public function createTicket(User $user, array $data): Ticket
    {
        $client = $this->clientFor($user);
        $warranty = Warranty::query()
            ->where('customer_id', $client->id)
            ->where('uuid', $data['purchased_product_uuid'])
            ->firstOrFail();

        return $this->tickets->create([
            'client_id' => $client->id,
            'product_id' => $warranty->product_id,
            'warranty_id' => $warranty->id,
            'invoice_item_id' => $warranty->invoice_item_id,
            'title' => $data['title'],
            'problem_description' => $data['problem_description'],
            'priority' => TicketPriority::Normal,
            'source' => TicketSource::Web,
        ], $user);
    }

    public function ticket(User $user, Ticket $ticket): Ticket
    {
        $client = $this->clientFor($user);
        $ticket->load([
            'product',
            'warranty',
            'assignedTechnician.user',
            'statusHistory',
            'repair',
        ]);

        $attachments = $ticket->attachments()
            ->whereHas('uploadedBy', fn ($query) => $query
                ->where('client_id', $client->id)
                ->role('client')
                ->whereDoesntHave('roles', fn ($query) => $query->whereIn('name', ['super_admin', 'admin', 'sav_agent', 'technician'])))
            ->with('uploadedBy')
            ->get();

        return $ticket->setRelation('attachments', $attachments);
    }

    public function respondToRepairApproval(
        User $user,
        Ticket $ticket,
        bool $approved,
        ?string $notes = null,
    ): Ticket {
        $this->clientFor($user);
        $updatedTicket = $this->tickets->recordCustomerApprovalDecision($ticket, $approved, $user, $notes);

        return $this->ticket($user, $updatedTicket);
    }
}
