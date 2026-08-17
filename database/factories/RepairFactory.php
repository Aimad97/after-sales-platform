<?php

namespace Database\Factories;

use App\Enums\RepairResult;
use App\Enums\TicketStatus;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Repair> */
class RepairFactory extends Factory
{
    protected $model = Repair::class;

    public function configure(): static
    {
        return $this->afterCreating(function (Repair $repair): void {
            if ($repair->ticket->assigned_technician_id !== $repair->technician_id) {
                $repair->ticket->forceFill(['assigned_technician_id' => $repair->technician_id])->save();
            }
        });
    }

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'ticket_id' => Ticket::factory()->withStatus(TicketStatus::Diagnosing),
            'technician_id' => Technician::factory(),
            'diagnosis' => null,
            'root_cause' => null,
            'repair_action' => null,
            'internal_notes' => null,
            'customer_notes' => null,
            'labor_cost' => '0.00',
            'parts_cost' => '0.00',
            'total_cost' => '0.00',
            'started_at' => null,
            'completed_at' => null,
            'result' => null,
        ];
    }

    public function started(): static
    {
        return $this->state(fn (): array => ['started_at' => now()]);
    }

    public function completed(RepairResult $result = RepairResult::Repaired): static
    {
        return $this->state(fn (): array => [
            'diagnosis' => 'A validated diagnosis.',
            'repair_action' => 'The faulty component was replaced and tested.',
            'labor_cost' => '100.00',
            'parts_cost' => '50.00',
            'total_cost' => '150.00',
            'started_at' => now()->subHour(),
            'completed_at' => now(),
            'result' => $result,
        ]);
    }
}
