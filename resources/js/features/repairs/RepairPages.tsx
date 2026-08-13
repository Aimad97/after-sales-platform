import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AttachmentPanel } from '@/components/AttachmentPanel';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { getRepair, listRepairs } from '@/features/repairs/api';
import type { Repair, RepairFilters } from '@/features/repairs/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useTicketRealtime } from '@/hooks/useRealtime';
import { formatDate, humanize } from '@/utils/format';

const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div>{action}</div>;
}

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p> : null;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 break-words text-sm text-slate-800">{value}</div></div>;
}

function formatAmount(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'MAD' }).format(amount) : '--';
}

export function RepairsPage() {
    const [filters, setFilters] = useState<RepairFilters>({ state: 'current', per_page: 10 });
    const repairsQuery = useQuery({ queryKey: ['repairs', filters], queryFn: () => listRepairs(filters) });
    const updateFilters = (next: Partial<RepairFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Repair>[] = [
        {
            id: 'ticket',
            header: 'Ticket',
            cell: (repair) => <div><Link className="font-semibold text-slate-900 hover:text-blue-700" to={`/admin/repairs/${repair.id}`}>{repair.ticket?.ticket_number ?? `Repair #${repair.id}`}</Link><p className="mt-0.5 text-xs text-slate-500">{repair.ticket?.title ?? 'Ticket details unavailable'}</p></div>,
        },
        { id: 'client', header: 'Client', cell: (repair) => <span className="text-slate-700">{repair.ticket?.client ?? '--'}</span> },
        { id: 'product', header: 'Product', cell: (repair) => <span className="text-slate-700">{repair.ticket?.product ?? '--'}</span> },
        { id: 'technician', header: 'Technician', cell: (repair) => <span className="text-slate-700">{repair.technician?.name ?? repair.technician?.employee_code ?? 'Unassigned'}</span> },
        { id: 'status', header: 'Ticket status', cell: (repair) => repair.ticket?.status ? <StatusBadge value={repair.ticket.status} /> : <span className="text-slate-500">--</span> },
        { id: 'result', header: 'Result', cell: (repair) => repair.result ? <StatusBadge value={repair.result} /> : <span className="text-slate-500">In progress</span> },
        { id: 'updated', header: 'Updated', cell: (repair) => <span className="text-slate-600">{formatDate(repair.updated_at)}</span> },
    ];

    return (
        <section className="space-y-6">
            <PageHeader title="Repairs" description="Review active and completed repair records, including their authorized files." />
            <div className="max-w-xs rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-medium text-slate-800">Repair state<select className={inputClassName} value={filters.state ?? ''} onChange={(event) => updateFilters({ state: event.target.value as RepairFilters['state'] })}><option value="">All repairs</option><option value="current">Current repairs</option><option value="completed">Completed repairs</option></select></label>
            </div>
            {repairsQuery.isLoading ? <p className="text-sm text-slate-600">Loading repairs...</p> : <><ErrorMessage error={repairsQuery.error} /><DataTable rows={repairsQuery.data?.data ?? []} columns={columns} getRowKey={(repair) => repair.id} emptyMessage="No repair records match this filter." />{repairsQuery.data && <Pagination meta={repairsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</>}
        </section>
    );
}

export function RepairDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const repairId = Number(id);
    const repairQuery = useQuery({ queryKey: ['repairs', repairId], queryFn: () => getRepair(repairId), enabled: Number.isInteger(repairId) && repairId > 0 });
    const { can } = usePermissions();
    const repair = repairQuery.data;
    useTicketRealtime(repair?.ticket_id ?? null);

    if (repairQuery.isLoading) return <p className="text-sm text-slate-600">Loading repair...</p>;
    if (!repair) return <ErrorMessage error={repairQuery.error ?? new Error('Repair not found.')} />;

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader
                title={repair.ticket?.ticket_number ?? `Repair #${repair.id}`}
                description={repair.ticket?.title ?? 'Repair record'}
                action={<Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to="/admin/repairs">Back to repairs</Link>}
            />
            <AttachmentPanel resourceType="repairs" resourceKey={repair.id} title="Repair attachments" canUpload={can('repairs.update')} canDelete={can('repairs.update')} />
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-4">
                <Detail label="Ticket status" value={repair.ticket?.status ? <StatusBadge value={repair.ticket.status} /> : '--'} />
                <Detail label="Client" value={repair.ticket?.client ?? '--'} />
                <Detail label="Product" value={repair.ticket?.product ?? '--'} />
                <Detail label="Technician" value={repair.technician?.name ?? repair.technician?.employee_code ?? 'Unassigned'} />
                <Detail label="Started" value={formatDate(repair.started_at)} />
                <Detail label="Completed" value={formatDate(repair.completed_at)} />
                <Detail label="Result" value={repair.result ? <StatusBadge value={repair.result} /> : 'In progress'} />
                <Detail label="Total cost" value={<strong>{formatAmount(repair.total_cost)}</strong>} />
                <div className="md:col-span-2 lg:col-span-4"><Detail label="Diagnosis" value={<p className="whitespace-pre-wrap">{repair.diagnosis ?? 'No diagnosis has been recorded.'}</p>} /></div>
                <div className="md:col-span-2"><Detail label="Root cause" value={<p className="whitespace-pre-wrap">{repair.root_cause ?? '--'}</p>} /></div>
                <div className="md:col-span-2"><Detail label="Repair action" value={<p className="whitespace-pre-wrap">{repair.repair_action ?? '--'}</p>} /></div>
                <div className="md:col-span-2"><Detail label="Customer notes" value={<p className="whitespace-pre-wrap">{repair.customer_notes ?? '--'}</p>} /></div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">Repair history</h3>
                <div className="mt-5 space-y-4 border-l-2 border-slate-200 pl-5">
                    {(repair.history ?? []).map((entry) => <article className="relative" key={entry.id}><span className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" /><p className="font-medium text-slate-900">{humanize(entry.event)}</p><p className="mt-1 text-sm text-slate-600">{formatDate(entry.occurred_at)}{entry.changed_by ? ` by ${entry.changed_by}` : ''}</p></article>)}
                    {(repair.history ?? []).length === 0 && <p className="text-sm text-slate-600">No repair activity has been recorded yet.</p>}
                </div>
            </section>
        </section>
    );
}
