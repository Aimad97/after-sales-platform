<?php

namespace App\Enums;

enum TicketSource: string
{
    case Store = 'store';
    case Phone = 'phone';
    case Email = 'email';
    case Web = 'web';
}
