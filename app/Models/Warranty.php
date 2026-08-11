<?php

namespace App\Models;

use App\Enums\WarrantyStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Warranty extends Model
{
    protected $table = 'customer_products';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'customer_id',
        'product_id',
        'invoice_item_id',
        'serial_number',
        'quantity',
        'purchase_date',
        'warranty_end',
        'starts_at',
        'expires_at',
        'status',
        'void_reason',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'purchase_date' => 'date',
            'warranty_end' => 'date',
            'starts_at' => 'date',
            'expires_at' => 'date',
            'status' => WarrantyStatus::class,
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function effectiveStatus(): WarrantyStatus
    {
        if ($this->status->isTerminal()) {
            return $this->status;
        }

        return $this->expires_at->isBefore(today())
            ? WarrantyStatus::Expired
            : WarrantyStatus::Active;
    }

    public function isUnderWarranty(): bool
    {
        return $this->effectiveStatus() === WarrantyStatus::Active
            && ! $this->starts_at->isAfter(today())
            && ! $this->expires_at->isBefore(today());
    }

    /**
     * @param  Builder<Warranty>  $query
     * @return Builder<Warranty>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->where('status', WarrantyStatus::Active->value)
            ->whereDate('starts_at', '<=', today())
            ->whereDate('expires_at', '>=', today());
    }

    /**
     * @param  Builder<Warranty>  $query
     * @return Builder<Warranty>
     */
    public function scopeExpired(Builder $query): Builder
    {
        return $query->where(function (Builder $query): void {
            $query->where('status', WarrantyStatus::Expired->value)
                ->orWhere(function (Builder $query): void {
                    $query->where('status', WarrantyStatus::Active->value)
                        ->whereDate('expires_at', '<', today());
                });
        });
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'customer_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<InvoiceItem, $this>
     */
    public function invoiceItem(): BelongsTo
    {
        return $this->belongsTo(InvoiceItem::class);
    }

    /**
     * @return HasMany<Ticket, $this>
     */
    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'customer_product_id');
    }
}
