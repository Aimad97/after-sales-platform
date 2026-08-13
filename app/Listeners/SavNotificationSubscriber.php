<?php

namespace App\Listeners;

use App\Events\DiagnosisCompleted;
use App\Events\RepairCompleted;
use App\Events\TechnicianAssigned;
use App\Events\TicketCreated;
use App\Events\TicketStatusChanged;
use App\Events\WarrantyNearingExpiration;
use App\Services\NotificationDeliveryService;
use Illuminate\Events\Dispatcher;

class SavNotificationSubscriber
{
    public function __construct(private readonly NotificationDeliveryService $notifications) {}

    public function handleTicketCreated(TicketCreated $event): void
    {
        $this->notifications->ticketCreated($event->ticket, $event->actor);
    }

    public function handleTechnicianAssigned(TechnicianAssigned $event): void
    {
        $this->notifications->technicianAssigned($event->ticket, $event->technician, $event->actor);
    }

    public function handleTicketStatusChanged(TicketStatusChanged $event): void
    {
        $this->notifications->ticketStatusChanged($event->ticket, $event->from, $event->to, $event->actor);
    }

    public function handleDiagnosisCompleted(DiagnosisCompleted $event): void
    {
        $this->notifications->diagnosisCompleted($event->repair, $event->actor);
    }

    public function handleRepairCompleted(RepairCompleted $event): void
    {
        $this->notifications->repairCompleted($event->repair, $event->actor);
    }

    public function handleWarrantyNearingExpiration(WarrantyNearingExpiration $event): void
    {
        $this->notifications->warrantyNearingExpiration($event->warranty, $event->daysBeforeExpiry);
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(TicketCreated::class, [self::class, 'handleTicketCreated']);
        $events->listen(TechnicianAssigned::class, [self::class, 'handleTechnicianAssigned']);
        $events->listen(TicketStatusChanged::class, [self::class, 'handleTicketStatusChanged']);
        $events->listen(DiagnosisCompleted::class, [self::class, 'handleDiagnosisCompleted']);
        $events->listen(RepairCompleted::class, [self::class, 'handleRepairCompleted']);
        $events->listen(WarrantyNearingExpiration::class, [self::class, 'handleWarrantyNearingExpiration']);
    }
}
