<?php

namespace App\Models;

use App\Enums\TicketPriority;
use App\Enums\TicketSource;
use App\Enums\TicketStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Ticket extends Model
{
    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'ticket_number',
        'client_id',
        'product_id',
        'warranty_id',
        'invoice_item_id',
        'title',
        'problem_description',
        'priority',
        'status',
        'source',
        'warranty_eligible',
        'created_by',
        'assigned_technician_id',
        'received_at',
        'closed_at',
        'customer_id',
        'customer_product_id',
        'status_id',
        'priority_id',
        'subject',
        'description',
        'opened_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'priority' => TicketPriority::class,
            'status' => TicketStatus::class,
            'source' => TicketSource::class,
            'warranty_eligible' => 'boolean',
            'received_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /** @return BelongsTo<Client, $this> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<Warranty, $this> */
    public function warranty(): BelongsTo
    {
        return $this->belongsTo(Warranty::class);
    }

    /** @return BelongsTo<InvoiceItem, $this> */
    public function invoiceItem(): BelongsTo
    {
        return $this->belongsTo(InvoiceItem::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<Technician, $this> */
    public function assignedTechnician(): BelongsTo
    {
        return $this->belongsTo(Technician::class, 'assigned_technician_id');
    }

    /** @return HasMany<TicketStatusHistory, $this> */
    public function statusHistory(): HasMany
    {
        return $this->hasMany(TicketStatusHistory::class)->orderBy('transitioned_at')->orderBy('id');
    }

    /** @return HasMany<Intervention, $this> */
    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class);
    }
}
