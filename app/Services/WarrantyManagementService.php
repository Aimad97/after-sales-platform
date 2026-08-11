<?php

namespace App\Services;

use App\Enums\WarrantyStatus;
use App\Models\Warranty;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WarrantyManagementService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Warranty>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $this->synchronizeExpiredStatuses();

        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'expires_at';
        $direction = $filters['direction'] ?? 'asc';

        return Warranty::query()
            ->with(['client', 'product', 'invoiceItem.invoice'])
            ->when($search, function (Builder $query, string $term): void {
                $query->where(function (Builder $query) use ($term): void {
                    $query->where('serial_number', 'like', "%{$term}%")
                        ->orWhereHas('client', function (Builder $query) use ($term): void {
                            $query->where('first_name', 'like', "%{$term}%")
                                ->orWhere('last_name', 'like', "%{$term}%")
                                ->orWhere('company_name', 'like', "%{$term}%")
                                ->orWhere('email', 'like', "%{$term}%");
                        })
                        ->orWhereHas('product', function (Builder $query) use ($term): void {
                            $query->where('name', 'like', "%{$term}%")
                                ->orWhere('sku', 'like', "%{$term}%")
                                ->orWhere('model', 'like', "%{$term}%");
                        });
                });
            })
            ->when($filters['client_id'] ?? null, fn (Builder $query, int $clientId) => $query->where('customer_id', $clientId))
            ->when($filters['product_id'] ?? null, fn (Builder $query, int $productId) => $query->where('product_id', $productId))
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $this->applyStatusFilter($query, WarrantyStatus::from($status)))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    public function findBySerial(string $serialNumber): ?Warranty
    {
        $this->synchronizeExpiredStatuses();

        return Warranty::query()
            ->with(['client', 'product', 'invoiceItem.invoice'])
            ->where('serial_number', Str::upper(trim($serialNumber)))
            ->first();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Warranty $warranty, array $data): Warranty
    {
        return DB::transaction(function () use ($warranty, $data): Warranty {
            $warranty = Warranty::query()->lockForUpdate()->findOrFail($warranty->id);
            $currentStatus = $warranty->effectiveStatus();

            if ($currentStatus === WarrantyStatus::Expired && $warranty->status !== WarrantyStatus::Expired) {
                $warranty->status = WarrantyStatus::Expired;
            }

            if (array_key_exists('status', $data)) {
                $requestedStatus = WarrantyStatus::from($data['status']);

                if ($requestedStatus === WarrantyStatus::Active || $requestedStatus === WarrantyStatus::Expired) {
                    throw ValidationException::withMessages([
                        'status' => 'Active and expired statuses are determined by warranty dates on the server.',
                    ]);
                }

                if ($currentStatus->isTerminal() && $requestedStatus !== $currentStatus) {
                    throw ValidationException::withMessages([
                        'status' => 'A void or replaced warranty cannot be transitioned to another status.',
                    ]);
                }

                $warranty->status = $requestedStatus;
            }

            if ($warranty->status === WarrantyStatus::Void) {
                $voidReason = array_key_exists('void_reason', $data)
                    ? $this->nullableText($data['void_reason'])
                    : $warranty->void_reason;

                if ($voidReason === null) {
                    throw ValidationException::withMessages([
                        'void_reason' => 'A reason is required when voiding a warranty.',
                    ]);
                }

                $warranty->void_reason = $voidReason;
            } elseif (array_key_exists('void_reason', $data)) {
                throw ValidationException::withMessages([
                    'void_reason' => 'A void reason can only be recorded for a void warranty.',
                ]);
            }

            if (array_key_exists('notes', $data)) {
                $warranty->notes = $this->nullableText($data['notes']);
            }

            $warranty->save();

            return $warranty->refresh()->load(['client', 'product', 'invoiceItem.invoice']);
        });
    }

    private function synchronizeExpiredStatuses(): void
    {
        Warranty::query()
            ->where('status', WarrantyStatus::Active->value)
            ->whereDate('expires_at', '<', today())
            ->update(['status' => WarrantyStatus::Expired->value]);
    }

    /**
     * @param  Builder<Warranty>  $query
     * @return Builder<Warranty>
     */
    private function applyStatusFilter(Builder $query, WarrantyStatus $status): Builder
    {
        return match ($status) {
            WarrantyStatus::Active => $query->active(),
            WarrantyStatus::Expired => $query->expired(),
            WarrantyStatus::Void, WarrantyStatus::Replaced => $query->where('status', $status->value),
        };
    }

    private function nullableText(mixed $value): ?string
    {
        return filled($value) ? trim((string) $value) : null;
    }
}
