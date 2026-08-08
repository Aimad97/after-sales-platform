<?php

namespace App\Services;

use App\Enums\ClientType;
use App\Models\Client;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ClientManagementService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Client>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $sort = $filters['sort'] ?? 'created_at';
        $direction = $filters['direction'] ?? 'desc';

        return Client::query()
            ->when($search, function ($query, string $term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('first_name', 'like', "%{$term}%")
                        ->orWhere('last_name', 'like', "%{$term}%")
                        ->orWhere('company_name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%")
                        ->orWhere('phone', 'like', "%{$term}%");
                });
            })
            ->when($filters['type'] ?? null, fn ($query, string $type) => $query->where('type', $type))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Client
    {
        return DB::transaction(function () use ($data): Client {
            $data['uuid'] = (string) Str::uuid();
            $data = $this->normalize($data);

            return Client::query()->create($data);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Client $client, array $data): Client
    {
        return DB::transaction(function () use ($client, $data): Client {
            $client->fill($this->normalize($data, $client))->save();

            return $client->refresh();
        });
    }

    public function archive(Client $client): void
    {
        DB::transaction(fn (): bool => $client->delete());
    }

    public function profile(Client $client): Client
    {
        return $client->load([
            'purchasedProducts.product',
            'activeWarranties.product',
            'expiredWarranties.product',
            'tickets' => fn ($query) => $query->with('status')->latest('opened_at')->latest('id'),
            'repairHistory' => fn ($query) => $query->with('ticket.status')->latest('id'),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(array $data, ?Client $client = null): array
    {
        if (array_key_exists('email', $data)) {
            $data['email'] = filled($data['email']) ? Str::lower(trim((string) $data['email'])) : null;
        }

        $type = $data['type'] ?? $client?->type;
        $type = $type instanceof ClientType ? $type->value : $type;

        if ($type === ClientType::Individual->value) {
            $data['company_name'] = null;
            $data['tax_identifier'] = null;
        }

        return $data;
    }
}
