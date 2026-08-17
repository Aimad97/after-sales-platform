import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { listProducts } from '@/features/catalog/api';
import type { Product } from '@/features/catalog/types';
import { listClients } from '@/features/clients/api';
import { createInvoice, getInvoice, listClientInvoices, listInvoices, updateInvoice } from '@/features/invoices/api';
import type { Invoice, InvoiceFilters, InvoiceItemPayload, InvoicePayload, InvoiceStatus } from '@/features/invoices/types';
import { Can } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const invoiceItemSchema = z.object({
    product_id: z.number().int().positive('Select a product.'),
    serial_number: z.string().trim().max(100),
    quantity: z.number().int().min(1, 'Quantity must be at least 1.').max(10000),
    unit_price: z.number().min(0, 'Unit price cannot be negative.').max(999999),
    warranty_months: z.number().int().min(0).max(120),
    warranty_start_date: z.string(),
});

export const invoiceSchema = z.object({
    invoice_number: z.string().trim().max(40),
    client_id: z.number().int().positive('Select a client.'),
    invoice_date: z.string().min(1, 'Invoice date is required.'),
    tax_rate: z.number().min(0).max(100),
    status: z.enum(['draft', 'issued', 'void']),
    notes: z.string().max(5000),
    items: z.array(invoiceItemSchema).min(1, 'Add at least one invoice item.').max(100),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

function defaultItem(): InvoiceFormValues['items'][number] {
    return { product_id: 0, serial_number: '', quantity: 1, unit_price: 0, warranty_months: 12, warranty_start_date: '' };
}

function defaultValues(): InvoiceFormValues {
    return {
        invoice_number: '',
        client_id: 0,
        invoice_date: new Date().toISOString().slice(0, 10),
        tax_rate: 20,
        status: 'draft',
        notes: '',
        items: [defaultItem()],
    };
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div>{action}</div>;
}

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p> : null;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <label className="block text-sm font-medium text-slate-800">{label}{children}{error && <span className="mt-1 block text-sm font-normal text-rose-700">{error}</span>}</label>;
}

function formatAmount(value: number | string): string {
    const amount = Number(value);
    return Number.isFinite(amount) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'MAD' }).format(amount) : '—';
}

