<?php

namespace App\Models;

use App\Enums\TicketStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketStatusHistory extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'ticket_id',
        'from_status',
        'to_status',
        'transitioned_by',
        'notes',
        'transitioned_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'from_status' => TicketStatus::class,
            'to_status' => TicketStatus::class,
            'transitioned_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Ticket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    /** @return BelongsTo<User, $this> */
    public function transitionedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'transitioned_by');
    }
}
