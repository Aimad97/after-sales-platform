import type { ReactNode } from 'react';

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
}

export function DataTable<T>({ rows, columns, getRowKey, emptyMessage }: DataTableProps<T>) {
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                        {columns.map((column) => (
                            <th key={column.id} className={`px-4 py-3 font-semibold ${column.headerClassName ?? ''}`}>
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((row) => (
                        <tr key={getRowKey(row)}>
                            {columns.map((column) => (
                                <td key={column.id} className={`px-4 py-3 ${column.cellClassName ?? ''}`}>
                                    {column.cell(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-600">{emptyMessage}</p>}
        </div>
    );
}
