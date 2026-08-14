<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Enums\TicketStatus;
use App\Enums\UserStatus;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use App\Notifications\DatabaseSavNotification;
use App\Notifications\QueuedSavMailNotification;
use App\Notifications\SavNotificationData;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

class NotificationDeliveryService
{
    public function ticketCreated(Ticket $ticket, User $actor): void
    {
        $ticket->loadMissing(['client.users.roles', 'creator', 'assignedTechnician.user']);

        $this->deliverTicketUpdate(
            $ticket,
            new SavNotificationData(
                NotificationType::TicketCreated,
                "Ticket {$ticket->ticket_number} created",
                "{$this->clientName($ticket)} has a new support request: {$ticket->title}.",
                $this->ticketUrl($ticket),
                $this->ticketContext($ticket, ['actor_id' => $actor->id]),
            ),
        );
    }

    public function technicianAssigned(Ticket $ticket, Technician $technician, User $actor): void
    {
        $ticket->loadMissing(['client.users.roles', 'creator', 'assignedTechnician.user']);
        $technician->loadMissing('user');
        $technicianName = trim("{$technician->user?->first_name} {$technician->user?->last_name}");

        $this->deliverTicketUpdate(
            $ticket,
            new SavNotificationData(
                NotificationType::TechnicianAssigned,
                "Technician assigned to {$ticket->ticket_number}",
                "{$technicianName} is assigned to ticket {$ticket->ticket_number}.",
                $this->ticketUrl($ticket),
                $this->ticketContext($ticket, [
                    'actor_id' => $actor->id,
                    'technician_id' => $technician->id,
                ]),
            ),
        );
    }

    public function ticketStatusChanged(Ticket $ticket, TicketStatus $from, TicketStatus $to, User $actor): void
    {
        $ticket->loadMissing(['client.users.roles', 'creator', 'assignedTechnician.user']);
        $type = match ($to) {
            TicketStatus::AwaitingCustomerApproval => NotificationType::AwaitingCustomerApproval,
            TicketStatus::ReadyForPickup => NotificationType::ReadyForPickup,
            default => NotificationType::TicketStatusChanged,
        };
        $title = match ($type) {
            NotificationType::AwaitingCustomerApproval => "Customer approval needed for {$ticket->ticket_number}",
            NotificationType::ReadyForPickup => "Ticket {$ticket->ticket_number} is ready for pickup",
            default => "Ticket {$ticket->ticket_number} status updated",
        };
        $message = match ($type) {
            NotificationType::AwaitingCustomerApproval => "Ticket {$ticket->ticket_number} is awaiting customer approval.",
            NotificationType::ReadyForPickup => "Ticket {$ticket->ticket_number} is repaired and ready for pickup.",
            default => "Ticket {$ticket->ticket_number} changed from {$from->label()} to {$to->label()}.",
        };

        $this->deliverTicketUpdate(
            $ticket,
            new SavNotificationData(
                $type,
                $title,
                $message,
                $this->ticketUrl($ticket),
                $this->ticketContext($ticket, [
                    'actor_id' => $actor->id,
                    'from_status' => $from->value,
                    'to_status' => $to->value,
                ]),
            ),
        );
    }

    public function diagnosisCompleted(Repair $repair, User $actor): void
    {
        $repair->loadMissing(['ticket.client.users.roles', 'ticket.creator', 'ticket.assignedTechnician.user']);
        $ticket = $repair->ticket;

        $this->deliverTicketUpdate(
            $ticket,
            new SavNotificationData(
                NotificationType::DiagnosisCompleted,
                "Diagnosis completed for {$ticket->ticket_number}",
                "A diagnosis has been completed for ticket {$ticket->ticket_number}.",
                $this->repairUrl($repair),
                $this->ticketContext($ticket, [
                    'actor_id' => $actor->id,
                    'repair_id' => $repair->id,
                ]),
            ),
        );
    }

    public function repairCompleted(Repair $repair, User $actor): void
    {
        $repair->loadMissing(['ticket.client.users.roles', 'ticket.creator', 'ticket.assignedTechnician.user']);
        $ticket = $repair->ticket;
        $result = $repair->result?->value ?? 'completed';

        $this->deliverTicketUpdate(
            $ticket,
            new SavNotificationData(
                NotificationType::RepairCompleted,
                "Repair completed for {$ticket->ticket_number}",
                "Repair work for ticket {$ticket->ticket_number} is complete ({$result}).",
                $this->repairUrl($repair),
                $this->ticketContext($ticket, [
                    'actor_id' => $actor->id,
                    'repair_id' => $repair->id,
                    'result' => $result,
                ]),
            ),
        );
    }

