import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { downloadReportExport, getReport, getReportExport, requestReportExport } from '@/features/reports/api';
import {
    reportTypes,
    type ReportColumns,
    type ReportExport,
    type ReportFilterFormValues,
    type ReportFilters,
    type ReportRow,
    type ReportType,
} from '@/features/reports/types';
import { listTechnicians } from '@/features/technicians/api';
import { listBrands, listCategories, listProducts } from '@/features/catalog/api';
import { listClients } from '@/features/clients/api';
import { humanize } from '@/utils/format';

const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const reportDefinitions: Record<ReportType, { title: string; description: string }> = {
    tickets: { title: 'Tickets', description: 'Ticket volume, workflow status, priority, and warranty coverage.' },
    repairs: { title: 'Repairs', description: 'Repair activity, costs, outcomes, and assigned technicians.' },
    warranties: { title: 'Warranties', description: 'Warranty coverage, lifecycle state, and registered products.' },
    technician_performance: { title: 'Technician performance', description: 'Workload, completed repairs, and turnaround performance.' },
    defective_products: { title: 'Defective products', description: 'Products generating the highest SAV demand.' },
    client_history: { title: 'Client SAV history', description: 'Client service history across tickets, repairs, and warranty claims.' },
};

const ticketStatuses = [
    'opened', 'received', 'awaiting_diagnosis', 'diagnosing', 'awaiting_customer_approval', 'awaiting_part',
    'repairing', 'testing', 'repaired', 'ready_for_pickup', 'delivered', 'closed', 'cancelled',
];

const repairResults = ['repaired', 'partially_repaired', 'unrepairable', 'replacement_required'];

const warrantyStates = ['active', 'expired', 'void', 'replaced'];

const reportFiltersSchema = z.object({
    date_from: z.string(),
    date_to: z.string(),
    technician_id: z.string(),
    status: z.string(),
    priority: z.string(),
    brand_id: z.string(),
    category_id: z.string(),
    product_id: z.string(),
    warranty_state: z.string(),
    client_id: z.string(),
}).superRefine((values, context) => {
    if (values.date_from && values.date_to && values.date_from > values.date_to) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['date_to'], message: 'The end date must be on or after the start date.' });
    }
});

function defaultFilterValues(): ReportFilterFormValues {
    return {
        date_from: '', date_to: '', technician_id: '', status: '', priority: '', brand_id: '', category_id: '',
        product_id: '', warranty_state: '', client_id: '',
    };
}

function optionalPositiveInteger(value: string): number | undefined {
    if (value === '') return undefined;

    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function toReportFilters(values: ReportFilterFormValues): ReportFilters {
    return {
        date_from: values.date_from || undefined,
        date_to: values.date_to || undefined,
        technician_id: optionalPositiveInteger(values.technician_id),
        status: values.status.trim() || undefined,
        priority: values.priority || undefined,
        brand_id: optionalPositiveInteger(values.brand_id),
        category_id: optionalPositiveInteger(values.category_id),
        product_id: optionalPositiveInteger(values.product_id),
        warranty_state: values.warranty_state || undefined,
        client_id: optionalPositiveInteger(values.client_id),
    };
}

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p> : null;
}

function statusSuggestions(reportType: ReportType): string[] {
    return reportType === 'repairs' ? repairResults : ticketStatuses;
}

function cellText(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (Array.isArray(value)) return value.map(cellText).join(', ');

    try {
        return JSON.stringify(value);
    } catch {
        return '—';
    }
}

function reportColumns(columns: ReportColumns, rows: ReportRow[]): Array<[string, string]> {
    const configuredColumns = Object.entries(columns);

    if (configuredColumns.length > 0) return configuredColumns;

    return rows.length > 0
        ? Object.keys(rows[0]).filter((key) => key !== 'id').map((key) => [key, humanize(key)])
        : [];
}

function exportMessage(exportJob: ReportExport): string {
    if (exportJob.status === 'completed') return 'Your CSV export is ready to download.';
    if (exportJob.status === 'failed') return exportJob.failure_message ?? 'The export could not be generated.';
    if (exportJob.status === 'expired') return 'This CSV export has expired. Create a new export to download it.';

    return 'Your CSV export is queued. This page will update when it is ready.';
}

function isTerminalExportStatus(status: string): boolean {
    return status === 'completed' || status === 'failed' || status === 'expired';
}

