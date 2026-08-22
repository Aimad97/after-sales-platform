<?php

namespace App\Services;

use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Events\TechnicianAssigned;
use App\Events\TicketCreated;
use App\Events\TicketStatusChanged;
use App\Events\TicketUpdated;
use App\Models\Client;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TicketManagementService
{
    public function __construct(
        private readonly TicketWorkflowService $workflow,
        private readonly WarrantyEligibilityService $warrantyEligibility,
        private readonly TicketHistoryService $history,
        private readonly RealtimeAudienceService $realtimeAudience,
        private readonly RealtimePayloadService $realtimePayloads,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Ticket>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'received_at';
        $direction = $filters['direction'] ?? 'desc';

        return Ticket::query()
            ->with(['client', 'product', 'warranty', 'assignedTechnician.user', 'creator'])
            ->withCount('statusHistory')
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('ticket_number', 'like', "%{$term}%")
                        ->orWhere('uuid', 'like', "%{$term}%")
                        ->orWhere('title', 'like', "%{$term}%")
                        ->orWhere('problem_description', 'like', "%{$term}%")
                        ->orWhereHas('client', function ($query) use ($term): void {
                            $query->where('first_name', 'like', "%{$term}%")
                                ->orWhere('last_name', 'like', "%{$term}%")
                                ->orWhere('company_name', 'like', "%{$term}%")
                                ->orWhere('email', 'like', "%{$term}%");
                        })
                        ->orWhereHas('warranty', fn ($query) => $query->where('serial_number', 'like', "%{$term}%"));
                });
            })
            ->when($filters['client_id'] ?? null, fn ($query, int $id) => $query->where('client_id', $id))
            ->when($filters['product_id'] ?? null, fn ($query, int $id) => $query->where('product_id', $id))
            ->when($filters['warranty_id'] ?? null, fn ($query, int $id) => $query->where('warranty_id', $id))
            ->when($filters['assigned_technician_id'] ?? null, fn ($query, int $id) => $query->where('assigned_technician_id', $id))
            ->when($filters['created_by'] ?? null, fn ($query, int $id) => $query->where('created_by', $id))
            ->when($filters['priority'] ?? null, fn ($query, string $priority) => $query->where('priority', $priority))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['source'] ?? null, fn ($query, string $source) => $query->where('source', $source))
            ->when(array_key_exists('warranty_eligible', $filters), fn ($query) => $query->where('warranty_eligible', $filters['warranty_eligible']))
            ->when($filters['received_from'] ?? null, fn ($query, string $date) => $query->whereDate('received_at', '>=', $date))
            ->when($filters['received_to'] ?? null, fn ($query, string $date) => $query->whereDate('received_at', '<=', $date))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $actor): Ticket
    {
        $ticket = DB::transaction(function () use ($data, $actor): Ticket {
            $context = $this->resolveContext($data);
            $openedAt = now();
            $ticket = Ticket::query()->create([
                'uuid' => (string) Str::uuid(),
                'ticket_number' => $this->generateTicketNumber(),
                'client_id' => $context['client']->id,
                'product_id' => $context['product']->id,
                'warranty_id' => $context['warranty']?->id,
                'invoice_item_id' => $context['invoiceItem']?->id,
                'title' => trim((string) $data['title']),
                'problem_description' => trim((string) $data['problem_description']),
                'priority' => $data['priority'] ?? TicketPriority::Normal,
                'status' => TicketStatus::Opened,
                'source' => $data['source'] ?? 'web',
                'warranty_eligible' => $context['warrantyEligible'],
                'created_by' => $actor->id,
                'received_at' => now(),
                // Kept in sync only for the pre-Stage 9 schema that remains nullable
                // for backward compatibility with legacy integrations.
                'customer_id' => $context['client']->id,
                'customer_product_id' => $context['warranty']?->id,
                'status_id' => $this->legacyLookupId('ticket_statuses', 'Opened'),
                'priority_id' => $this->legacyLookupId('ticket_priorities', 'Normal'),
                'subject' => trim((string) $data['title']),
                'description' => trim((string) $data['problem_description']),
                'opened_at' => $openedAt,
            ]);

            $ticket->statusHistory()->create([
                'from_status' => null,
                'to_status' => TicketStatus::Opened,
                'transitioned_by' => $actor->id,
                'notes' => 'Ticket created.',
                'transitioned_at' => now(),
            ]);
            $this->history->record($ticket, 'ticket_created', 'Ticket created.', $actor);

            return $this->loadTicket($ticket);
        });

        TicketCreated::dispatch(
            $ticket,
            $actor,
            $this->realtimeAudience->ticketRecipientUserIds($ticket),
            $this->realtimePayloads->ticket($ticket),
        );

        return $ticket;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Ticket $ticket, array $data, User $actor): Ticket
    {
        $updatedTicket = DB::transaction(function () use ($ticket, $data, $actor): Ticket {
            $ticket = $this->lockedTicket($ticket);
            $ticket->fill([
                ...(array_key_exists('title', $data) ? ['title' => trim((string) $data['title'])] : []),
                ...(array_key_exists('problem_description', $data) ? ['problem_description' => trim((string) $data['problem_description'])] : []),
                ...(array_key_exists('source', $data) ? ['source' => $data['source']] : []),
            ])->save();
            $this->history->record($ticket, 'ticket_updated', 'Ticket information updated.', $actor);

            return $this->loadTicket($ticket);
        });

        TicketUpdated::dispatch(
            $updatedTicket,
            $actor,
            $this->realtimeAudience->ticketRecipientUserIds($updatedTicket),
            $this->realtimePayloads->ticket($updatedTicket),
        );

        return $updatedTicket;
    }

    public function assignTechnician(Ticket $ticket, int $technicianId, User $actor): Ticket
    {
        $technician = null;
        $updatedTicket = DB::transaction(function () use ($ticket, $technicianId, $actor, &$technician): Ticket {
            $ticket = $this->lockedTicket($ticket);
            $this->assertNotTerminal($ticket);

            $technician = Technician::query()->with('user')->findOrFail($technicianId);

            if (! $technician->user->hasRole('technician')) {
                throw ValidationException::withMessages([
                    'assigned_technician_id' => 'The selected profile does not belong to a technician user.',
                ]);
            }

            $ticket->assigned_technician_id = $technician->id;
            $ticket->save();
            $this->history->record($ticket, 'technician_assigned', "Technician assigned: {$technician->user->first_name} {$technician->user->last_name}.", $actor, ['technician_id' => $technician->id]);

            return $this->loadTicket($ticket);
        });

        if (! $technician instanceof Technician) {
            throw new \LogicException('The assigned technician could not be resolved.');
        }

        TechnicianAssigned::dispatch(
            $updatedTicket,
            $technician,
            $actor,
            $this->realtimeAudience->ticketRecipientUserIds($updatedTicket),
            $this->realtimePayloads->ticket($updatedTicket),
        );

        return $updatedTicket;
    }

    public function changePriority(Ticket $ticket, TicketPriority $priority, User $actor): Ticket
    {
        $updatedTicket = DB::transaction(function () use ($ticket, $priority, $actor): Ticket {
            $ticket = $this->lockedTicket($ticket);
            $this->assertNotTerminal($ticket);
            $ticket->priority = $priority;
            $ticket->save();
            $this->history->record($ticket, 'priority_changed', "Priority changed to {$priority->value}.", $actor, ['priority' => $priority->value]);

            return $this->loadTicket($ticket);
        });

        TicketUpdated::dispatch(
            $updatedTicket,
            $actor,
            $this->realtimeAudience->ticketRecipientUserIds($updatedTicket),
            $this->realtimePayloads->ticket($updatedTicket),
        );

        return $updatedTicket;
    }

    public function transition(Ticket $ticket, TicketStatus $to, User $actor, ?string $notes = null): Ticket
    {
        $from = null;
        $updatedTicket = DB::transaction(function () use ($ticket, $to, $actor, $notes, &$from): Ticket {
            $ticket = $this->lockedTicket($ticket);
            $from = $ticket->status;
            $this->workflow->assertTransition($from, $to);

            $ticket->status = $to;
            if ($to === TicketStatus::Closed) {
                $ticket->closed_at = now();
            }
            $ticket->save();
            $ticket->statusHistory()->create([
                'from_status' => $from,
                'to_status' => $to,
                'transitioned_by' => $actor->id,
                'notes' => filled($notes) ? trim($notes) : null,
                'transitioned_at' => now(),
            ]);
            $this->history->record($ticket, 'status_changed', "Status changed from {$from->value} to {$to->value}.", $actor, ['from' => $from->value, 'to' => $to->value]);

            return $this->loadTicket($ticket);
        });

        if (! $from instanceof TicketStatus) {
            throw new \LogicException('The previous ticket status could not be resolved.');
        }

        TicketStatusChanged::dispatch(
            $updatedTicket,
            $from,
            $to,
            $actor,
            $this->realtimeAudience->ticketRecipientUserIds($updatedTicket),
            $this->realtimePayloads->ticket($updatedTicket),
        );

        return $updatedTicket;
    }

    public function recordCustomerApprovalDecision(
        Ticket $ticket,
        bool $approved,
        User $actor,
        ?string $notes = null,
    ): Ticket {
        $from = null;
        $to = TicketStatus::Diagnosing;
        $decision = $approved ? 'approved' : 'changes_requested';
        $description = $approved
            ? 'Customer approved the repair plan.'
            : 'Customer requested changes to the repair plan.';
        $customerNotes = filled($notes) ? trim((string) $notes) : null;

        $updatedTicket = DB::transaction(function () use (
            $ticket,
            $actor,
            $to,
            $decision,
            $description,
            $customerNotes,
            &$from,
        ): Ticket {
            $ticket = $this->lockedTicket($ticket);
            $from = $ticket->status;

            if ($from !== TicketStatus::AwaitingCustomerApproval) {
                throw ValidationException::withMessages([
                    'decision' => 'This ticket is not awaiting customer approval.',
                ]);
            }

            $repair = $ticket->repair()->lockForUpdate()->first();

            if ($repair === null) {
                throw ValidationException::withMessages([
                    'decision' => 'A repair record is required before customer approval can be recorded.',
                ]);
            }

            $wasCompleted = $repair->completed_at !== null;
            $previousResult = $repair->result?->value;
            $previousCompletedAt = $repair->completed_at?->toISOString();

            if ($wasCompleted) {
                $repair->forceFill([
                    'completed_at' => null,
                    'result' => null,
                ])->save();
            }

            $this->workflow->assertTransition($from, $to);
            $statusNotes = $customerNotes === null
                ? $description
                : "{$description} Customer note: {$customerNotes}";

            $ticket->status = $to;
            $ticket->save();
            $ticket->statusHistory()->create([
                'from_status' => $from,
                'to_status' => $to,
                'transitioned_by' => $actor->id,
                'notes' => $statusNotes,
                'transitioned_at' => now(),
            ]);
            $repair->history()->create([
                'event' => 'customer_approval_'.$decision,
                'changes' => [
                    'decision' => $decision,
                    'notes' => $customerNotes,
                    'repair_reopened' => $wasCompleted,
                    'previous_result' => $previousResult,
                    'previous_completed_at' => $previousCompletedAt,
                ],
                'changed_by' => $actor->id,
                'occurred_at' => now(),
            ]);
            $this->history->record(
                $ticket,
                'customer_approval_responded',
                $description,
                $actor,
                ['decision' => $decision, 'notes' => $customerNotes],
            );

            return $this->loadTicket($ticket);
        });

        if (! $from instanceof TicketStatus) {
            throw new \LogicException('The customer approval transition could not be resolved.');
        }

        TicketStatusChanged::dispatch(
            $updatedTicket,
            $from,
            $to,
            $actor,
            $this->realtimeAudience->ticketRecipientUserIds($updatedTicket),
            $this->realtimePayloads->ticket($updatedTicket),
        );

        return $updatedTicket;
    }

    public function cancel(Ticket $ticket, User $actor, string $reason): Ticket
    {
        $from = null;
        $updatedTicket = DB::transaction(function () use ($ticket, $actor, $reason, &$from): Ticket {
            $ticket = $this->lockedTicket($ticket);
            $from = $ticket->status;
            $this->workflow->assertCanCancel($from);
            $ticket->status = TicketStatus::Cancelled;
            $ticket->closed_at = now();
            $ticket->save();
            $ticket->statusHistory()->create([
                'from_status' => $from,
                'to_status' => TicketStatus::Cancelled,
                'transitioned_by' => $actor->id,
                'notes' => trim($reason),
                'transitioned_at' => now(),
            ]);
            $this->history->record($ticket, 'ticket_cancelled', 'Ticket cancelled.', $actor, ['reason' => trim($reason)]);

            return $this->loadTicket($ticket);
        });

        if (! $from instanceof TicketStatus) {
            throw new \LogicException('The previous ticket status could not be resolved.');
        }

        TicketStatusChanged::dispatch(
            $updatedTicket,
            $from,
            TicketStatus::Cancelled,
            $actor,
            $this->realtimeAudience->ticketRecipientUserIds($updatedTicket),
            $this->realtimePayloads->ticket($updatedTicket),
        );

        return $updatedTicket;
    }

    private function lockedTicket(Ticket $ticket): Ticket
    {
        return Ticket::query()->lockForUpdate()->findOrFail($ticket->id);
    }

    private function assertNotTerminal(Ticket $ticket): void
    {
        if (! $ticket->status->isTerminal()) {
            return;
        }

        throw ValidationException::withMessages([
            'ticket' => 'Closed or cancelled tickets cannot be changed.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{client: Client, product: Product, warranty: Warranty|null, invoiceItem: InvoiceItem|null, warrantyEligible: bool}
     */
    private function resolveContext(array $data): array
    {
        $client = Client::query()->findOrFail($data['client_id']);
        $product = Product::query()->findOrFail($data['product_id']);
        $warranty = filled($data['warranty_id'] ?? null)
            ? Warranty::query()->findOrFail($data['warranty_id'])
            : null;
        $invoiceItem = filled($data['invoice_item_id'] ?? null)
            ? InvoiceItem::query()->with('invoice')->findOrFail($data['invoice_item_id'])
            : null;
        $errors = [];

        if ($warranty !== null) {
            if ($warranty->customer_id !== $client->id) {
                $errors['warranty_id'] = 'The selected warranty does not belong to this client.';
            }

            if ($warranty->product_id !== $product->id) {
                $errors['warranty_id'] = 'The selected warranty does not match this product.';
            }

            $invoiceItem ??= $warranty->invoiceItem;
        }

        if ($invoiceItem !== null) {
            if ($invoiceItem->product_id !== $product->id) {
                $errors['invoice_item_id'] = 'The selected invoice item does not match this product.';
            }

            if ($invoiceItem->invoice?->client_id !== $client->id) {
                $errors['invoice_item_id'] = 'The selected invoice item does not belong to this client.';
            }

            if ($warranty !== null && $warranty->invoice_item_id !== null && $warranty->invoice_item_id !== $invoiceItem->id) {
                $errors['invoice_item_id'] = 'The selected invoice item does not match this warranty.';
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return [
            'client' => $client,
            'product' => $product,
            'warranty' => $warranty,
            'invoiceItem' => $invoiceItem,
            'warrantyEligible' => $warranty !== null && $this->warrantyEligibility->evaluate($warranty)['is_under_warranty'],
        ];
    }

    private function generateTicketNumber(): string
    {
        do {
            $number = sprintf('TKT-%s-%s', now()->format('Ymd'), Str::upper(Str::random(6)));
        } while (Ticket::query()->where('ticket_number', $number)->exists());

        return $number;
    }

    private function legacyLookupId(string $table, string $name): int
    {
        $id = DB::table($table)->where('name', $name)->value('id');

        if ($id !== null) {
            return (int) $id;
        }

        return (int) DB::table($table)->insertGetId([
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function loadTicket(Ticket $ticket): Ticket
    {
        return $ticket->refresh()->load([
            'client',
            'product',
            'warranty',
            'invoiceItem.invoice',
            'creator',
            'assignedTechnician.user',
            'statusHistory.transitionedBy',
            'history.actor',
        ]);
    }
}
