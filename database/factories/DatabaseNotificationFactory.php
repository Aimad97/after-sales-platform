<?php

namespace Database\Factories;

use App\Enums\NotificationType;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\DatabaseSavNotification;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;

/** @extends Factory<DatabaseNotification> */
class DatabaseNotificationFactory extends Factory
{
    protected $model = DatabaseNotification::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'type' => DatabaseSavNotification::class,
            'notifiable_type' => User::class,
            'notifiable_id' => User::factory(),
            'data' => [
                'type' => NotificationType::TicketStatusChanged->value,
                'title' => 'Service request updated',
                'message' => fake()->sentence(),
                'action_url' => '/admin/tickets',
                'context' => [],
            ],
            'read_at' => fake()->boolean(55) ? now()->subMinutes(fake()->numberBetween(1, 180)) : null,
            'created_at' => now()->subDays(fake()->numberBetween(0, 14)),
            'updated_at' => now(),
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn (): array => [
            'notifiable_type' => User::class,
            'notifiable_id' => $user->id,
        ]);
    }

    public function forTicket(Ticket $ticket, NotificationType $type = NotificationType::TicketStatusChanged): static
    {
        return $this->state(fn (): array => [
            'data' => [
                'type' => $type->value,
                'title' => "Ticket {$ticket->ticket_number} updated",
                'message' => "{$ticket->title} is now {$ticket->status->label()}.",
                'action_url' => "/admin/tickets/{$ticket->uuid}",
                'context' => [
                    'ticket_uuid' => $ticket->uuid,
                    'ticket_number' => $ticket->ticket_number,
                    'client_id' => $ticket->client_id,
                    'product_id' => $ticket->product_id,
                    'to_status' => $ticket->status->value,
                ],
            ],
        ]);
    }

    public function unread(): static
    {
        return $this->state(fn (): array => ['read_at' => null]);
    }

    public function read(): static
    {
        return $this->state(fn (): array => ['read_at' => now()]);
    }
}
