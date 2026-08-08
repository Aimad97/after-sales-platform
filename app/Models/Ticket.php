<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Ticket extends Model
{
    use SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'customer_id');
    }

    /**
     * @return BelongsTo<Warranty, $this>
     */
    public function warranty(): BelongsTo
    {
        return $this->belongsTo(Warranty::class, 'customer_product_id');
    }

    /**
     * @return BelongsTo<TicketStatus, $this>
     */
    public function status(): BelongsTo
    {
        return $this->belongsTo(TicketStatus::class, 'status_id');
    }

    /**
     * @return HasMany<Intervention, $this>
     */
    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class);
    }
}
