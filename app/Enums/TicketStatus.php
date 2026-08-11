<?php

namespace App\Enums;

use Illuminate\Support\Str;

enum TicketStatus: string
{
    case Opened = 'opened';
    case Received = 'received';
    case AwaitingDiagnosis = 'awaiting_diagnosis';
    case Diagnosing = 'diagnosing';
    case AwaitingCustomerApproval = 'awaiting_customer_approval';
    case AwaitingPart = 'awaiting_part';
    case Repairing = 'repairing';
    case Testing = 'testing';
    case Repaired = 'repaired';
    case ReadyForPickup = 'ready_for_pickup';
    case Delivered = 'delivered';
    case Closed = 'closed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::AwaitingDiagnosis => 'Awaiting diagnosis',
            self::AwaitingCustomerApproval => 'Awaiting customer approval',
            self::AwaitingPart => 'Awaiting part',
            self::ReadyForPickup => 'Ready for pickup',
            default => Str::headline($this->value),
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Closed, self::Cancelled], true);
    }
}
