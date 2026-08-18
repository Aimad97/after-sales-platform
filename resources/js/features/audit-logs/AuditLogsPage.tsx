import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { TableSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { listAuditLogs } from '@/features/audit-logs/api';
import type { AuditLog, AuditLogFilters } from '@/features/audit-logs/types';
import { listUsers } from '@/features/users/api';
import { formatDate, humanize } from '@/utils/format';

const filterInputClassName =
    'min-h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20';

function actionLabel(action: string): string {
    return humanize(action.replaceAll('.', '_'));
}

function entityLabel(entityType: string): string {
    const shortName = entityType.split('\\').at(-1) ?? entityType;

    return shortName.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function AuditValues({ oldValues, newValues }: { oldValues: AuditLog['old_values']; newValues: AuditLog['new_values'] }) {
    if (!oldValues && !newValues) return <span className="text-slate-400">—</span>;

    return (
        <details className="max-w-xs text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-blue-700">View changes</summary>
            {oldValues && (
                <div className="mt-2">
                    <p className="font-semibold text-slate-700">Before</p>
                    <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-50 p-2 whitespace-pre-wrap">
                        {JSON.stringify(oldValues, null, 2)}
                    </pre>
                </div>
            )}
            {newValues && (
                <div className="mt-2">
                    <p className="font-semibold text-slate-700">After</p>
                    <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-50 p-2 whitespace-pre-wrap">
                        {JSON.stringify(newValues, null, 2)}
                    </pre>
                </div>
            )}
        </details>
    );
}

export function AuditLogsPage() {
    const [filters, setFilters] = useState<AuditLogFilters>({ per_page: 20 });
    const auditLogsQuery = useQuery({ queryKey: ['audit-logs', filters], queryFn: () => listAuditLogs(filters) });
    const usersQuery = useQuery({
        queryKey: ['users', 'audit-log-filters'],
        queryFn: () => listUsers({ per_page: 100, sort: 'first_name', direction: 'asc' }),
    });
    const updateFilters = (next: Partial<AuditLogFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<AuditLog>[] = [
        {
            id: 'when',
            header: 'When',
            cell: (auditLog) => <span className="whitespace-nowrap text-slate-600">{formatDate(auditLog.created_at)}</span>,
        },
        {
            id: 'user',
            header: 'User',
            cell: (auditLog) => <span className="font-medium text-slate-800">{auditLog.user?.display_name ?? 'System'}</span>,
        },
        {
            id: 'action',
            header: 'Action',
            cell: (auditLog) => (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {actionLabel(auditLog.action)}
                </span>
            ),
        },
        {
            id: 'entity',
            header: 'Entity',
            cell: (auditLog) => (
                <span className="text-slate-700">
                    {entityLabel(auditLog.entity_type)} <span className="font-mono text-xs text-slate-500">#{auditLog.entity_id}</span>
                </span>
            ),
        },
        {
            id: 'changes',
            header: 'Changes',
            cell: (auditLog) => <AuditValues oldValues={auditLog.old_values} newValues={auditLog.new_values} />,
        },
        {
            id: 'request',
            header: 'Request',
            cell: (auditLog) => (
                <div className="max-w-48 text-xs text-slate-500">
                    <p>{auditLog.ip_address ?? 'No IP recorded'}</p>
                    {auditLog.user_agent && (
                        <p className="mt-1 truncate" title={auditLog.user_agent}>
                            {auditLog.user_agent}
                        </p>
                    )}
                </div>
            ),
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader title="Audit logs" description="Review administrative and security-sensitive changes across the platform." />
            <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
                <label className="text-sm font-medium text-slate-700">
                    <span className="mb-1 block">User</span>
                    <select
                        className={filterInputClassName}
                        value={filters.user_id ?? ''}
                        onChange={(event) => updateFilters({ user_id: event.target.value === '' ? '' : Number(event.target.value) })}
                    >
                        <option value="">All users</option>
                        {usersQuery.data?.data.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.first_name} {user.last_name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                    <span className="mb-1 block">Action</span>
                    <input
                        className={filterInputClassName}
                        placeholder="e.g. ticket.updated"
                        value={filters.action ?? ''}
                        onChange={(event) => updateFilters({ action: event.target.value || undefined })}
                    />
                </label>
                <label className="text-sm font-medium text-slate-700">
                    <span className="mb-1 block">Entity</span>
                    <input
                        className={filterInputClassName}
                        placeholder="e.g. Ticket"
                        value={filters.entity_type ?? ''}
                        onChange={(event) => updateFilters({ entity_type: event.target.value || undefined })}
                    />
                </label>
                <label className="text-sm font-medium text-slate-700">
                    <span className="mb-1 block">From date</span>
                    <input
                        className={filterInputClassName}
                        type="date"
                        value={filters.date_from ?? ''}
                        onChange={(event) => updateFilters({ date_from: event.target.value || undefined })}
                    />
                </label>
                <label className="text-sm font-medium text-slate-700">
                    <span className="mb-1 block">To date</span>
                    <input
                        className={filterInputClassName}
                        type="date"
                        value={filters.date_to ?? ''}
                        onChange={(event) => updateFilters({ date_to: event.target.value || undefined })}
                    />
                </label>
                <div className="flex items-end">
                    <Button variant="outline" onClick={() => setFilters({ per_page: 20 })}>
                        Reset filters
                    </Button>
                </div>
            </div>
            {auditLogsQuery.isLoading ? (
                <TableSkeleton columns={6} />
            ) : (
                <>
                    <ErrorMessage error={auditLogsQuery.error} />
                    <DataTable
                        rows={auditLogsQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(auditLog) => auditLog.id}
                        ariaLabel="Administrative audit log"
                        emptyMessage="No audit-log entries match these filters."
                    />
                    {auditLogsQuery.data && (
                        <Pagination
                            meta={auditLogsQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}
        </section>
    );
}
