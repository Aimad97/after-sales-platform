<?php

namespace Tests\Unit\Services;

use App\Enums\TicketStatus;
use App\Services\TicketWorkflowService;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TicketWorkflowServiceTest extends TestCase
{
    #[DataProvider('transitionMatrix')]
    public function test_only_the_defined_next_statuses_are_allowed(TicketStatus $from, array $expected): void
    {
        $workflow = new TicketWorkflowService;
        $actual = array_map(
            static fn (TicketStatus $status): string => $status->value,
            $workflow->allowedNextStatuses($from),
        );

        $this->assertSame($expected, $actual);

        foreach (TicketStatus::cases() as $candidate) {
            $this->assertSame(
                in_array($candidate->value, $expected, true),
                $workflow->canTransition($from, $candidate),
                "Unexpected transition decision for {$from->value} -> {$candidate->value}.",
            );
        }
    }

    public function test_invalid_transition_returns_a_status_validation_error(): void
    {
        $workflow = new TicketWorkflowService;

        try {
            $workflow->assertTransition(TicketStatus::Opened, TicketStatus::Repairing);
            $this->fail('An arbitrary ticket transition was accepted.');
        } catch (ValidationException $exception) {
            $this->assertSame(
                ['A ticket cannot transition from Opened to Repairing.'],
                $exception->errors()['status'],
            );
        }
    }

    public function test_only_terminal_tickets_are_rejected_for_cancellation(): void
    {
        $workflow = new TicketWorkflowService;

        foreach (TicketStatus::cases() as $status) {
            if (! $status->isTerminal()) {
                $workflow->assertCanCancel($status);
                $this->addToAssertionCount(1);

                continue;
            }

            try {
                $workflow->assertCanCancel($status);
                $this->fail("Terminal status {$status->value} was accepted for cancellation.");
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('ticket', $exception->errors());
            }
        }
    }

    /** @return array<string, array{TicketStatus, list<string>}> */
    public static function transitionMatrix(): array
    {
        return [
            'opened' => [TicketStatus::Opened, ['received']],
            'received' => [TicketStatus::Received, ['awaiting_diagnosis']],
            'awaiting diagnosis' => [TicketStatus::AwaitingDiagnosis, ['diagnosing']],
            'diagnosing' => [TicketStatus::Diagnosing, ['awaiting_customer_approval', 'awaiting_part', 'repairing']],
            'awaiting customer approval' => [TicketStatus::AwaitingCustomerApproval, ['diagnosing']],
            'awaiting part' => [TicketStatus::AwaitingPart, ['repairing']],
            'repairing' => [TicketStatus::Repairing, ['testing', 'awaiting_customer_approval']],
            'testing' => [TicketStatus::Testing, ['repaired']],
            'repaired' => [TicketStatus::Repaired, ['ready_for_pickup']],
            'ready for pickup' => [TicketStatus::ReadyForPickup, ['delivered']],
            'delivered' => [TicketStatus::Delivered, ['closed']],
            'closed' => [TicketStatus::Closed, []],
            'cancelled' => [TicketStatus::Cancelled, []],
        ];
    }
}
