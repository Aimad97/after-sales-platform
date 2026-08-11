<?php

namespace App\Services;

use App\Enums\RepairResult;
use App\Enums\TicketStatus;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RepairManagementService
{
    public function __construct(private readonly TicketWorkflowService $workflow) {}

    public function paginate(array $filters, User $actor): LengthAwarePaginator
    {
        return Repair::query()->with(['ticket.client', 'ticket.product', 'technician.user'])->withCount('history')
            ->when($actor->hasRole('technician') && ! $actor->hasAnyRole(['admin', 'super_admin']), fn ($q) => $q->whereHas('technician', fn ($q) => $q->where('user_id', $actor->id)))
            ->when($filters['technician_id'] ?? null, fn ($q, int $id) => $q->where('technician_id', $id))
            ->when(($filters['state'] ?? null) === 'current', fn ($q) => $q->whereNull('completed_at'))
            ->when(($filters['state'] ?? null) === 'completed', fn ($q) => $q->whereNotNull('completed_at'))
            ->latest('updated_at')->paginate($filters['per_page'] ?? 15)->withQueryString();
    }

    public function assignedTickets(User $actor): LengthAwarePaginator
    {
        $technician = Technician::query()->where('user_id', $actor->id)->first();
        return Ticket::query()->with(['client', 'product', 'repair'])->when($technician === null, fn ($q) => $q->whereRaw('1 = 0'), fn ($q) => $q->where('assigned_technician_id', $technician->id))->whereNotIn('status', [TicketStatus::Closed, TicketStatus::Cancelled])->latest('received_at')->paginate(20);
    }

    public function startDiagnosis(Ticket $ticket, User $actor): Repair
    {
        return DB::transaction(function () use ($ticket, $actor): Repair {
            $ticket = Ticket::query()->with('assignedTechnician')->lockForUpdate()->findOrFail($ticket->id);
            $this->assertAssigned($ticket);
            if ($ticket->repair()->exists()) throw ValidationException::withMessages(['ticket' => 'This ticket already has a repair record.']);
            $this->transitionTicket($ticket, TicketStatus::Diagnosing, $actor, 'Diagnosis started.');
            $repair = Repair::query()->create(['ticket_id' => $ticket->id, 'technician_id' => $ticket->assigned_technician_id]);
            $this->history($repair, 'diagnosis_started', [], $actor);
            return $this->load($repair);
        });
    }

    public function recordDiagnosis(Repair $repair, array $data, User $actor): Repair
    {
        return DB::transaction(function () use ($repair, $data, $actor): Repair {
            $repair = Repair::query()->with('ticket')->lockForUpdate()->findOrFail($repair->id);
            $repair->fill(['diagnosis' => trim($data['diagnosis']), 'root_cause' => filled($data['root_cause'] ?? null) ? trim($data['root_cause']) : null, 'customer_notes' => filled($data['customer_notes'] ?? null) ? trim($data['customer_notes']) : $repair->customer_notes])->save();
            $this->history($repair, 'diagnosis_recorded', ['diagnosis' => true, 'next_status' => $data['next_status']], $actor);
            $this->transitionTicket($repair->ticket, TicketStatus::from($data['next_status']), $actor, 'Diagnosis recorded.');
            return $this->load($repair);
        });
    }

    public function startRepair(Repair $repair, User $actor): Repair
    {
        return DB::transaction(function () use ($repair, $actor): Repair {
            $repair = Repair::query()->with('ticket')->lockForUpdate()->findOrFail($repair->id);
            if ($repair->started_at !== null) throw ValidationException::withMessages(['repair' => 'Repair work has already started.']);
            $this->transitionTicket($repair->ticket, TicketStatus::Repairing, $actor, 'Repair work started.');
            $repair->started_at = now(); $repair->save(); $this->history($repair, 'repair_started', [], $actor);
            return $this->load($repair);
        });
    }

    public function update(Repair $repair, array $data, User $actor): Repair
    {
        return DB::transaction(function () use ($repair, $data, $actor): Repair {
            $repair = Repair::query()->lockForUpdate()->findOrFail($repair->id);
            if ($repair->completed_at !== null) throw ValidationException::withMessages(['repair' => 'Completed repairs cannot be changed.']);
            $fields = ['repair_action', 'internal_notes', 'customer_notes', 'labor_cost', 'parts_cost'];
            $changes = array_intersect_key($data, array_flip($fields));
            foreach (['repair_action', 'internal_notes', 'customer_notes'] as $field) if (array_key_exists($field, $changes)) $changes[$field] = filled($changes[$field]) ? trim((string) $changes[$field]) : null;
            $changes['total_cost'] = $this->total($changes['labor_cost'] ?? $repair->labor_cost, $changes['parts_cost'] ?? $repair->parts_cost);
            $repair->fill($changes)->save();
            $this->history($repair, 'repair_updated', array_keys($changes), $actor);
            return $this->load($repair);
        });
    }

    public function complete(Repair $repair, array $data, User $actor): Repair
    {
        return DB::transaction(function () use ($repair, $data, $actor): Repair {
            $repair = Repair::query()->with('ticket')->lockForUpdate()->findOrFail($repair->id);
            if ($repair->started_at === null) throw ValidationException::withMessages(['repair' => 'Start repair work before completing it.']);
            $result = RepairResult::from($data['result']);
            $target = in_array($result, [RepairResult::Repaired, RepairResult::PartiallyRepaired], true) ? TicketStatus::Testing : TicketStatus::AwaitingCustomerApproval;
            $repair->fill(['result' => $result, 'customer_notes' => filled($data['customer_notes'] ?? null) ? trim($data['customer_notes']) : $repair->customer_notes, 'completed_at' => now(), 'total_cost' => $this->total($repair->labor_cost, $repair->parts_cost)])->save();
            $this->history($repair, 'repair_completed', ['result' => $result->value, 'total_cost' => $repair->total_cost], $actor);
            $this->transitionTicket($repair->ticket, $target, $actor, "Repair completed: {$result->value}.");
            return $this->load($repair);
        });
    }

    private function transitionTicket(Ticket $ticket, TicketStatus $to, User $actor, string $notes): void
    {
        $from = $ticket->status; $this->workflow->assertTransition($from, $to); $ticket->status = $to; $ticket->save();
        $ticket->statusHistory()->create(['from_status' => $from, 'to_status' => $to, 'transitioned_by' => $actor->id, 'notes' => $notes, 'transitioned_at' => now()]);
    }
    private function assertAssigned(Ticket $ticket): void { if ($ticket->assigned_technician_id === null) throw ValidationException::withMessages(['ticket' => 'Assign a technician before diagnosis can begin.']); }
    private function total(mixed $labor, mixed $parts): string { return number_format((float) $labor + (float) $parts, 2, '.', ''); }
    private function history(Repair $repair, string $event, array $changes, User $actor): void { $repair->history()->create(['event' => $event, 'changes' => $changes, 'changed_by' => $actor->id, 'occurred_at' => now()]); }
    private function load(Repair $repair): Repair { return $repair->refresh()->load(['ticket.client', 'ticket.product', 'technician.user', 'history.changedBy']); }
}
