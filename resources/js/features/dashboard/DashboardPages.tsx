import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DashboardChart } from '@/components/DashboardChart';
import { KpiCard } from '@/components/KpiCard';
import { getDashboard } from '@/features/dashboard/api';
import type { AdminDashboard, ClientDashboard, MetricPoint, TechnicianDashboard } from '@/features/dashboard/types';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, humanize } from '@/utils/format';

function durationLabel(seconds: number | null): string {
    if (seconds === null) return '—';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function isEmpty(points: MetricPoint[]): boolean {
    return points.every((point) => point.value === 0);
}

function DashboardLoading() {
    return (
        <section className="space-y-6" aria-busy="true">
            <div className="h-20 animate-pulse rounded-xl bg-slate-200" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="h-32 animate-pulse rounded-xl bg-slate-200" />
                ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
                <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
                <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
            </div>
        </section>
    );
}

function DashboardError({ error }: { error: unknown }) {
    const message = error instanceof Error ? error.message : 'The dashboard could not be loaded.';

    return (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
            <h2 className="text-xl font-bold">Dashboard unavailable</h2>
            <p className="mt-2 text-sm">{message}</p>
        </section>
    );
}

function AdminDashboardPage({ dashboard }: { dashboard: AdminDashboard }) {
    const { kpis, charts } = dashboard;
    const claimValues = [charts.warranty_claims.covered, charts.warranty_claims.out_of_warranty];

    return (
        <section className="space-y-6">
            <header>
                <p className="text-sm font-semibold text-blue-600">Operations overview</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">Admin dashboard</h2>
                <p className="mt-1 text-sm text-slate-600">
                    Live operational metrics across tickets, repairs, warranties, and technicians.
                </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Open tickets" value={kpis.open_tickets} />
                <KpiCard label="Created today" value={kpis.tickets_created_today} />
                <KpiCard label="Resolved today" value={kpis.tickets_resolved_today} />
                <KpiCard label="Urgent tickets" value={kpis.urgent_tickets} />
                <KpiCard label="Average resolution" value={durationLabel(kpis.average_resolution_seconds)} />
                <KpiCard label="Active warranties" value={kpis.active_warranties} />
                <KpiCard label="Expired warranties" value={kpis.expired_warranties} />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
                <DashboardChart
                    title="Tickets by status"
                    type="bar"
                    categories={charts.tickets_by_status.map((point) => humanize(point.key))}
                    series={[{ name: 'Tickets', data: charts.tickets_by_status.map((point) => point.value) }]}
                    empty={isEmpty(charts.tickets_by_status)}
                />
                <DashboardChart
                    title="Tickets by priority"
                    type="donut"
                    categories={charts.tickets_by_priority.map((point) => humanize(point.key))}
                    series={charts.tickets_by_priority.map((point) => point.value)}
                    empty={isEmpty(charts.tickets_by_priority)}
                />
                <DashboardChart
                    title="Ticket intake trend"
                    description="New tickets over the last six months"
                    type="line"
                    categories={charts.tickets_by_month.map((point) =>
                        new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(
                            new Date(`${point.key}-01T00:00:00`),
                        ),
                    )}
                    series={[{ name: 'Tickets', data: charts.tickets_by_month.map((point) => point.value) }]}
                    empty={isEmpty(charts.tickets_by_month)}
                />
                <DashboardChart
                    title="Warranty coverage"
                    type="donut"
                    categories={['Under warranty', 'Out of warranty']}
                    series={claimValues}
                    empty={claimValues.every((value) => value === 0)}
                />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
                <DashboardChart
                    title="Technician workload"
                    description="Open tickets assigned to each technician"
                    type="bar"
                    categories={dashboard.technicians.workload.map((technician) => technician.name)}
                    series={[{ name: 'Open tickets', data: dashboard.technicians.workload.map((technician) => technician.value) }]}
                    empty={dashboard.technicians.workload.length === 0}
                />
                <DashboardChart
                    title="Technician performance"
                    description="Completed repairs"
                    type="bar"
                    categories={dashboard.technicians.performance.map((technician) => technician.name)}
                    series={[
                        {
                            name: 'Completed repairs',
                            data: dashboard.technicians.performance.map((technician) => technician.completed_count),
                        },
                    ]}
                    empty={dashboard.technicians.performance.length === 0}
                />
            </div>
            <DashboardChart
                title="Most common defective products"
                description="Products with the most SAV tickets"
                type="bar"
                categories={dashboard.defective_products.map((product) => product.name)}
                series={[{ name: 'Tickets', data: dashboard.defective_products.map((product) => product.value) }]}
                empty={dashboard.defective_products.length === 0}
            />
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Technician performance detail</h3>
                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-slate-200 text-slate-500">
                            <tr>
                                <th className="pb-3 font-semibold">Technician</th>
                                <th className="pb-3 font-semibold">Employee code</th>
                                <th className="pb-3 font-semibold">Completed repairs</th>
                                <th className="pb-3 font-semibold">Average repair time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.technicians.performance.map((technician) => (
                                <tr key={technician.id} className="border-b border-slate-100">
                                    <td className="py-3 font-medium text-slate-900">{technician.name}</td>
                                    <td className="py-3 text-slate-600">{technician.employee_code}</td>
                                    <td className="py-3 text-slate-700">{technician.completed_count}</td>
                                    <td className="py-3 text-slate-700">{durationLabel(technician.average_repair_seconds)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {dashboard.technicians.performance.length === 0 && (
                        <p className="py-5 text-sm text-slate-500">No technician performance records yet.</p>
                    )}
                </div>
            </section>
        </section>
    );
}

function TechnicianDashboardPage({ dashboard }: { dashboard: TechnicianDashboard }) {
    if (!dashboard.profile_available)
        return (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                <h2 className="text-xl font-bold">Technician profile required</h2>
                <p className="mt-2 text-sm">Your account needs a technician profile before workload metrics can be shown.</p>
            </section>
        );

    const { kpis, charts } = dashboard;
    return (
        <section className="space-y-6">
            <header>
                <p className="text-sm font-semibold text-blue-600">My workspace</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">Technician dashboard</h2>
                <p className="mt-1 text-sm text-slate-600">Your current queue and repair performance.</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <KpiCard label="Assigned tickets" value={kpis.assigned_tickets} />
                <KpiCard label="Overdue tickets" value={kpis.overdue_tickets} hint="Based on the configured intake threshold" />
                <KpiCard label="Repairs in progress" value={kpis.repairs_in_progress} />
                <KpiCard label="Completed today" value={kpis.completed_today} />
                <KpiCard label="Average repair time" value={durationLabel(kpis.average_repair_seconds)} />
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <DashboardChart
                    title="Assigned tickets by status"
                    type="donut"
                    categories={charts.assigned_tickets_by_status.map((point) => humanize(point.key))}
                    series={charts.assigned_tickets_by_status.map((point) => point.value)}
                    empty={isEmpty(charts.assigned_tickets_by_status)}
                />
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-900">Quick actions</h3>
                    <p className="mt-1 text-sm text-slate-600">Work from your assigned ticket and repair queues.</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                        <Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to="/admin/repairs">
                            Current repairs
                        </Link>
                        <Link
                            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                            to="/admin/tickets"
                        >
                            Assigned tickets
                        </Link>
                    </div>
                </article>
            </div>
        </section>
    );
}

function ClientDashboardPage({ dashboard }: { dashboard: ClientDashboard }) {
    if (!dashboard.account_linked)
        return (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                <h2 className="text-xl font-bold">Account setup required</h2>
                <p className="mt-2 text-sm">
                    Your portal account is not yet linked to a client profile. Contact the service team to complete the link.
                </p>
            </section>
        );

    return (
        <section className="space-y-6">
            <header>
                <p className="text-sm font-semibold text-blue-600">My service desk</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">Client dashboard</h2>
                <p className="mt-1 text-sm text-slate-600">Your products, warranty coverage, and latest repair updates.</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard label="My products" value={dashboard.kpis.my_products} />
                <KpiCard label="Active warranties" value={dashboard.kpis.active_warranties} />
                <KpiCard label="Active tickets" value={dashboard.kpis.active_tickets} />
            </div>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Recent repair updates</h3>
                <div className="mt-4 space-y-3">
                    {dashboard.recent_repair_updates.map((update) => (
                        <article
                            key={update.ticket_uuid ?? `${update.ticket_number ?? 'repair'}-${update.updated_at}`}
                            className="rounded-lg border border-slate-200 p-4"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        {update.ticket_number ?? 'Repair update'} · {update.product_name ?? 'Product'}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600">{update.ticket_title}</p>
                                </div>
                                {update.ticket_status && <StatusBadge value={update.ticket_status} />}
                            </div>
                            {update.customer_notes && <p className="mt-3 text-sm text-slate-700">{update.customer_notes}</p>}
                            <p className="mt-3 text-xs text-slate-500">Updated {formatDate(update.updated_at)}</p>
                        </article>
                    ))}
                    {dashboard.recent_repair_updates.length === 0 && (
                        <p className="py-5 text-sm text-slate-500">There are no repair updates yet.</p>
                    )}
                </div>
            </section>
        </section>
    );
}

export function DashboardPage() {
    const dashboardQuery = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, staleTime: 30_000 });

    if (dashboardQuery.isLoading) return <DashboardLoading />;
    if (dashboardQuery.error || !dashboardQuery.data)
        return <DashboardError error={dashboardQuery.error ?? new Error('No dashboard data was returned.')} />;

    return dashboardQuery.data.role === 'admin' ? (
        <AdminDashboardPage dashboard={dashboardQuery.data} />
    ) : dashboardQuery.data.role === 'technician' ? (
        <TechnicianDashboardPage dashboard={dashboardQuery.data} />
    ) : (
        <ClientDashboardPage dashboard={dashboardQuery.data} />
    );
}
