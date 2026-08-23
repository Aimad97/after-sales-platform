<?php

namespace Tests\Feature\Repairs;

use App\Enums\TicketStatus;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class RepairWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Event::fake();
    }

    public function test_technician_cannot_view_or_modify_another_technicians_repair(): void
    {
        [$assignedUser, $assignedTechnician] = $this->technician();
        [$otherUser, $otherTechnician] = $this->technician();
        $assignedRepair = $this->repairFor($assignedTechnician);
        $ownRepair = $this->repairFor($otherTechnician);

        $this->actingAs($otherUser)
            ->getJson("/api/repairs/{$assignedRepair->id}")
            ->assertForbidden();
        $this->actingAs($otherUser)
            ->patchJson("/api/repairs/{$assignedRepair->id}", ['internal_notes' => 'Unauthorized change'])
            ->assertForbidden();
        $this->actingAs($otherUser)
            ->postJson("/api/repairs/{$assignedRepair->id}/diagnosis", [
                'diagnosis' => 'Unauthorized diagnosis',
                'next_status' => 'awaiting_part',
            ])
            ->assertForbidden();
        $this->actingAs($otherUser)
            ->postJson("/api/repairs/{$assignedRepair->id}/start")
            ->assertForbidden();
        $this->actingAs($otherUser)
            ->postJson("/api/repairs/{$assignedRepair->id}/complete", ['result' => 'repaired'])
            ->assertForbidden();

        $this->actingAs($otherUser)
            ->getJson('/api/repairs')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $ownRepair->id)
            ->assertJsonMissing(['id' => $assignedRepair->id]);

        $this->assertDatabaseMissing('repair_histories', [
            'repair_id' => $assignedRepair->id,
            'changed_by' => $otherUser->id,
        ]);
        $this->assertSame($assignedUser->id, $assignedRepair->technician->user_id);
    }

    public function test_diagnosis_requires_an_assigned_technician(): void
    {
        $admin = $this->userWithRole('admin');
        [$technicianUser] = $this->technician();
        $ticket = Ticket::factory()->withStatus(TicketStatus::AwaitingDiagnosis)->create();

        $this->actingAs($technicianUser)
            ->postJson("/api/tickets/{$ticket->uuid}/repair/diagnosis")
            ->assertForbidden();

        $this->actingAs($admin)
            ->postJson("/api/tickets/{$ticket->uuid}/repair/diagnosis")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ticket');

        $this->assertDatabaseMissing('repairs', ['ticket_id' => $ticket->id]);
        $this->assertSame(TicketStatus::AwaitingDiagnosis, $ticket->fresh()->status);
    }

    public function test_assigned_technician_completes_repair_in_order_and_cost_totals_are_server_owned(): void
    {
        [$technicianUser, $technician] = $this->technician();
        $ticket = Ticket::factory()
            ->assignedTo($technician)
            ->withStatus(TicketStatus::AwaitingDiagnosis)
            ->create();

        $created = $this->actingAs($technicianUser)
            ->postJson("/api/tickets/{$ticket->uuid}/repair/diagnosis")
            ->assertCreated()
            ->assertJsonPath('data.ticket.status', 'diagnosing');

        $repairId = (int) $created->json('data.id');

        $this->actingAs($technicianUser)
            ->patchJson("/api/repairs/{$repairId}", [
                'internal_notes' => 'Inspect the power board before replacement.',
                'labor_cost' => '80.25',
                'parts_cost' => '20.10',
                'total_cost' => '0.01',
            ])
            ->assertOk()
            ->assertJsonPath('data.total_cost', '100.35');

        $this->actingAs($technicianUser)
            ->postJson("/api/repairs/{$repairId}/complete", ['result' => 'repaired'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('repair');

        $this->actingAs($technicianUser)
            ->postJson("/api/repairs/{$repairId}/diagnosis", [
                'diagnosis' => 'A failed power board causes intermittent shutdowns.',
                'root_cause' => 'Power surge damage.',
                'next_status' => 'awaiting_part',
            ])
            ->assertOk()
            ->assertJsonPath('data.ticket.status', 'awaiting_part');

        $this->actingAs($technicianUser)
            ->postJson("/api/repairs/{$repairId}/start")
            ->assertOk()
            ->assertJsonPath('data.ticket.status', 'repairing');
        $this->actingAs($technicianUser)
            ->postJson("/api/repairs/{$repairId}/start")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('repair');

        $this->actingAs($technicianUser)
            ->postJson("/api/repairs/{$repairId}/complete", [
                'result' => 'repaired',
                'customer_notes' => 'Power board replaced and burn-in test completed.',
            ])
            ->assertOk()
            ->assertJsonPath('data.result', 'repaired')
            ->assertJsonPath('data.total_cost', '100.35')
            ->assertJsonPath('data.ticket.status', 'testing');

        $this->actingAs($technicianUser)
            ->patchJson("/api/repairs/{$repairId}", ['labor_cost' => '1.00'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('repair');

        $repair = Repair::query()->findOrFail($repairId);
        $this->assertSame('100.35', $repair->total_cost);
        $this->assertNotNull($repair->completed_at);
        $this->assertDatabaseHas('repair_histories', ['repair_id' => $repairId, 'event' => 'diagnosis_started']);
        $this->assertDatabaseHas('repair_histories', ['repair_id' => $repairId, 'event' => 'diagnosis_recorded']);
        $this->assertDatabaseHas('repair_histories', ['repair_id' => $repairId, 'event' => 'repair_started']);
        $this->assertDatabaseHas('repair_histories', ['repair_id' => $repairId, 'event' => 'repair_completed']);
    }

    public function test_unrepairable_outcome_returns_ticket_for_customer_approval(): void
    {
        [$technicianUser, $technician] = $this->technician();
        $ticket = Ticket::factory()
            ->assignedTo($technician)
            ->withStatus(TicketStatus::Repairing)
            ->create();
        $repair = Repair::factory()
            ->for($ticket)
            ->for($technician, 'technician')
            ->started()
            ->create();

        $this->actingAs($technicianUser)
            ->postJson("/api/repairs/{$repair->id}/complete", ['result' => 'unrepairable'])
            ->assertOk()
            ->assertJsonPath('data.result', 'unrepairable')
            ->assertJsonPath('data.ticket.status', 'awaiting_customer_approval');

        $this->assertSame(TicketStatus::AwaitingCustomerApproval, $ticket->fresh()->status);
    }

    public function test_customer_approval_status_requires_and_saves_the_quote_with_the_diagnosis(): void
    {
        [$technicianUser, $technician] = $this->technician();
        $repair = $this->repairFor($technician);

        $this->actingAs($technicianUser)
            ->postJson("/api/repairs/{$repair->id}/diagnosis", [
                'diagnosis' => 'The paper-feed assembly needs replacement.',
                'next_status' => 'awaiting_customer_approval',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['labor_cost', 'parts_cost']);

        $this->actingAs($technicianUser)
            ->postJson("/api/repairs/{$repair->id}/diagnosis", [
                'diagnosis' => 'The paper-feed assembly needs replacement.',
                'customer_notes' => 'The estimate includes installation and testing.',
                'labor_cost' => '125.50',
                'parts_cost' => '300.25',
                'next_status' => 'awaiting_customer_approval',
            ])
            ->assertOk()
            ->assertJsonPath('data.labor_cost', '125.50')
            ->assertJsonPath('data.parts_cost', '300.25')
            ->assertJsonPath('data.total_cost', '425.75')
            ->assertJsonPath('data.ticket.status', 'awaiting_customer_approval');

        $repair->refresh();
        $this->assertSame('425.75', $repair->total_cost);
        $history = $repair->history()->where('event', 'diagnosis_recorded')->latest('id')->firstOrFail();
        $this->assertSame('425.75', $history->changes['quote']['total_cost']);
        $this->assertSame('MAD', $history->changes['quote']['currency']);
    }

    private function repairFor(Technician $technician): Repair
    {
        $ticket = Ticket::factory()
            ->assignedTo($technician)
            ->withStatus(TicketStatus::Diagnosing)
            ->create();

        return Repair::factory()
            ->for($ticket)
            ->for($technician, 'technician')
            ->create();
    }

    /** @return array{User, Technician} */
    private function technician(): array
    {
        $user = $this->userWithRole('technician');
        $technician = Technician::factory()->for($user)->create();

        return [$user, $technician];
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
