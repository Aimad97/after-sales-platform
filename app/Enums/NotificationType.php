<?php

namespace App\Enums;

enum NotificationType: string
{
    case TicketCreated = 'ticket_created';
    case TechnicianAssigned = 'technician_assigned';
    case TicketStatusChanged = 'ticket_status_changed';
    case DiagnosisCompleted = 'diagnosis_completed';
    case AwaitingCustomerApproval = 'awaiting_customer_approval';
    case RepairCompleted = 'repair_completed';
    case ReadyForPickup = 'ready_for_pickup';
    case WarrantyNearingExpiration = 'warranty_nearing_expiration';
}
