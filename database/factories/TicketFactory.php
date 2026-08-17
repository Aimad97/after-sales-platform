<?php

namespace Database\Factories;

use App\Enums\TicketPriority;
use App\Enums\TicketSource;
use App\Enums\TicketStatus;
use App\Models\Client;
use App\Models\Product;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Ticket> */
class TicketFactory extends Factory
{
    protected $model = Ticket::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $title = Str::ucfirst(fake()->words(5, true));
        $description = fake()->paragraph();

        return [
            'uuid' => (string) Str::uuid(),
            'ticket_number' => 'TKT-'.now()->format('Ymd').'-'.Str::upper(fake()->unique()->bothify('??####')),
            'client_id' => Client::factory(),
            'customer_id' => fn (array $attributes): int => (int) $attributes['client_id'],
            'product_id' => Product::factory(),
            'warranty_id' => null,
            'invoice_item_id' => null,
            'title' => $title,
            'problem_description' => $description,
            'priority' => TicketPriority::Normal,
            'status' => TicketStatus::Opened,
            'source' => TicketSource::Web,
            'warranty_eligible' => false,
            'created_by' => User::factory(),
            'assigned_technician_id' => null,
            'received_at' => now(),
            'closed_at' => null,
            'customer_product_id' => null,
            'status_id' => null,
            'priority_id' => null,
            'subject' => $title,
            'description' => $description,
            'opened_at' => now(),
        ];
    }

    public function assignedTo(Technician $technician): static
    {
        return $this->state(fn (): array => ['assigned_technician_id' => $technician->id]);
    }

    public function forWarranty(Warranty $warranty): static
    {
        return $this->state(fn (): array => [
            'client_id' => $warranty->customer_id,
            'customer_id' => $warranty->customer_id,
            'product_id' => $warranty->product_id,
            'warranty_id' => $warranty->id,
            'customer_product_id' => $warranty->id,
            'invoice_item_id' => $warranty->invoice_item_id,
            'warranty_eligible' => $warranty->isUnderWarranty(),
        ]);
    }

    public function withStatus(TicketStatus $status): static
    {
        return $this->state(fn (): array => [
            'status' => $status,
            'closed_at' => $status->isTerminal() ? now() : null,
        ]);
    }

    public function closed(): static
    {
        return $this->withStatus(TicketStatus::Closed);
    }

    public function cancelled(): static
    {
        return $this->withStatus(TicketStatus::Cancelled);
    }
}