function formatDateOnly(value: string | null): string {
    if (!value) return '—';

    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

export function InvoicesPage() {
    const [filters, setFilters] = useState<InvoiceFilters>({ per_page: 10, sort: 'invoice_date', direction: 'desc' });
    const invoicesQuery = useQuery({ queryKey: ['invoices', filters], queryFn: () => listInvoices(filters) });
    const clientsQuery = useQuery({ queryKey: ['clients', 'invoice-filters'], queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }) });
    const updateFilters = (next: Partial<InvoiceFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Invoice>[] = [
        { id: 'number', header: 'Invoice', cell: (invoice) => <div><Link className="font-semibold text-slate-900 hover:text-blue-700" to={`/admin/invoices/${invoice.id}`}>{invoice.invoice_number}</Link><p className="mt-0.5 text-slate-500">{formatDateOnly(invoice.invoice_date)}</p></div> },
        { id: 'client', header: 'Client', cell: (invoice) => <span className="text-slate-700">{invoice.client?.display_name ?? 'Unknown client'}</span> },
        { id: 'items', header: 'Items', cell: (invoice) => <span className="text-slate-600">{invoice.items_count ?? invoice.items.length}</span> },
        { id: 'total', header: 'Total', cell: (invoice) => <span className="font-medium text-slate-900">{formatAmount(invoice.total_amount)}</span> },
        { id: 'status', header: 'Status', cell: (invoice) => <StatusBadge value={invoice.status} /> },
        {
            id: 'actions', header: 'Actions', headerClassName: 'text-right', cellClassName: 'text-right', cell: (invoice) => <div className="flex justify-end gap-3"><Link className="font-medium text-blue-700" to={`/admin/invoices/${invoice.id}`}>View</Link>{invoice.status === 'draft' && <Can permission="invoices.update"><Link className="font-medium text-blue-700" to={`/admin/invoices/${invoice.id}/edit`}>Edit</Link></Can>}</div>,
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader title="Invoices" description="Track sold products, invoice totals, and their warranty coverage." action={<Can permission="invoices.create"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm" to="/admin/invoices/new">Create invoice</Link></Can>} />
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
                <input className={inputClassName} placeholder="Invoice number or client..." value={filters.search ?? ''} onChange={(event) => updateFilters({ search: event.target.value || undefined })} />
                <select className={inputClassName} value={filters.client_id ?? ''} onChange={(event) => updateFilters({ client_id: event.target.value === '' ? '' : Number(event.target.value) })}><option value="">All clients</option>{clientsQuery.data?.data.map((client) => <option key={client.id} value={client.id}>{client.display_name}</option>)}</select>
                <select className={inputClassName} value={filters.status ?? ''} onChange={(event) => updateFilters({ status: event.target.value === '' ? '' : event.target.value as InvoiceStatus })}><option value="">All statuses</option><option value="draft">Draft</option><option value="issued">Issued</option><option value="void">Void</option></select>
                <input className={inputClassName} type="date" aria-label="Invoice date from" value={filters.date_from ?? ''} onChange={(event) => updateFilters({ date_from: event.target.value || undefined })} />
                <input className={inputClassName} type="date" aria-label="Invoice date to" value={filters.date_to ?? ''} onChange={(event) => updateFilters({ date_to: event.target.value || undefined })} />
            </div>
            {invoicesQuery.isLoading ? <p className="text-sm text-slate-600">Loading invoices...</p> : <><ErrorMessage error={invoicesQuery.error} /><DataTable rows={invoicesQuery.data?.data ?? []} columns={columns} getRowKey={(invoice) => invoice.id} emptyMessage="No invoices match these filters." />{invoicesQuery.data && <Pagination meta={invoicesQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</>}
        </section>
    );
}

export function InvoiceFormPage() {
    const { id } = useParams<{ id: string }>();
    const invoiceId = Number(id);
    const isEditing = id !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const invoiceQuery = useQuery({ queryKey: ['invoices', invoiceId], queryFn: () => getInvoice(invoiceId), enabled: isEditing && Number.isInteger(invoiceId) });
    const clientsQuery = useQuery({ queryKey: ['clients', 'invoice-options'], queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }) });
    const productsQuery = useQuery({ queryKey: ['catalog', 'products', 'invoice-options'], queryFn: () => listProducts({ per_page: 100, sort: 'name', direction: 'asc', active: '' }) });
    const form = useForm<InvoiceFormValues>({ resolver: zodResolver(invoiceSchema), defaultValues: defaultValues() });
    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
    const watchedItems = form.watch('items');
    const taxRate = form.watch('tax_rate');

    useEffect(() => {
        const invoice = invoiceQuery.data;
        if (!invoice) return;

        form.reset({
            invoice_number: invoice.invoice_number,
            client_id: invoice.client_id,
            invoice_date: invoice.invoice_date,
            tax_rate: Number(invoice.tax_rate),
            status: invoice.status,
            notes: invoice.notes ?? '',
            items: invoice.items.map((item) => ({
                product_id: item.product_id,
                serial_number: item.serial_number ?? '',
                quantity: item.quantity,
                unit_price: Number(item.unit_price),
                warranty_months: item.warranty_months,
                warranty_start_date: item.warranty_start_date ?? '',
            })),
        });
    }, [form, invoiceQuery.data]);

    const preview = useMemo(() => {
        const subtotal = watchedItems.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0) * (Number.isFinite(item.unit_price) ? item.unit_price : 0), 0);
        const tax = subtotal * (Number.isFinite(taxRate) ? taxRate : 0) / 100;

        return { subtotal, tax, total: subtotal + tax };
    }, [taxRate, watchedItems]);

    const saveMutation = useMutation({
        mutationFn: (values: InvoiceFormValues) => {
            const payload: InvoicePayload = {
                invoice_number: values.invoice_number || null,
                client_id: values.client_id,
                invoice_date: values.invoice_date,
                tax_rate: values.tax_rate,
                status: values.status,
                notes: values.notes || null,
                items: values.items.map((item): InvoiceItemPayload => ({
                    product_id: item.product_id,
                    serial_number: item.serial_number || null,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    warranty_months: item.warranty_months,
                    warranty_start_date: item.warranty_start_date || null,
                })),
            };

            return isEditing ? updateInvoice(invoiceId, payload) : createInvoice(payload);
        },
        onSuccess: (invoice) => {
            void queryClient.invalidateQueries({ queryKey: ['invoices'] });
            void queryClient.invalidateQueries({ queryKey: ['clients'] });
            navigate(`/admin/invoices/${invoice.id}`);
        },
    });

    if (isEditing && invoiceQuery.isLoading) return <p className="text-sm text-slate-600">Loading invoice...</p>;
    if (isEditing && !invoiceQuery.data) return <ErrorMessage error={invoiceQuery.error ?? new Error('Invoice not found.')} />;
    if (isEditing && invoiceQuery.data?.status !== 'draft') return <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">Only draft invoices can be edited.</p>;

    const clients = clientsQuery.data?.data ?? [];
    const products = productsQuery.data?.data ?? [];
    const submitDisabled = saveMutation.isPending || clients.length === 0 || products.length === 0;

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader title={isEditing ? 'Edit draft invoice' : 'Create invoice'} description="Add sold products and warranty terms. Totals are recalculated securely by the server." />
            {!clientsQuery.isLoading && !productsQuery.isLoading && (clients.length === 0 || products.length === 0) ? <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">Create at least one client and one product before creating an invoice.</p> : null}
            <ErrorMessage error={clientsQuery.error ?? productsQuery.error} />
            <form className="space-y-6 rounded-xl border border-slate-200 bg-white p-6" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Invoice number" error={form.formState.errors.invoice_number?.message}><input className={inputClassName} placeholder="Generated automatically if empty" {...form.register('invoice_number')} /></Field>
                    <Field label="Client" error={form.formState.errors.client_id?.message}><select className={inputClassName} value={form.watch('client_id')} onChange={(event) => form.setValue('client_id', Number(event.target.value), { shouldValidate: true })}><option value={0}>Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.display_name}</option>)}</select></Field>
                    <Field label="Invoice date" error={form.formState.errors.invoice_date?.message}><input className={inputClassName} type="date" {...form.register('invoice_date')} /></Field>
                    <Field label="Tax rate (%)" error={form.formState.errors.tax_rate?.message}><input className={inputClassName} type="number" min="0" max="100" step="0.01" {...form.register('tax_rate', { valueAsNumber: true })} /></Field>
                    <Field label="Status" error={form.formState.errors.status?.message}><select className={inputClassName} {...form.register('status')}><option value="draft">Draft</option><option value="issued">Issued</option><option value="void">Void</option></select></Field>
                </div>
                <Field label="Notes" error={form.formState.errors.notes?.message}><textarea className={inputClassName} rows={3} {...form.register('notes')} /></Field>

                <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Invoice items</h3><p className="mt-1 text-sm text-slate-600">Warranty end dates and monetary totals are generated by the server.</p></div><button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium" onClick={() => append(defaultItem())}>Add line</button></div>
                    {form.formState.errors.items?.message && <p className="text-sm text-rose-700">{form.formState.errors.items.message}</p>}
                    {fields.map((field, index) => {
                        const selectedProduct = products.find((product) => product.id === watchedItems[index]?.product_id);
                        const itemError = form.formState.errors.items?.[index];

                        return (
                            <div key={field.id} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
                                <Field label="Product" error={itemError?.product_id?.message}><select className={inputClassName} value={watchedItems[index]?.product_id ?? 0} disabled={productsQuery.isLoading || products.length === 0} onChange={(event) => { const product = products.find((entry) => entry.id === Number(event.target.value)); form.setValue(`items.${index}.product_id`, Number(event.target.value), { shouldValidate: true }); if (product) form.setValue(`items.${index}.warranty_months`, product.default_warranty_months, { shouldValidate: true }); }}><option value={0}>{productsQuery.isLoading ? 'Loading products...' : products.length === 0 ? 'No products available' : 'Select product'}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}{product.active ? '' : ' (inactive)'}</option>)}</select></Field>
                                <Field label="Quantity" error={itemError?.quantity?.message}><input className={inputClassName} type="number" min="1" max="10000" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} /></Field>
                                <Field label="Unit price (MAD)" error={itemError?.unit_price?.message}><input className={inputClassName} type="number" min="0" max="999999" step="0.01" {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })} /></Field>
                                <Field label={`Serial number${selectedProduct?.serial_number_required ? ' (required)' : ''}`} error={itemError?.serial_number?.message}><input className={inputClassName} {...form.register(`items.${index}.serial_number`)} /></Field>
                                <Field label="Warranty months" error={itemError?.warranty_months?.message}><input className={inputClassName} type="number" min="0" max="120" {...form.register(`items.${index}.warranty_months`, { valueAsNumber: true })} /></Field>
                                <Field label="Warranty starts" error={itemError?.warranty_start_date?.message}><input className={inputClassName} type="date" {...form.register(`items.${index}.warranty_start_date`)} /></Field>
                                <div className="flex items-end justify-end md:col-span-2 xl:col-span-6"><button type="button" className="text-sm font-medium text-rose-700 disabled:opacity-50" disabled={fields.length === 1} onClick={() => remove(index)}>Remove line</button></div>
                            </div>
                        );
                    })}
                </section>

                <section className="ml-auto grid max-w-sm gap-2 rounded-xl bg-slate-50 p-4 text-sm"><div className="flex justify-between text-slate-600"><span>Preview subtotal</span><span>{formatAmount(preview.subtotal)}</span></div><div className="flex justify-between text-slate-600"><span>Preview tax</span><span>{formatAmount(preview.tax)}</span></div><div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900"><span>Preview total</span><span>{formatAmount(preview.total)}</span></div></section>
                <ErrorMessage error={saveMutation.error} />
                <div className="flex justify-end gap-3"><Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" to={isEditing ? `/admin/invoices/${invoiceId}` : '/admin/invoices'}>Cancel</Link><button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={submitDisabled}>{saveMutation.isPending ? 'Saving...' : 'Save invoice'}</button></div>
            </form>
        </section>
    );
}

