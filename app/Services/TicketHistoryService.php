<?php
namespace App\Services;
use App\Models\Ticket;
use App\Models\User;
class TicketHistoryService { public function record(Ticket $ticket, string $event, string $description, ?User $actor, array $metadata=[]): void { $ticket->history()->create(['event'=>$event,'description'=>$description,'metadata'=>$metadata ?: null,'actor_id'=>$actor?->id,'occurred_at'=>now()]); } }
