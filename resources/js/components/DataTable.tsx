import type { ReactNode } from 'react';
import { EmptyState } from '@/components/PageStates';
import { cn } from '@/utils/cn';

export interface DataTableColumn<T> {
    id: string;
    header: ReactNode;
    cell: (row: T) => ReactNode;
    headerClassName?: string;
    cellClassName?: string;
}

interface DataTableProps<T> {
    rows: T[];
    columns: DataTableColumn<T>[];
    getRowKey: (row: T) => string | number;
    emptyMessage: string;
    ariaLabel?: string;
    emptyDescription?: string;
    emptyAction?: ReactNode;
    className?: string;
}

export function DataTable<T>({
    rows,
    columns,
    getRowKey,
    emptyMessage,
    ariaLabel = 'Data table',
    emptyDescription,
    emptyAction,
    className,
}: DataTableProps<T>) {
    return (
        <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                    <caption className="sr-only">{ariaLabel}</caption>
                    <thead className="bg-muted/65 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.id}
                                    scope="col"
                                    className={cn('whitespace-nowrap px-4 py-3.5 font-semibold', column.headerClassName)}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                        {rows.map((row) => (
                            <tr key={getRowKey(row)} className="transition-colors hover:bg-muted/45">
                                {columns.map((column) => (
                                    <td
                                        key={column.id}
                                        className={cn('px-4 py-3.5 align-middle text-card-foreground', column.cellClassName)}
                                    >
                                        {column.cell(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={columns.length}>
                                    <EmptyState compact title={emptyMessage} description={emptyDescription} action={emptyAction} />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
