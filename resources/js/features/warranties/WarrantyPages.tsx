import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { listProducts } from '@/features/catalog/api';
import { listClients } from '@/features/clients/api';
import {
    getWarranty,
    getWarrantyEligibility,
    listClientWarranties,
    listWarranties,
    lookupWarranty,
    updateWarranty,
} from '@/features/warranties/api';
import type { Warranty, WarrantyEligibility, WarrantyFilters, WarrantyStatus, WarrantyUpdatePayload } from '@/features/warranties/types';
import { Can } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export const warrantyUpdateSchema = z.object({
    status: z.enum(['void', 'replaced']),
    void_reason: z.string().trim().max(1000),
    notes: z.string().max(5000),
}).superRefine((values, context) => {
    if (values.status === 'void' && values.void_reason.length === 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['void_reason'], message: 'A reason is required when voiding a warranty.' });
    }
});

type WarrantyUpdateFormValues = z.infer<typeof warrantyUpdateSchema>;

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div>{action}</div>;
}

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p> : null;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <label className="block text-sm font-medium text-slate-800">{label}{children}{error && <span className="mt-1 block text-sm font-normal text-rose-700">{error}</span>}</label>;
}

function formatDateOnly(value: string | null): string {
    if (!value) return '—';

    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

export function WarrantiesPage() {
    const [filters, setFilters] = useState<WarrantyFilters>({ per_page: 10, sort: 'expires_at', direction: 'asc' });
    const [lookupSerial, setLookupSerial] = useState('');
    const [submittedLookupSerial, setSubmittedLookupSerial] = useState<string | null>(null);
    const warrantiesQuery = useQuery({ queryKey: ['warranties', filters], queryFn: () => listWarranties(filters) });
    const lookupQuery = useQuery({ queryKey: ['warranties', 'lookup', submittedLookupSerial], queryFn: () => lookupWarranty(submittedLookupSerial ?? ''), enabled: submittedLookupSerial !== null, retry: false });
    const clientsQuery = useQuery({ queryKey: ['clients', 'warranty-filters'], queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }) });
    const productsQuery = useQuery({ queryKey: ['catalog', 'products', 'warranty-filters'], queryFn: () => listProducts({ per_page: 100, sort: 'name', direction: 'asc', active: '' }) });
    const updateFilters = (next: Partial<WarrantyFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Warranty>[] = [
        { id: 'serial', header: 'Warranty / serial', cell: (warranty) => <div><Link className="font-semibold text-slate-900 hover:text-blue-700" to={`/admin/warranties/${warranty.uuid}`}>{warranty.serial_number ?? 'No serial number'}</Link><p className="mt-0.5 text-xs text-slate-500">{warranty.uuid}</p></div> },
        { id: 'client', header: 'Client', cell: (warranty) => <span className="text-slate-700">{warranty.client?.display_name ?? 'Unknown client'}</span> },
        { id: 'product', header: 'Product', cell: (warranty) => <div className="text-slate-700"><p>{warranty.product?.name ?? 'Unknown product'}</p><p className="mt-0.5 text-xs text-slate-500">{warranty.product?.sku ?? '—'} · {warranty.product?.model ?? '—'}</p></div> },
        { id: 'coverage', header: 'Coverage', cell: (warranty) => <span className="text-slate-600">{formatDateOnly(warranty.starts_at)}<br />{formatDateOnly(warranty.expires_at)}</span> },
        { id: 'status', header: 'Status', cell: (warranty) => <StatusBadge value={warranty.status} /> },
        { id: 'actions', header: 'Actions', headerClassName: 'text-right', cellClassName: 'text-right', cell: (warranty) => <Link className="font-medium text-blue-700" to={`/admin/warranties/${warranty.uuid}`}>View</Link> },
    ];

    return (
        <section className="space-y-6">
            <PageHeader title="Warranties" description="Verify coverage for individual sold products and manage warranty lifecycle decisions." />
            <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setSubmittedLookupSerial(lookupSerial.trim() || null); }}>
                    <label className="sr-only" htmlFor="serial-lookup">Serial number</label>
                    <input id="serial-lookup" className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Look up a serial number..." value={lookupSerial} onChange={(event) => setLookupSerial(event.target.value)} />
                    <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={lookupSerial.trim().length === 0}>Check warranty</button>
                </form>
                {lookupQuery.isFetching && <p className="mt-3 text-sm text-slate-600">Looking up warranty...</p>}
                {lookupQuery.data && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-100 bg-white p-3 text-sm"><div><p className="font-semibold text-slate-900">{lookupQuery.data.warranty.product?.name ?? 'Product'} · {lookupQuery.data.warranty.serial_number}</p><p className="mt-1 text-slate-600">{lookupQuery.data.eligibility.reason}</p></div><Link className="font-medium text-blue-700" to={`/admin/warranties/${lookupQuery.data.warranty.uuid}`}>View warranty</Link></div>}
                {submittedLookupSerial !== null && lookupQuery.error && <ErrorMessage error={lookupQuery.error} />}
            </section>
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
                <input className={inputClassName} placeholder="Search serial, client, product..." value={filters.search ?? ''} onChange={(event) => updateFilters({ search: event.target.value || undefined })} />
                <select className={inputClassName} value={filters.client_id ?? ''} onChange={(event) => updateFilters({ client_id: event.target.value === '' ? '' : Number(event.target.value) })}><option value="">All clients</option>{clientsQuery.data?.data.map((client) => <option key={client.id} value={client.id}>{client.display_name}</option>)}</select>
                <select className={inputClassName} value={filters.product_id ?? ''} onChange={(event) => updateFilters({ product_id: event.target.value === '' ? '' : Number(event.target.value) })}><option value="">All products</option>{productsQuery.data?.data.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select>
                <select className={inputClassName} value={filters.status ?? ''} onChange={(event) => updateFilters({ status: event.target.value === '' ? '' : event.target.value as WarrantyStatus })}><option value="">All statuses</option><option value="active">Active</option><option value="expired">Expired</option><option value="void">Void</option><option value="replaced">Replaced</option></select>
            </div>
            {warrantiesQuery.isLoading ? <p className="text-sm text-slate-600">Loading warranties...</p> : <><ErrorMessage error={warrantiesQuery.error} /><DataTable rows={warrantiesQuery.data?.data ?? []} columns={columns} getRowKey={(warranty) => warranty.uuid} emptyMessage="No warranties match these filters." />{warrantiesQuery.data && <Pagination meta={warrantiesQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</>}
        </section>
    );
}

export function WarrantyDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const queryClient = useQueryClient();
    const warrantyQuery = useQuery({ queryKey: ['warranties', uuid], queryFn: () => getWarranty(uuid ?? ''), enabled: uuid !== undefined });
    const eligibilityQuery = useQuery({ queryKey: ['warranties', uuid, 'eligibility'], queryFn: () => getWarrantyEligibility(uuid ?? ''), enabled: uuid !== undefined });
    const form = useForm<WarrantyUpdateFormValues>({ resolver: zodResolver(warrantyUpdateSchema), defaultValues: { status: 'void', void_reason: '', notes: '' } });

    useEffect(() => {
        if (!warrantyQuery.data) return;

        form.reset({
            status: warrantyQuery.data.status === 'replaced' ? 'replaced' : 'void',
            void_reason: warrantyQuery.data.void_reason ?? '',
            notes: warrantyQuery.data.notes ?? '',
        });
    }, [form, warrantyQuery.data]);

    const updateMutation = useMutation({
        mutationFn: (values: WarrantyUpdateFormValues) => {
            const payload: WarrantyUpdatePayload = {
                status: values.status,
                void_reason: values.status === 'void' ? values.void_reason || null : undefined,
                notes: values.notes || null,
            };

            return updateWarranty(uuid ?? '', payload);
        },
        onSuccess: (warranty) => {
            void queryClient.invalidateQueries({ queryKey: ['warranties'] });
            void queryClient.invalidateQueries({ queryKey: ['clients'] });
            form.reset({ status: warranty.status === 'replaced' ? 'replaced' : 'void', void_reason: warranty.void_reason ?? '', notes: warranty.notes ?? '' });
        },
    });
    const warranty = warrantyQuery.data;

    if (warrantyQuery.isLoading) return <p className="text-sm text-slate-600">Loading warranty...</p>;
    if (!warranty) return <ErrorMessage error={warrantyQuery.error ?? new Error('Warranty not found.')} />;

    return (
        <section className="max-w-5xl space-y-6">
            <PageHeader title={warranty.serial_number ?? 'Warranty record'} description={`${warranty.product?.name ?? 'Product'} · ${warranty.client?.display_name ?? 'Client'}`} action={<StatusBadge value={warranty.status} />} />
            <EligibilityCard eligibility={eligibilityQuery.data} isLoading={eligibilityQuery.isLoading} error={eligibilityQuery.error} />
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2 lg:grid-cols-3"><Detail label="Warranty UUID" value={warranty.uuid} /><Detail label="Status" value={<StatusBadge value={warranty.status} />} /><Detail label="Serial number" value={warranty.serial_number ?? 'Not recorded'} /><Detail label="Client" value={warranty.client?.display_name ?? '—'} /><Detail label="Product" value={warranty.product ? `${warranty.product.name} (${warranty.product.model})` : '—'} /><Detail label="SKU" value={warranty.product?.sku ?? '—'} /><Detail label="Starts" value={formatDateOnly(warranty.starts_at)} /><Detail label="Expires" value={formatDateOnly(warranty.expires_at)} /><Detail label="Invoice" value={warranty.invoice_item?.invoice_number ?? 'Legacy purchase'} /><Detail label="Void reason" value={warranty.void_reason ?? '—'} /><Detail label="Created" value={formatDate(warranty.created_at)} /><div className="md:col-span-2 lg:col-span-3"><Detail label="Notes" value={<p className="whitespace-pre-wrap">{warranty.notes ?? 'No notes.'}</p>} /></div></section>
            {!['void', 'replaced'].includes(warranty.status) && <Can permission="warranties.manage"><WarrantyManagementForm form={form} mutation={updateMutation} /></Can>}
        </section>
    );
}

export function ClientWarrantyHistory({ clientUuid }: { clientUuid: string }) {
    const warrantiesQuery = useQuery({ queryKey: ['clients', clientUuid, 'warranties'], queryFn: () => listClientWarranties(clientUuid, { per_page: 20, sort: 'expires_at', direction: 'asc' }) });

    return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Warranty history</h3><p className="mt-1 text-sm text-slate-600">All product warranties, including active, expired, void, and replaced coverage.</p>{warrantiesQuery.isLoading ? <p className="mt-4 text-sm text-slate-600">Loading warranties...</p> : warrantiesQuery.error ? <ErrorMessage error={warrantiesQuery.error} /> : warrantiesQuery.data?.data.length === 0 ? <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">No warranties are registered for this client.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="pb-2 font-semibold">Product</th><th className="pb-2 font-semibold">Serial</th><th className="pb-2 font-semibold">Expires</th><th className="pb-2 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{warrantiesQuery.data?.data.map((warranty) => <tr key={warranty.uuid}><td className="py-3"><Link className="font-medium text-blue-700" to={`/admin/warranties/${warranty.uuid}`}>{warranty.product?.name ?? 'Unknown product'}</Link></td><td className="py-3 text-slate-600">{warranty.serial_number ?? '—'}</td><td className="py-3 text-slate-600">{formatDateOnly(warranty.expires_at)}</td><td className="py-3"><StatusBadge value={warranty.status} /></td></tr>)}</tbody></table></div>}</section>;
}

function EligibilityCard({ eligibility, isLoading, error }: { eligibility?: WarrantyEligibility; isLoading: boolean; error: unknown }) {
    if (isLoading) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Checking warranty eligibility...</p>;
    if (!eligibility) return <ErrorMessage error={error} />;

    return <section className={`rounded-xl border p-5 ${eligibility.is_under_warranty ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">{eligibility.is_under_warranty ? 'Product is under warranty' : 'Product is not under warranty'}</h3><p className="mt-1 text-sm text-slate-700">{eligibility.reason}</p></div><StatusBadge value={eligibility.status} /></div><p className="mt-3 text-sm text-slate-700">Coverage: {formatDateOnly(eligibility.starts_at)} to {formatDateOnly(eligibility.expires_at)} · {eligibility.remaining_days} day{eligibility.remaining_days === 1 ? '' : 's'} remaining</p></section>;
}

function WarrantyManagementForm({ form, mutation }: { form: ReturnType<typeof useForm<WarrantyUpdateFormValues>>; mutation: ReturnType<typeof useMutation<Warranty, Error, WarrantyUpdateFormValues>> }) {
    const status = form.watch('status');

    return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6"><h3 className="text-lg font-bold text-slate-900">Manage warranty</h3><p className="mt-1 text-sm text-slate-700">Void or mark this warranty as replaced. These lifecycle decisions cannot be reversed.</p><form className="mt-4 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><div className="grid gap-4 md:grid-cols-2"><Field label="New status" error={form.formState.errors.status?.message}><select className={inputClassName} {...form.register('status')}><option value="void">Void warranty</option><option value="replaced">Mark as replaced</option></select></Field>{status === 'void' && <Field label="Void reason" error={form.formState.errors.void_reason?.message}><input className={inputClassName} {...form.register('void_reason')} /></Field>}</div><Field label="Notes" error={form.formState.errors.notes?.message}><textarea className={inputClassName} rows={3} {...form.register('notes')} /></Field><ErrorMessage error={mutation.error} /><button className="rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save warranty decision'}</button></form></section>;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 break-words text-sm text-slate-800">{value}</div></div>;
}
