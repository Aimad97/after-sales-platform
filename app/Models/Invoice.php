<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Invoice persistence is introduced by the dedicated invoices module.
 *
 * This lightweight model keeps the Client relationship available without
 * introducing invoice business logic prematurely.
 */
class Invoice extends Model
{
    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