export function InvoiceDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const invoiceId = Number(id);
    const invoiceQuery = useQuery({ queryKey: ['invoices', invoiceId], queryFn: () => getInvoice(invoiceId), enabled: Number.isInteger(invoiceId) });
    const invoice = invoiceQuery.data;

    if (invoiceQuery.isLoading) return <p className="text-sm text-slate-600">Loading invoice...</p>;
    if (!invoice) return <ErrorMessage error={invoiceQuery.error ?? new Error('Invoice not found.')} />;

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader title={invoice.invoice_number} description={`Invoice for ${invoice.client?.display_name ?? 'client'} · ${formatDateOnly(invoice.invoice_date)}`} action={invoice.status === 'draft' ? <Can permission="invoices.update"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to={`/admin/invoices/${invoice.id}/edit`}>Edit draft</Link></Can> : undefined} />
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2 lg:grid-cols-4"><Detail label="Status" value={<StatusBadge value={invoice.status} />} /><Detail label="Client" value={invoice.client?.display_name ?? '—'} /><Detail label="Invoice date" value={formatDateOnly(invoice.invoice_date)} /><Detail label="Tax rate" value={`${invoice.tax_rate}%`} /><Detail label="Subtotal" value={formatAmount(invoice.subtotal_amount)} /><Detail label="Tax" value={formatAmount(invoice.tax_amount)} /><Detail label="Total" value={<strong>{formatAmount(invoice.total_amount)}</strong>} /><Detail label="Created" value={formatDate(invoice.created_at)} /><div className="md:col-span-2 lg:col-span-4"><Detail label="Notes" value={<p className="whitespace-pre-wrap">{invoice.notes ?? 'No notes.'}</p>} /></div></section>
            <InvoiceItemsTable items={invoice.items} />
        </section>
    );
}

