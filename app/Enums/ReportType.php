<?php

namespace App\Enums;

enum ReportType: string
{
    case Tickets = 'tickets';
    case Repairs = 'repairs';
    case Warranties = 'warranties';
    case TechnicianPerformance = 'technician_performance';
    case DefectiveProducts = 'defective_products';
    case ClientHistory = 'client_history';

    public function label(): string
    {
        return match ($this) {
            self::Tickets => 'Tickets report',
            self::Repairs => 'Repair report',
            self::Warranties => 'Warranty report',
            self::TechnicianPerformance => 'Technician performance',
            self::DefectiveProducts => 'Defective product analysis',
            self::ClientHistory => 'Client SAV history',
        };
    }
}
