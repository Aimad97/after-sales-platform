<?php

namespace App\Enums;

enum RepairResult: string
{
    case Repaired = 'repaired';
    case PartiallyRepaired = 'partially_repaired';
    case Unrepairable = 'unrepairable';
    case ReplacementRequired = 'replacement_required';
}
