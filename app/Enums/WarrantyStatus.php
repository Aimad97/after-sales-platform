<?php

namespace App\Enums;

enum WarrantyStatus: string
{
    case Active = 'active';
    case Expired = 'expired';
    case Void = 'void';
    case Replaced = 'replaced';

    public function isTerminal(): bool
    {
        return $this === self::Void || $this === self::Replaced;
    }
}
