<?php

namespace App\Services;

use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Models\Client;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

class DashboardMetricsService
{
    private const TERMINAL_TICKET_STATUSES = [
        TicketStatus::Closed->value,
        TicketStatus::Cancelled->value,
    ];

    public function __construct(private readonly DashboardCache $cache) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $user): array
    {
        if ($user->isClientPortalUser()) {
            return $this->cache->remember($user, 'client', fn (): array => $this->clientDashboard($user));
        }

        if ($user->hasRole('technician') && ! $user->hasAnyRole(['super_admin', 'admin', 'sav_agent'])) {
            return $this->cache->remember($user, 'technician', fn (): array => $this->technicianDashboard($user));
        }

        return $this->cache->remember($user, 'admin', fn (): array => $this->adminDashboard());
    }

    /**
     * @return array<string, mixed>
     */
    private function adminDashboard(): array
    {
        $ticketKpis = $this->adminTicketKpis();

        return [
            'role' => 'admin',
            'generated_at' => now()->toIso8601String(),
            'kpis' => [
                ...$ticketKpis,
                'active_warranties' => Warranty::query()->active()->count(),
                'expired_warranties' => Warranty::query()->expired()->count(),
            ],
            'charts' => [
                'tickets_by_status' => $this->enumDistribution('status', TicketStatus::cases()),
                'tickets_by_priority' => $this->enumDistribution('priority', TicketPriority::cases()),
                'tickets_by_month' => $this->ticketsByMonth(),
                'warranty_claims' => $this->warrantyClaims(),
            ],
            'technicians' => [
                'workload' => $this->technicianWorkload(),
                'performance' => $this->technicianPerformance(),
            ],
            'defective_products' => $this->defectiveProducts(),
        ];
    }

    /**
     * Compute the ticket KPI snapshot in one scan instead of issuing a query
     * per card. DashboardCache keeps this aggregate off the request path for
     * subsequent reads until an observed domain model changes.
     *
     * @return array{open_tickets: int, tickets_created_today: int, tickets_resolved_today: int, urgent_tickets: int, average_resolution_seconds: int|null}
     */
    private function adminTicketKpis(): array
    {
        $dateFunction = DB::connection()->getDriverName() === 'sqlite' ? 'date' : 'DATE';
        $averageSeconds = $this->secondsDifferenceExpression('received_at', 'closed_at');
        $today = today()->toDateString();

        $metrics = Ticket::query()
            ->selectRaw(
                'SUM(CASE WHEN status NOT IN (?, ?) THEN 1 ELSE 0 END) as open_tickets',
                self::TERMINAL_TICKET_STATUSES,
            )
            ->selectRaw(
                "SUM(CASE WHEN {$dateFunction}(created_at) = ? THEN 1 ELSE 0 END) as tickets_created_today",
                [$today],
            )
            ->selectRaw(
                "SUM(CASE WHEN status = ? AND {$dateFunction}(closed_at) = ? THEN 1 ELSE 0 END) as tickets_resolved_today",
                [TicketStatus::Closed->value, $today],
            )
            ->selectRaw(
                'SUM(CASE WHEN priority = ? AND status NOT IN (?, ?) THEN 1 ELSE 0 END) as urgent_tickets',
                [TicketPriority::Urgent->value, ...self::TERMINAL_TICKET_STATUSES],
            )
            ->selectRaw(
                "AVG(CASE WHEN status = ? AND received_at IS NOT NULL AND closed_at IS NOT NULL THEN {$averageSeconds} ELSE NULL END) as average_resolution_seconds",
                [TicketStatus::Closed->value],
            )
            ->first();

        return [
            'open_tickets' => (int) ($metrics?->open_tickets ?? 0),
            'tickets_created_today' => (int) ($metrics?->tickets_created_today ?? 0),
            'tickets_resolved_today' => (int) ($metrics?->tickets_resolved_today ?? 0),
            'urgent_tickets' => (int) ($metrics?->urgent_tickets ?? 0),
            'average_resolution_seconds' => $metrics?->average_resolution_seconds === null
                ? null
                : (int) round((float) $metrics->average_resolution_seconds),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function technicianDashboard(User $user): array
    {
        $technician = Technician::query()->where('user_id', $user->id)->first();

        if ($technician === null) {
            return [
                'role' => 'technician',
                'generated_at' => now()->toIso8601String(),
                'profile_available' => false,
                'kpis' => $this->zeroTechnicianKpis(),
                'charts' => ['assigned_tickets_by_status' => []],
            ];
        }

        $ticketQuery = Ticket::query()->where('assigned_technician_id', $technician->id);
        $overdueAt = now()->subDays(max(1, (int) config('dashboard.overdue_ticket_after_days', 3)));

        return [
            'role' => 'technician',
            'generated_at' => now()->toIso8601String(),
            'profile_available' => true,
            'kpis' => [
                'assigned_tickets' => (clone $ticketQuery)->whereNotIn('status', self::TERMINAL_TICKET_STATUSES)->count(),
                'overdue_tickets' => (clone $ticketQuery)->whereNotIn('status', self::TERMINAL_TICKET_STATUSES)->where('received_at', '<', $overdueAt)->count(),
                'repairs_in_progress' => Repair::query()->where('technician_id', $technician->id)->whereNotNull('started_at')->whereNull('completed_at')->count(),
                'completed_today' => Repair::query()->where('technician_id', $technician->id)->whereDate('completed_at', today())->count(),
                'average_repair_seconds' => $this->averageSeconds(
                    Repair::query()->where('technician_id', $technician->id)->whereNotNull('started_at')->whereNotNull('completed_at'),
                    'started_at',
                    'completed_at',
                ),
            ],
            'charts' => [
                'assigned_tickets_by_status' => $this->enumDistribution(
                    'status',
                    TicketStatus::cases(),
                    fn (Builder $query): Builder => $query->where('assigned_technician_id', $technician->id),
                ),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function clientDashboard(User $user): array
    {
        $client = $user->client;

        if (! $client instanceof Client) {
            return [
                'role' => 'client',
                'generated_at' => now()->toIso8601String(),
                'account_linked' => false,
                'kpis' => $this->zeroClientKpis(),
                'recent_repair_updates' => [],
            ];
        }

        $recentRepairs = Repair::query()
            ->select(['id', 'ticket_id', 'customer_notes', 'result', 'completed_at', 'updated_at'])
            ->whereHas('ticket', fn (Builder $query): Builder => $query->where('client_id', $client->id))
            ->with([
                'ticket:id,uuid,ticket_number,title,status,product_id',
                'ticket.product:id,uuid,name,sku',
            ])
            ->latest('updated_at')
            ->limit(5)
            ->get();

        return [
            'role' => 'client',
            'generated_at' => now()->toIso8601String(),
            'account_linked' => true,
            'kpis' => [
                'my_products' => Warranty::query()->where('customer_id', $client->id)->count(),
                'active_warranties' => Warranty::query()->where('customer_id', $client->id)->active()->count(),
                'active_tickets' => Ticket::query()->where('client_id', $client->id)->whereNotIn('status', self::TERMINAL_TICKET_STATUSES)->count(),
            ],
            'recent_repair_updates' => $recentRepairs->map(fn (Repair $repair): array => [
                'ticket_uuid' => $repair->ticket?->uuid,
                'ticket_number' => $repair->ticket?->ticket_number,
                'ticket_title' => $repair->ticket?->title,
                'ticket_status' => $repair->ticket?->status?->value,
                'product_name' => $repair->ticket?->product?->name,
                'customer_notes' => $repair->customer_notes,
                'result' => $repair->result?->value,
                'completed_at' => $repair->completed_at?->toIso8601String(),
                'updated_at' => $repair->updated_at?->toIso8601String(),
            ])->values()->all(),
        ];
    }

    /**
     * @param  array<int, \BackedEnum>  $cases
     * @param  (Closure(Builder<Ticket>): Builder<Ticket>)|null  $scope
     * @return list<array{key: string, value: int}>
     */
    private function enumDistribution(string $column, array $cases, ?\Closure $scope = null): array
    {
        $query = Ticket::query()
            ->select($column)
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy($column);

        if ($scope !== null) {
            $query = $scope($query);
        }

        $counts = $query->pluck('aggregate', $column)->map(fn (mixed $count): int => (int) $count)->all();

        return array_map(
            fn (\BackedEnum $case): array => ['key' => $case->value, 'value' => $counts[$case->value] ?? 0],
            $cases,
        );
    }

    /**
     * @return list<array{key: string, value: int}>
     */
    private function ticketsByMonth(): array
    {
        $start = CarbonImmutable::now()->startOfMonth()->subMonths(5);
        $driver = DB::connection()->getDriverName();
        $monthExpression = $driver === 'sqlite'
            ? "strftime('%Y-%m', created_at)"
            : "DATE_FORMAT(created_at, '%Y-%m')";

        $counts = Ticket::query()
            ->where('created_at', '>=', $start)
            ->selectRaw("{$monthExpression} as month_key, COUNT(*) as aggregate")
            ->groupBy('month_key')
            ->pluck('aggregate', 'month_key')
            ->map(fn (mixed $count): int => (int) $count)
            ->all();

        return collect(range(0, 5))->map(function (int $offset) use ($start, $counts): array {
            $month = $start->addMonths($offset);
            $key = $month->format('Y-m');

            return ['key' => $key, 'value' => $counts[$key] ?? 0];
        })->all();
    }

    /**
     * @return array{covered: int, out_of_warranty: int}
     */
    private function warrantyClaims(): array
    {
        $counts = Ticket::query()
            ->selectRaw('SUM(CASE WHEN warranty_eligible = 1 THEN 1 ELSE 0 END) as covered')
            ->selectRaw('SUM(CASE WHEN warranty_eligible = 0 THEN 1 ELSE 0 END) as out_of_warranty')
            ->first();

        return [
            'covered' => (int) ($counts?->covered ?? 0),
            'out_of_warranty' => (int) ($counts?->out_of_warranty ?? 0),
        ];
    }

    /**
     * @return list<array{id: int, name: string, employee_code: string, value: int}>
     */
    private function technicianWorkload(): array
    {
        return Technician::query()
            ->join('users', 'users.id', '=', 'technicians.user_id')
            ->leftJoin('tickets', function (JoinClause $join): void {
                $join->on('tickets.assigned_technician_id', '=', 'technicians.id')
                    ->whereNull('tickets.deleted_at')
                    ->whereNotIn('tickets.status', self::TERMINAL_TICKET_STATUSES);
            })
            ->whereNull('technicians.deleted_at')
            ->whereNull('users.deleted_at')
            ->select(['technicians.id', 'technicians.employee_code', 'users.first_name', 'users.last_name'])
            ->selectRaw('COUNT(tickets.id) as aggregate')
            ->groupBy(['technicians.id', 'technicians.employee_code', 'users.first_name', 'users.last_name'])
            ->orderByDesc('aggregate')
            ->orderBy('technicians.id')
            ->limit(10)
            ->get()
            ->map(fn (object $technician): array => [
                'id' => (int) $technician->id,
                'name' => trim("{$technician->first_name} {$technician->last_name}"),
                'employee_code' => $technician->employee_code,
                'value' => (int) $technician->aggregate,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string, employee_code: string, completed_count: int, average_repair_seconds: int|null}>
     */
    private function technicianPerformance(): array
    {
        $seconds = $this->secondsDifferenceExpression('repairs.started_at', 'repairs.completed_at');

        return Technician::query()
            ->join('users', 'users.id', '=', 'technicians.user_id')
            ->leftJoin('repairs', function (JoinClause $join): void {
                $join->on('repairs.technician_id', '=', 'technicians.id')
                    ->whereNotNull('repairs.started_at')
                    ->whereNotNull('repairs.completed_at');
            })
            ->whereNull('technicians.deleted_at')
            ->whereNull('users.deleted_at')
            ->select(['technicians.id', 'technicians.employee_code', 'users.first_name', 'users.last_name'])
            ->selectRaw('COUNT(repairs.id) as completed_count')
            ->selectRaw("AVG({$seconds}) as average_seconds")
            ->groupBy(['technicians.id', 'technicians.employee_code', 'users.first_name', 'users.last_name'])
            ->orderByDesc('completed_count')
            ->orderBy('technicians.id')
            ->limit(10)
            ->get()
            ->map(fn (object $technician): array => [
                'id' => (int) $technician->id,
                'name' => trim("{$technician->first_name} {$technician->last_name}"),
                'employee_code' => $technician->employee_code,
                'completed_count' => (int) $technician->completed_count,
                'average_repair_seconds' => $technician->average_seconds === null ? null : (int) round((float) $technician->average_seconds),
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string, sku: string, value: int}>
     */
    private function defectiveProducts(): array
    {
        return Ticket::query()
            ->join('products', 'products.id', '=', 'tickets.product_id')
            ->select(['products.id', 'products.name', 'products.sku'])
            ->selectRaw('COUNT(tickets.id) as aggregate')
            ->groupBy(['products.id', 'products.name', 'products.sku'])
            ->orderByDesc('aggregate')
            ->orderBy('products.id')
            ->limit(8)
            ->get()
            ->map(fn (object $product): array => [
                'id' => (int) $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'value' => (int) $product->aggregate,
            ])
            ->all();
    }

    /**
     * @param  Builder<Model>  $query
     */
    private function averageSeconds(Builder $query, string $startColumn, string $endColumn): ?int
    {
        $seconds = $this->secondsDifferenceExpression($startColumn, $endColumn);
        $result = $query->selectRaw("AVG({$seconds}) as average_seconds")->value('average_seconds');

        return $result === null ? null : (int) round((float) $result);
    }

    private function secondsDifferenceExpression(string $startColumn, string $endColumn): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "(julianday({$endColumn}) - julianday({$startColumn})) * 86400"
            : "TIMESTAMPDIFF(SECOND, {$startColumn}, {$endColumn})";
    }

    /**
     * @return array{assigned_tickets: int, overdue_tickets: int, repairs_in_progress: int, completed_today: int, average_repair_seconds: null}
     */
    private function zeroTechnicianKpis(): array
    {
        return [
            'assigned_tickets' => 0,
            'overdue_tickets' => 0,
            'repairs_in_progress' => 0,
            'completed_today' => 0,
            'average_repair_seconds' => null,
        ];
    }

    /**
     * @return array{my_products: int, active_warranties: int, active_tickets: int}
     */
    private function zeroClientKpis(): array
    {
        return [
            'my_products' => 0,
            'active_warranties' => 0,
            'active_tickets' => 0,
        ];
    }
}
