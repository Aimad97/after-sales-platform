<?php

namespace App\Services;

use App\Enums\ReportType;
use App\Enums\WarrantyStatus;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, array<string, mixed>>
     */
    public function paginate(ReportType|string $type, array $filters): LengthAwarePaginator
    {
        $type = $this->type($type);
        $paginator = $this->query($type, $filters)
            ->orderBy($this->orderColumn($type), 'desc')
            ->paginate((int) ($filters['per_page'] ?? 25))
            ->withQueryString();

        return $paginator->through(fn (object $row): array => $this->row($type, $row));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return iterable<array<string, mixed>>
     */
    public function exportRows(ReportType|string $type, array $filters): iterable
    {
        $type = $this->type($type);

        foreach ($this->query($type, $filters)->orderBy($this->orderColumn($type), 'desc')->cursor() as $row) {
            yield $this->row($type, $row);
        }
    }

    /**
     * @return array<string, string>
     */
    public function exportColumns(ReportType|string $type): array
    {
        return match ($this->type($type)) {
            ReportType::Tickets => [
                'ticket_number' => 'Ticket number', 'client' => 'Client', 'product' => 'Product', 'brand' => 'Brand',
                'category' => 'Category', 'status' => 'Status', 'priority' => 'Priority', 'source' => 'Source',
                'warranty_eligible' => 'Under warranty', 'technician' => 'Technician', 'received_at' => 'Received at', 'closed_at' => 'Closed at',
            ],
            ReportType::Repairs => [
                'ticket_number' => 'Ticket number', 'client' => 'Client', 'product' => 'Product', 'brand' => 'Brand',
                'technician' => 'Technician', 'ticket_status' => 'Ticket status', 'result' => 'Result', 'labor_cost' => 'Labor cost',
                'parts_cost' => 'Parts cost', 'total_cost' => 'Total cost', 'started_at' => 'Started at', 'completed_at' => 'Completed at',
            ],
            ReportType::Warranties => [
                'serial_number' => 'Serial number', 'client' => 'Client', 'product' => 'Product', 'brand' => 'Brand',
                'category' => 'Category', 'status' => 'Warranty state', 'starts_at' => 'Starts at', 'expires_at' => 'Expires at',
            ],
            ReportType::TechnicianPerformance => [
                'technician' => 'Technician', 'employee_code' => 'Employee code', 'availability_status' => 'Availability',
                'assigned_tickets' => 'Assigned tickets', 'completed_repairs' => 'Completed repairs', 'average_repair_hours' => 'Average repair hours',
            ],
            ReportType::DefectiveProducts => [
                'product' => 'Product', 'sku' => 'SKU', 'brand' => 'Brand', 'category' => 'Category',
                'ticket_count' => 'Ticket count', 'warranty_claims' => 'Warranty claims', 'out_of_warranty_claims' => 'Out-of-warranty claims',
            ],
            ReportType::ClientHistory => [
                'client' => 'Client', 'ticket_number' => 'Ticket number', 'product' => 'Product', 'status' => 'Ticket status',
                'priority' => 'Priority', 'technician' => 'Technician', 'repair_result' => 'Repair result',
                'received_at' => 'Received at', 'completed_at' => 'Repair completed at',
            ],
        };
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function query(ReportType $type, array $filters): Builder
    {
        return match ($type) {
            ReportType::Tickets => $this->ticketsQuery($filters),
            ReportType::Repairs => $this->repairsQuery($filters),
            ReportType::Warranties => $this->warrantiesQuery($filters),
            ReportType::TechnicianPerformance => $this->technicianPerformanceQuery($filters),
            ReportType::DefectiveProducts => $this->defectiveProductsQuery($filters),
            ReportType::ClientHistory => $this->clientHistoryQuery($filters),
        };
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function ticketsQuery(array $filters): Builder
    {
        $query = $this->ticketContextQuery()
            ->select([
                't.ticket_number', 't.status', 't.priority', 't.source', 't.warranty_eligible', 't.received_at', 't.closed_at',
                'client.company_name as client_company_name', 'client.first_name as client_first_name', 'client.last_name as client_last_name',
                'p.name as product_name', 'b.name as brand_name', 'ca.name as category_name',
                'technician_user.first_name as technician_first_name', 'technician_user.last_name as technician_last_name',
            ]);

        return $this->applyTicketFilters($query, $filters, 't.received_at');
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function repairsQuery(array $filters): Builder
    {
        $query = DB::table('repairs as r')
            ->join('tickets as t', 't.id', '=', 'r.ticket_id')
            ->leftJoin('customers as client', 'client.id', '=', 't.client_id')
            ->leftJoin('products as p', 'p.id', '=', 't.product_id')
            ->leftJoin('brands as b', 'b.id', '=', 'p.brand_id')
            ->leftJoin('categories as ca', 'ca.id', '=', 'p.category_id')
            ->leftJoin('customer_products as w', 'w.id', '=', 't.warranty_id')
            ->leftJoin('technicians as technician', 'technician.id', '=', 'r.technician_id')
            ->leftJoin('users as technician_user', 'technician_user.id', '=', 'technician.user_id')
            ->whereNull('t.deleted_at')
            ->select([
                't.ticket_number', 't.status as ticket_status', 'r.result', 'r.labor_cost', 'r.parts_cost', 'r.total_cost', 'r.started_at', 'r.completed_at',
                'client.company_name as client_company_name', 'client.first_name as client_first_name', 'client.last_name as client_last_name',
                'p.name as product_name', 'b.name as brand_name',
                'technician_user.first_name as technician_first_name', 'technician_user.last_name as technician_last_name',
            ]);

        return $this->applyTicketFilters($query, $filters, 'r.created_at', 'r.technician_id', 'r.result');
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function warrantiesQuery(array $filters): Builder
    {
        $query = DB::table('customer_products as w')
            ->join('customers as client', 'client.id', '=', 'w.customer_id')
            ->join('products as p', 'p.id', '=', 'w.product_id')
            ->leftJoin('brands as b', 'b.id', '=', 'p.brand_id')
            ->leftJoin('categories as ca', 'ca.id', '=', 'p.category_id')
            ->select([
                'w.serial_number', 'w.status as warranty_status', 'w.starts_at', 'w.expires_at',
                'client.company_name as client_company_name', 'client.first_name as client_first_name', 'client.last_name as client_last_name',
                'p.name as product_name', 'b.name as brand_name', 'ca.name as category_name',
            ]);

        $query
            ->when($filters['date_from'] ?? null, fn (Builder $builder, string $date): Builder => $builder->whereDate('w.starts_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn (Builder $builder, string $date): Builder => $builder->whereDate('w.starts_at', '<=', $date))
            ->when($filters['brand_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where('p.brand_id', $id))
            ->when($filters['category_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where('p.category_id', $id))
            ->when($filters['product_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where('w.product_id', $id))
            ->when($filters['client_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where('w.customer_id', $id));

        if (filled($filters['warranty_state'] ?? null)) {
            $this->applyWarrantyState($query, (string) $filters['warranty_state']);
        }

        if (filled($filters['technician_id'] ?? null)) {
            $query->whereExists(function (Builder $subquery) use ($filters): void {
                $subquery->selectRaw('1')
                    ->from('tickets as ticket_filter')
                    ->whereColumn('ticket_filter.warranty_id', 'w.id')
                    ->where('ticket_filter.assigned_technician_id', $filters['technician_id'])
                    ->whereNull('ticket_filter.deleted_at');
            });
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function technicianPerformanceQuery(array $filters): Builder
    {
        $seconds = $this->secondsDifferenceExpression('r.started_at', 'r.completed_at');
        $query = DB::table('technicians as technician')
            ->join('users as technician_user', 'technician_user.id', '=', 'technician.user_id')
            ->leftJoin('tickets as t', function (JoinClause $join): void {
                $join->on('t.assigned_technician_id', '=', 'technician.id')->whereNull('t.deleted_at');
            })
            ->leftJoin('repairs as r', 'r.ticket_id', '=', 't.id')
            ->leftJoin('products as p', 'p.id', '=', 't.product_id')
            ->leftJoin('brands as b', 'b.id', '=', 'p.brand_id')
            ->leftJoin('categories as ca', 'ca.id', '=', 'p.category_id')
            ->leftJoin('customer_products as w', 'w.id', '=', 't.warranty_id')
            ->whereNull('technician.deleted_at')
            ->whereNull('technician_user.deleted_at')
            ->select([
                'technician.id as technician_id', 'technician.employee_code', 'technician.availability_status',
                'technician_user.first_name as technician_first_name', 'technician_user.last_name as technician_last_name',
            ])
            ->selectRaw('COUNT(DISTINCT t.id) as assigned_tickets')
            ->selectRaw('COUNT(DISTINCT CASE WHEN r.completed_at IS NOT NULL THEN r.id END) as completed_repairs')
            ->selectRaw("AVG(CASE WHEN r.started_at IS NOT NULL AND r.completed_at IS NOT NULL THEN {$seconds} END) as average_repair_seconds")
            ->groupBy(['technician.id', 'technician.employee_code', 'technician.availability_status', 'technician_user.first_name', 'technician_user.last_name']);

        return $this->applyTicketFilters($query, $filters, 't.received_at', 'technician.id');
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function defectiveProductsQuery(array $filters): Builder
    {
        $query = DB::table('tickets as t')
            ->join('products as p', 'p.id', '=', 't.product_id')
            ->leftJoin('brands as b', 'b.id', '=', 'p.brand_id')
            ->leftJoin('categories as ca', 'ca.id', '=', 'p.category_id')
            ->leftJoin('customer_products as w', 'w.id', '=', 't.warranty_id')
            ->whereNull('t.deleted_at')
            ->select(['p.id as product_id', 'p.name as product_name', 'p.sku', 'b.name as brand_name', 'ca.name as category_name'])
            ->selectRaw('COUNT(t.id) as ticket_count')
            ->selectRaw('SUM(CASE WHEN t.warranty_eligible = 1 THEN 1 ELSE 0 END) as warranty_claims')
            ->selectRaw('SUM(CASE WHEN t.warranty_eligible = 0 THEN 1 ELSE 0 END) as out_of_warranty_claims')
            ->groupBy(['p.id', 'p.name', 'p.sku', 'b.name', 'ca.name']);

        return $this->applyTicketFilters($query, $filters, 't.received_at');
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function clientHistoryQuery(array $filters): Builder
    {
        $query = $this->ticketContextQuery()
            ->leftJoin('repairs as r', 'r.ticket_id', '=', 't.id')
            ->select([
                't.ticket_number', 't.status', 't.priority', 't.received_at', 'r.result as repair_result', 'r.completed_at',
                'client.company_name as client_company_name', 'client.first_name as client_first_name', 'client.last_name as client_last_name',
                'p.name as product_name',
                'technician_user.first_name as technician_first_name', 'technician_user.last_name as technician_last_name',
            ]);

        return $this->applyTicketFilters($query, $filters, 't.received_at');
    }

    private function ticketContextQuery(): Builder
    {
        return DB::table('tickets as t')
            ->leftJoin('customers as client', 'client.id', '=', 't.client_id')
            ->leftJoin('products as p', 'p.id', '=', 't.product_id')
            ->leftJoin('brands as b', 'b.id', '=', 'p.brand_id')
            ->leftJoin('categories as ca', 'ca.id', '=', 'p.category_id')
            ->leftJoin('customer_products as w', 'w.id', '=', 't.warranty_id')
            ->leftJoin('technicians as technician', 'technician.id', '=', 't.assigned_technician_id')
            ->leftJoin('users as technician_user', 'technician_user.id', '=', 'technician.user_id')
            ->whereNull('t.deleted_at');
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function applyTicketFilters(
        Builder $query,
        array $filters,
        string $dateColumn,
        string $technicianColumn = 't.assigned_technician_id',
        string $statusColumn = 't.status',
    ): Builder {
        $query
            ->when($filters['date_from'] ?? null, fn (Builder $builder, string $date): Builder => $builder->whereDate($dateColumn, '>=', $date))
            ->when($filters['date_to'] ?? null, fn (Builder $builder, string $date): Builder => $builder->whereDate($dateColumn, '<=', $date))
            ->when($filters['technician_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where($technicianColumn, $id))
            ->when($filters['status'] ?? null, fn (Builder $builder, string $status): Builder => $builder->where($statusColumn, $status))
            ->when($filters['priority'] ?? null, fn (Builder $builder, string $priority): Builder => $builder->where('t.priority', $priority))
            ->when($filters['brand_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where('p.brand_id', $id))
            ->when($filters['category_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where('p.category_id', $id))
            ->when($filters['product_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where('t.product_id', $id))
            ->when($filters['client_id'] ?? null, fn (Builder $builder, int $id): Builder => $builder->where('t.client_id', $id));

        if (filled($filters['warranty_state'] ?? null)) {
            $this->applyWarrantyState($query, (string) $filters['warranty_state']);
        }

        return $query;
    }

    private function applyWarrantyState(Builder $query, string $state): void
    {
        $today = today()->toDateString();

        match (WarrantyStatus::from($state)) {
            WarrantyStatus::Active => $query->where('w.status', WarrantyStatus::Active->value)
                ->whereDate('w.starts_at', '<=', $today)
                ->whereDate('w.expires_at', '>=', $today),
            WarrantyStatus::Expired => $query->where(function (Builder $builder) use ($today): void {
                $builder->where('w.status', WarrantyStatus::Expired->value)
                    ->orWhere(function (Builder $expired) use ($today): void {
                        $expired->where('w.status', WarrantyStatus::Active->value)->whereDate('w.expires_at', '<', $today);
                    });
            }),
            WarrantyStatus::Void, WarrantyStatus::Replaced => $query->where('w.status', $state),
        };
    }

    private function orderColumn(ReportType $type): string
    {
        return match ($type) {
            ReportType::Tickets => 't.received_at',
            ReportType::Repairs => 'r.created_at',
            ReportType::Warranties => 'w.starts_at',
            ReportType::TechnicianPerformance => 'completed_repairs',
            ReportType::DefectiveProducts => 'ticket_count',
            ReportType::ClientHistory => 't.received_at',
        };
    }

    private function secondsDifferenceExpression(string $start, string $end): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "(julianday({$end}) - julianday({$start})) * 86400"
            : "TIMESTAMPDIFF(SECOND, {$start}, {$end})";
    }

    private function type(ReportType|string $type): ReportType
    {
        if ($type instanceof ReportType) {
            return $type;
        }

        return ReportType::from($type);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(ReportType $type, object $row): array
    {
        return match ($type) {
            ReportType::Tickets => [
                'ticket_number' => $row->ticket_number,
                'client' => $this->clientName($row),
                'product' => $row->product_name,
                'brand' => $row->brand_name,
                'category' => $row->category_name,
                'status' => $row->status,
                'priority' => $row->priority,
                'source' => $row->source,
                'warranty_eligible' => (bool) $row->warranty_eligible,
                'technician' => $this->technicianName($row),
                'received_at' => $row->received_at,
                'closed_at' => $row->closed_at,
            ],
            ReportType::Repairs => [
                'ticket_number' => $row->ticket_number,
                'client' => $this->clientName($row),
                'product' => $row->product_name,
                'brand' => $row->brand_name,
                'technician' => $this->technicianName($row),
                'ticket_status' => $row->ticket_status,
                'result' => $row->result,
                'labor_cost' => $row->labor_cost,
                'parts_cost' => $row->parts_cost,
                'total_cost' => $row->total_cost,
                'started_at' => $row->started_at,
                'completed_at' => $row->completed_at,
            ],
            ReportType::Warranties => [
                'serial_number' => $row->serial_number,
                'client' => $this->clientName($row),
                'product' => $row->product_name,
                'brand' => $row->brand_name,
                'category' => $row->category_name,
                'status' => $this->effectiveWarrantyState($row),
                'starts_at' => $row->starts_at,
                'expires_at' => $row->expires_at,
            ],
            ReportType::TechnicianPerformance => [
                'technician' => $this->technicianName($row),
                'employee_code' => $row->employee_code,
                'availability_status' => $row->availability_status,
                'assigned_tickets' => (int) $row->assigned_tickets,
                'completed_repairs' => (int) $row->completed_repairs,
                'average_repair_hours' => $row->average_repair_seconds === null ? null : round(((float) $row->average_repair_seconds) / 3600, 2),
            ],
            ReportType::DefectiveProducts => [
                'product' => $row->product_name,
                'sku' => $row->sku,
                'brand' => $row->brand_name,
                'category' => $row->category_name,
                'ticket_count' => (int) $row->ticket_count,
                'warranty_claims' => (int) $row->warranty_claims,
                'out_of_warranty_claims' => (int) $row->out_of_warranty_claims,
            ],
            ReportType::ClientHistory => [
                'client' => $this->clientName($row),
                'ticket_number' => $row->ticket_number,
                'product' => $row->product_name,
                'status' => $row->status,
                'priority' => $row->priority,
                'technician' => $this->technicianName($row),
                'repair_result' => $row->repair_result,
                'received_at' => $row->received_at,
                'completed_at' => $row->completed_at,
            ],
        };
    }

    private function clientName(object $row): ?string
    {
        return filled($row->client_company_name ?? null)
            ? $row->client_company_name
            : (filled(trim("{$row->client_first_name} {$row->client_last_name}")) ? trim("{$row->client_first_name} {$row->client_last_name}") : null);
    }

    private function technicianName(object $row): ?string
    {
        $name = trim("{$row->technician_first_name} {$row->technician_last_name}");

        return $name === '' ? null : $name;
    }

    private function effectiveWarrantyState(object $row): string
    {
        if (in_array($row->warranty_status, [WarrantyStatus::Void->value, WarrantyStatus::Replaced->value], true)) {
            return $row->warranty_status;
        }

        return CarbonImmutable::parse($row->expires_at)->isBefore(today())
            ? WarrantyStatus::Expired->value
            : WarrantyStatus::Active->value;
    }
}
