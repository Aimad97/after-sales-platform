<?php

namespace App\Models;

use App\Enums\ClientType;
use Database\Factories\ClientFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    /** @use HasFactory<ClientFactory> */
    use HasFactory, SoftDeletes;

    protected $table = 'customers';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'type',
        'company_name',
        'first_name',
        'last_name',
        'email',
        'phone',
        'address',
        'city',
        'tax_identifier',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => ClientType::class,
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /**
     * @return BelongsToMany<Product, $this>
     */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'customer_products', 'customer_id', 'product_id')
            ->withPivot(['id', 'invoice_item_id', 'serial_number', 'quantity', 'purchase_date', 'warranty_end'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<Warranty, $this>
     */
    public function purchasedProducts(): HasMany
    {
        return $this->hasMany(Warranty::class, 'customer_id');
    }

    /**
     * @return HasMany<Warranty, $this>
     */
    public function warranties(): HasMany
    {
        return $this->hasMany(Warranty::class, 'customer_id');
    }

    /**
     * @return HasMany<Warranty, $this>
     */
    public function activeWarranties(): HasMany
    {
        return $this->warranties()->active();
    }

    /**
     * @return HasMany<Warranty, $this>
     */
    public function expiredWarranties(): HasMany
    {
        return $this->warranties()->expired();
    }

    /**
     * @return HasMany<Ticket, $this>
     */
    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    /**
     * @return HasManyThrough<Intervention, Ticket, $this>
     */
    public function repairHistory(): HasManyThrough
    {
        return $this->hasManyThrough(Intervention::class, Ticket::class, 'client_id', 'ticket_id');
    }

    /** @return HasMany<Invoice, $this> */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'client_id');
    }

    /** @return HasMany<User, $this> */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'client_id');
    }
}
