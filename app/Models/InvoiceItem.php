<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class InvoiceItem extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'serial_number',
        'quantity',
        'unit_price',
        'warranty_months',
        'warranty_start_date',
        'warranty_end_date',
        'line_subtotal',
        'line_tax',
        'line_total',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'warranty_months' => 'integer',
            'warranty_start_date' => 'date',
            'warranty_end_date' => 'date',
            'line_subtotal' => 'decimal:2',
            'line_tax' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return HasOne<Warranty, $this>
     */
    public function purchasedProduct(): HasOne
    {
        return $this->hasOne(Warranty::class, 'invoice_item_id');
    }

    /**
     * @return HasMany<Warranty, $this>
     */
    public function warranties(): HasMany
    {
        return $this->hasMany(Warranty::class, 'invoice_item_id');
    }
}
