<?php

namespace App\Models;

use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission as SpatiePermission;

class Permission extends SpatiePermission
{
    protected static function booted(): void
    {
        static::creating(function (self $permission): void {
            if (Schema::hasColumn($permission->getTable(), 'code') && blank($permission->getAttribute('code'))) {
                $permission->setAttribute('code', $permission->getAttribute('name'));
            }
        });
    }
}
