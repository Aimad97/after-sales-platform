<?php

namespace App\Services;

use App\Enums\TicketStatus;
use Illuminate\Validation\ValidationException;

class TicketWorkflowService
{
    /**
     * @var array<string, list<TicketStatus>>
     */
    private const TRANSITIONS = [
        'opened' => [TicketStatus::Received],
        'received' => [TicketStatus::AwaitingDiagnosis],
        'awaiting_diagnosis' => [TicketStatus::Diagnosing],
        'diagnosing' => [
            TicketStatus::AwaitingCustomerApproval,
            TicketStatus::AwaitingPart,
            TicketStatus::Repairing,
        ],
        'awaiting_customer_approval' => [TicketStatus::Diagnosing],
        'awaiting_part' => [TicketStatus::Repairing],
        'repairing' => [TicketStatus::Testing, TicketStatus::AwaitingCustomerApproval],
        'testing' => [TicketStatus::Repaired],
        'repaired' => [TicketStatus::ReadyForPickup],
        'ready_for_pickup' => [TicketStatus::Delivered],
        'delivered' => [TicketStatus::Closed],
        'closed' => [],
        'cancelled' => [],
    ];

    /**
     * @return list<TicketStatus>
     */
    public function allowedNextStatuses(TicketStatus $from): array
    {
        return self::TRANSITIONS[$from->value];
    }

    public function canTransition(TicketStatus $from, TicketStatus $to): bool
    {
        return in_array($to, $this->allowedNextStatuses($from), true);
    }

    public function assertTransition(TicketStatus $from, TicketStatus $to): void
    {
        if ($this->canTransition($from, $to)) {
            return;
        }

        throw ValidationException::withMessages([
            'status' => sprintf('A ticket cannot transition from %s to %s.', $from->label(), $to->label()),
        ]);
    }

    public function assertCanCancel(TicketStatus $status): void
    {
        if (! $status->isTerminal()) {
            return;
        }

        throw ValidationException::withMessages([
            'ticket' => 'Closed or cancelled tickets cannot be cancelled.',
        ]);
    }
}
