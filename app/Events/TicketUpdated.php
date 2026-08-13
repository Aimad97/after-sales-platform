<?php

namespace App\Events;

use App\Models\Ticket;
use App\Models\User;
use App\Support\RealtimeChannels;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TicketUpdated implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    /**
     * @param  list<int>  $recipientUserIds
     * @param  array<string, mixed>  $ticketPayload
     */
    public function __construct(
        public readonly Ticket $ticket,
        public readonly User $actor,
        private readonly array $recipientUserIds,
        private readonly array $ticketPayload,
    ) {}

    public function broadcastAs(): string
    {
        return 'ticket.updated';
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return RealtimeChannels::ticketAndUsers($this->ticket->id, $this->recipientUserIds);
    }

    /**
     * @return array{ticket: array<string, mixed>, actor_id: int}
     */
    public function broadcastWith(): array
    {
        return [
            'ticket' => $this->ticketPayload,
            'actor_id' => $this->actor->id,
        ];
    }
}