    public function warrantyNearingExpiration(Warranty $warranty, int $daysBeforeExpiry): void
    {
        $warranty->loadMissing(['client.users.roles', 'product']);
        $clientName = $warranty->client?->display_name ?? 'A client';
        $productName = $warranty->product?->name ?? 'product';
        $payload = new SavNotificationData(
            NotificationType::WarrantyNearingExpiration,
            'Warranty expiration reminder',
            "{$clientName}'s warranty for {$productName} expires in {$daysBeforeExpiry} days.",
            $this->warrantyUrl($warranty),
            [
                'warranty_uuid' => $warranty->uuid,
                'serial_number' => $warranty->serial_number,
                'expires_at' => $warranty->expires_at?->toDateString(),
                'days_before_expiry' => $daysBeforeExpiry,
            ],
        );

        $this->deliver(
            $this->operationsRecipients()
                ->merge(($warranty->client?->users ?? collect())->filter(fn (User $user): bool => $user->hasClientPortalAccess()))
                ->filter(fn (User $user): bool => $user->status === UserStatus::Active)
                ->unique('id')
                ->values(),
            $payload,
            $warranty->client?->email,
        );
    }

    private function deliverTicketUpdate(Ticket $ticket, SavNotificationData $payload): void
    {
        $this->deliver(
            $this->ticketRecipients($ticket),
            $payload,
            $ticket->client?->email,
        );
    }

    /**
     * @param  Collection<int, User>  $recipients
     */
    private function deliver(Collection $recipients, SavNotificationData $payload, ?string $customerEmail = null): void
    {
        if ($recipients->isNotEmpty()) {
            Notification::sendNow($recipients, new DatabaseSavNotification($payload));
            Notification::send($recipients, new QueuedSavMailNotification($payload));
        }

        $normalizedCustomerEmail = filled($customerEmail) ? strtolower(trim((string) $customerEmail)) : null;

        if (
            $normalizedCustomerEmail !== null
            && ! $recipients->contains(
                fn (User $user): bool => strtolower($user->email) === $normalizedCustomerEmail,
            )
        ) {
            Notification::route('mail', $normalizedCustomerEmail)
                ->notify(new QueuedSavMailNotification($payload));
        }
    }

    /**
     * @return Collection<int, User>
     */
    private function ticketRecipients(Ticket $ticket): Collection
    {
        $directRecipients = collect([
            $ticket->creator,
            $ticket->assignedTechnician?->user,
        ])->filter(fn (mixed $user): bool => $user instanceof User);

        $clientRecipients = ($ticket->client?->users ?? collect())
            ->filter(fn (User $user): bool => $user->hasClientPortalAccess());

        return $this->operationsRecipients()
            ->merge($directRecipients)
            ->merge($clientRecipients)
            ->filter(fn (User $user): bool => $user->status === UserStatus::Active)
            ->unique('id')
            ->values();
    }

    /**
     * @return Collection<int, User>
     */
    private function operationsRecipients(): Collection
    {
        return User::query()
            ->role(['super_admin', 'admin', 'sav_agent'])
            ->where('status', UserStatus::Active->value)
            ->get();
    }

    /**
     * @param  array<string, mixed>  $additionalContext
     * @return array<string, mixed>
     */
    private function ticketContext(Ticket $ticket, array $additionalContext = []): array
    {
        return [
            'ticket_uuid' => $ticket->uuid,
            'ticket_number' => $ticket->ticket_number,
            'client_id' => $ticket->client_id,
            'product_id' => $ticket->product_id,
            ...$additionalContext,
        ];
    }

    private function clientName(Ticket $ticket): string
    {
        return $ticket->client?->display_name ?? 'A client';
    }

    private function ticketUrl(Ticket $ticket): string
    {
        return "/admin/tickets/{$ticket->uuid}";
    }

    private function repairUrl(Repair $repair): string
    {
        return "/admin/repairs/{$repair->id}";
    }

    private function warrantyUrl(Warranty $warranty): string
    {
        return "/admin/warranties/{$warranty->uuid}";
    }
}
