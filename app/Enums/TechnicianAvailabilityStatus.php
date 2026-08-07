<?php

namespace App\Enums;

enum TechnicianAvailabilityStatus: string
{
    case Available = 'available';
    case Busy = 'busy';
    case Unavailable = 'unavailable';
    case Leave = 'leave';
}
