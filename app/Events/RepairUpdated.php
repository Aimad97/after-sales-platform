<?php

namespace App\Events;

use App\Models\Repair;
use App\Models\User;
use App\Support\RealtimeChannels;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RepairUpdated implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    /**
     * @param  list<int>  $recipientUserIds
     * @param  array<string, mixed>  $repairPayload
     * @param  array<string, mixed>  $ticketPayload
     */
    public function __construct(
        public readonly Repair $repair,
        public readonly User $actor,
        private readonly array $recipientUserIds,
        private readonly array $repairPayload,
        private readonly array $ticketPayload,
    ) {}

    public function broadcastAs(): string
    {
        return 'repair.updated';
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return RealtimeChannels::users($this->recipientUserIds);
    }

    /**
     * @return array{repair: array<string, mixed>, ticket: array<string, mixed>, actor_id: int}
     */
    public function broadcastWith(): array
    {
        return [
            'repair' => $this->repairPayload,
            'ticket' => $this->ticketPayload,
            'actor_id' => $this->actor->id,
        ];
    }
}