export function ReportsPage() {
    const [reportType, setReportType] = useState<ReportType>('tickets');
    const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({ per_page: 25, page: 1 });
    const [exportJob, setExportJob] = useState<ReportExport | null>(null);
    const form = useForm<ReportFilterFormValues>({ resolver: zodResolver(reportFiltersSchema), defaultValues: defaultFilterValues() });

    const reportQuery = useQuery({
        queryKey: ['reports', reportType, appliedFilters],
        queryFn: () => getReport(reportType, appliedFilters),
    });
    const techniciansQuery = useQuery({ queryKey: ['technicians', 'report-filters'], queryFn: () => listTechnicians({ per_page: 100, sort: 'employee_code', direction: 'asc' }) });
    const brandsQuery = useQuery({ queryKey: ['catalog', 'brands', 'report-filters'], queryFn: () => listBrands({ per_page: 100, sort: 'name', direction: 'asc', active: '' }) });
    const categoriesQuery = useQuery({ queryKey: ['catalog', 'categories', 'report-filters'], queryFn: () => listCategories({ per_page: 100, sort: 'name', direction: 'asc', active: '' }) });
    const productsQuery = useQuery({ queryKey: ['catalog', 'products', 'report-filters'], queryFn: () => listProducts({ per_page: 100, sort: 'name', direction: 'asc', active: '' }) });
    const clientsQuery = useQuery({ queryKey: ['clients', 'report-filters'], queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }) });

    const exportMutation = useMutation({
        mutationFn: () => requestReportExport(reportType, appliedFilters),
        onSuccess: (nextExport) => setExportJob(nextExport),
    });
    const exportStatusQuery = useQuery({
        queryKey: ['report-exports', exportJob?.uuid],
        queryFn: () => getReportExport(exportJob?.uuid ?? ''),
        enabled: exportJob !== null && !isTerminalExportStatus(exportJob.status),
        refetchInterval: 2_500,
    });
    const downloadMutation = useMutation({ mutationFn: () => downloadReportExport(exportJob?.uuid ?? '') });

    useEffect(() => {
        if (exportStatusQuery.data) setExportJob(exportStatusQuery.data);
    }, [exportStatusQuery.data]);

    const columns = useMemo<DataTableColumn<ReportRow>[]>(() => reportColumns(reportQuery.data?.columns ?? {}, reportQuery.data?.data ?? []).map(([key, label]) => ({
        id: key,
        header: label,
        cell: (row) => <span className="text-slate-700">{cellText(row[key])}</span>,
    })), [reportQuery.data]);

    const selectReportType = (nextType: ReportType) => {
        setReportType(nextType);
        form.reset(defaultFilterValues());
        setAppliedFilters({ per_page: 25, page: 1 });
        setExportJob(null);
        exportMutation.reset();
        downloadMutation.reset();
    };

    const submitFilters = form.handleSubmit((values) => {
        setAppliedFilters({ ...toReportFilters(values), per_page: 25, page: 1 });
    });
    const resetFilters = () => {
        form.reset(defaultFilterValues());
        setAppliedFilters({ per_page: 25, page: 1 });
    };
    const updatePage = (page: number) => setAppliedFilters((current) => ({ ...current, page }));

    const rows = reportQuery.data?.data ?? [];
    const exportIsReady = exportJob?.status === 'completed';
    const statusListId = `report-status-options-${reportType}`;
    const supportsStatus = reportType !== 'warranties';

    return (
        <section className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div><h2 className="text-2xl font-bold text-slate-900">Reports</h2><p className="mt-1 text-sm text-slate-600">Analyze SAV activity, then create an authorized CSV export for longer review.</p></div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">Large CSV exports are prepared in the background.</div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Report type">
                {reportTypes.map((type) => {
                    const definition = reportDefinitions[type];
                    const active = type === reportType;

                    return <button key={type} type="button" className={`rounded-xl border p-4 text-left transition ${active ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'}`} onClick={() => selectReportType(type)}>
                        <p className={`font-semibold ${active ? 'text-blue-800' : 'text-slate-900'}`}>{definition.title}</p><p className="mt-1 text-sm text-slate-600">{definition.description}</p>
                    </button>;
                })}
            </section>

            <form className="rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={submitFilters}>
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Filter {reportDefinitions[reportType].title.toLowerCase()} report</h3><p className="mt-1 text-sm text-slate-600">Only relevant selected filters are applied by the server.</p></div><div className="flex gap-2"><button type="button" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={resetFilters}>Reset</button><button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" disabled={reportQuery.isFetching}>Run report</button></div></div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="text-sm font-medium text-slate-700"><span>From date</span><input className={inputClassName} type="date" {...form.register('date_from')} /></label>
                    <label className="text-sm font-medium text-slate-700"><span>To date</span><input className={inputClassName} type="date" {...form.register('date_to')} /><span className="mt-1 block min-h-4 text-xs font-normal text-rose-700">{form.formState.errors.date_to?.message}</span></label>
                    <label className="text-sm font-medium text-slate-700"><span>Technician</span><select className={inputClassName} {...form.register('technician_id')}><option value="">All technicians</option>{techniciansQuery.data?.data.map((technician) => <option key={technician.id} value={technician.id}>{technician.user ? `${technician.user.first_name} ${technician.user.last_name}` : technician.employee_code} · {technician.employee_code}</option>)}</select></label>
                    {supportsStatus && <label className="text-sm font-medium text-slate-700"><span>{reportType === 'repairs' ? 'Repair result' : 'Status'}</span><input className={inputClassName} list={statusListId} placeholder="All statuses" {...form.register('status')} /><datalist id={statusListId}>{statusSuggestions(reportType).map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</datalist></label>}
                    <label className="text-sm font-medium text-slate-700"><span>Priority</span><select className={inputClassName} {...form.register('priority')}><option value="">All priorities</option>{['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}</select></label>
                    <label className="text-sm font-medium text-slate-700"><span>Brand</span><select className={inputClassName} {...form.register('brand_id')}><option value="">All brands</option>{brandsQuery.data?.data.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
                    <label className="text-sm font-medium text-slate-700"><span>Category</span><select className={inputClassName} {...form.register('category_id')}><option value="">All categories</option>{categoriesQuery.data?.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                    <label className="text-sm font-medium text-slate-700"><span>Product</span><select className={inputClassName} {...form.register('product_id')}><option value="">All products</option>{productsQuery.data?.data.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>
                    <label className="text-sm font-medium text-slate-700"><span>Warranty state</span><select className={inputClassName} {...form.register('warranty_state')}><option value="">All warranty states</option>{warrantyStates.map((state) => <option key={state} value={state}>{humanize(state)}</option>)}</select></label>
                    <label className="text-sm font-medium text-slate-700"><span>Client</span><select className={inputClassName} {...form.register('client_id')}><option value="">All clients</option>{clientsQuery.data?.data.map((client) => <option key={client.id} value={client.id}>{client.display_name}</option>)}</select></label>
                </div>
            </form>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold text-slate-900">{reportDefinitions[reportType].title} results</h3><p className="mt-1 text-sm text-slate-600">{reportQuery.isFetching ? 'Refreshing results…' : reportQuery.data ? `${reportQuery.data.meta.total} matching record${reportQuery.data.meta.total === 1 ? '' : 's'}` : 'Preparing report results…'}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><button type="button" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>{exportMutation.isPending ? 'Queueing export…' : 'Export CSV'}</button>{exportIsReady && <button type="button" className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" disabled={downloadMutation.isPending} onClick={() => downloadMutation.mutate()}>{downloadMutation.isPending ? 'Downloading…' : 'Download CSV'}</button>}</div></div>
                <p className="mt-2 text-xs text-slate-500">Excel and PDF are not shown because no compatible server-side export package is installed.</p>
                {(exportMutation.error || downloadMutation.error || exportStatusQuery.error) && <div className="mt-4"><ErrorMessage error={exportMutation.error ?? downloadMutation.error ?? exportStatusQuery.error} /></div>}
                {exportJob && <div className={`mt-4 rounded-lg border p-3 text-sm ${exportJob.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-800' : exportIsReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}><span className="font-semibold">Export {humanize(exportJob.status)}.</span> {exportMessage(exportJob)}</div>}
                <div className="mt-5">
                    {reportQuery.isLoading ? <div className="space-y-3" aria-busy="true"><div className="h-10 animate-pulse rounded bg-slate-100" /><div className="h-10 animate-pulse rounded bg-slate-100" /><div className="h-10 animate-pulse rounded bg-slate-100" /></div> : reportQuery.error ? <ErrorMessage error={reportQuery.error} /> : <><DataTable rows={rows} columns={columns} getRowKey={(row) => String(row.id ?? row.uuid ?? row.ticket_uuid ?? JSON.stringify(row))} emptyMessage="No records match the selected report filters." />{reportQuery.data && <Pagination meta={reportQuery.data.meta} onPageChange={updatePage} />}</>}
                </div>
            </section>
        </section>
    );
}
