<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    /**
     * @return BelongsToMany<Client, $this>
     */
    public function clients(): BelongsToMany
    {
        return $this->belongsToMany(Client::class, 'customer_products', 'product_id', 'customer_id')
            ->withPivot(['id', 'serial_number', 'purchase_date', 'warranty_end'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<Warranty, $this>
     */
    public function warranties(): HasMany
    {
        return $this->hasMany(Warranty::class, 'product_id');
    }
}
