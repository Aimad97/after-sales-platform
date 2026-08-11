<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Issued = 'issued';
    case Void = 'void';

    public function isEditable(): bool
    {
        return $this === self::Draft;
    }
}