export function ClientInvoiceHistory({ clientUuid }: { clientUuid: string }) {
    const historyQuery = useQuery({ queryKey: ['clients', clientUuid, 'invoices'], queryFn: () => listClientInvoices(clientUuid, { per_page: 10, sort: 'invoice_date', direction: 'desc' }) });

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Invoice history</h3>
            <p className="mt-1 text-sm text-slate-600">Sales invoices and their current document status.</p>
            {historyQuery.isLoading ? <p className="mt-4 text-sm text-slate-600">Loading invoices...</p> : historyQuery.error ? <ErrorMessage error={historyQuery.error} /> : (
                historyQuery.data?.data.length === 0 ? <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">No invoices have been created for this client.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="pb-2 font-semibold">Invoice</th><th className="pb-2 font-semibold">Date</th><th className="pb-2 font-semibold">Total</th><th className="pb-2 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{historyQuery.data?.data.map((invoice) => <tr key={invoice.id}><td className="py-3"><Link className="font-medium text-blue-700" to={`/admin/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td><td className="py-3 text-slate-600">{formatDateOnly(invoice.invoice_date)}</td><td className="py-3 text-slate-600">{formatAmount(invoice.total_amount)}</td><td className="py-3"><StatusBadge value={invoice.status} /></td></tr>)}</tbody></table></div>
            )}
        </section>
    );
}

function InvoiceItemsTable({ items }: { items: Invoice['items'] }) {
    return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Sold products</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="pb-2 font-semibold">Product</th><th className="pb-2 font-semibold">Serial</th><th className="pb-2 font-semibold">Quantity</th><th className="pb-2 font-semibold">Unit price</th><th className="pb-2 font-semibold">Warranty</th><th className="pb-2 font-semibold text-right">Line total</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="py-3 font-medium text-slate-900">{item.product ? `${item.product.name} (${item.product.model})` : 'Unknown product'}<p className="mt-0.5 text-xs font-normal text-slate-500">{item.product?.sku ?? '—'}</p></td><td className="py-3 text-slate-600">{item.serial_number ?? '—'}</td><td className="py-3 text-slate-600">{item.quantity}</td><td className="py-3 text-slate-600">{formatAmount(item.unit_price)}</td><td className="py-3 text-slate-600">{item.warranty_months} months<p className="mt-0.5 text-xs">{formatDateOnly(item.warranty_start_date)} → {formatDateOnly(item.warranty_end_date)}</p></td><td className="py-3 text-right font-medium text-slate-900">{formatAmount(item.line_total)}</td></tr>)}</tbody></table></div></section>;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 text-sm text-slate-800">{value}</div></div>;
}
