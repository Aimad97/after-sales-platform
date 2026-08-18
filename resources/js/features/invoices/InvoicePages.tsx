import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { z } from 'zod';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField } from '@/components/FormField';
import { PageHeader as SharedPageHeader } from '@/components/PageHeader';
import { PageSkeleton, TableSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { listProducts } from '@/features/catalog/api';
import { listClients } from '@/features/clients/api';
import { createInvoice, getInvoice, listClientInvoices, listInvoices, updateInvoice } from '@/features/invoices/api';
import type { Invoice, InvoiceFilters, InvoiceItemPayload, InvoicePayload, InvoiceStatus } from '@/features/invoices/types';
import { Can } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

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
    return <SharedPageHeader title={title} description={description} actions={action} />;
}

function Field({
    label,
    error,
    hint,
    required = false,
    children,
}: {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: ReactElement;
}) {
    return (
        <FormField label={label} error={error} hint={hint} required={required}>
            {children}
        </FormField>
    );
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
    const clientsQuery = useQuery({
        queryKey: ['clients', 'invoice-filters'],
        queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }),
    });
    const updateFilters = (next: Partial<InvoiceFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Invoice>[] = [
        {
            id: 'number',
            header: 'Invoice',
            cell: (invoice) => (
                <div>
                    <Link
                        className="font-semibold text-foreground transition-colors hover:text-primary"
                        to={`/admin/invoices/${invoice.id}`}
                    >
                        {invoice.invoice_number}
                    </Link>
                    <p className="mt-0.5 text-muted-foreground">{formatDateOnly(invoice.invoice_date)}</p>
                </div>
            ),
        },
        {
            id: 'client',
            header: 'Client',
            cell: (invoice) => <span>{invoice.client?.display_name ?? 'Unknown client'}</span>,
        },
        {
            id: 'items',
            header: 'Items',
            cell: (invoice) => <span className="text-muted-foreground">{invoice.items_count ?? invoice.items.length}</span>,
        },
        {
            id: 'total',
            header: 'Total',
            cell: (invoice) => <span className="font-semibold tabular-nums text-foreground">{formatAmount(invoice.total_amount)}</span>,
        },
        { id: 'status', header: 'Status', cell: (invoice) => <StatusBadge value={invoice.status} /> },
        {
            id: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (invoice) => (
                <div className="flex justify-end gap-1">
                    <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/invoices/${invoice.id}`}>
                        View
                    </Link>
                    {invoice.status === 'draft' && (
                        <Can permission="invoices.update">
                            <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/invoices/${invoice.id}/edit`}>
                                Edit
                            </Link>
                        </Can>
                    )}
                </div>
            ),
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader
                title="Invoices"
                description="Track sold products, invoice totals, and their warranty coverage."
                action={
                    <Can permission="invoices.create">
                        <Link className={buttonVariants()} to="/admin/invoices/new">
                            <Plus aria-hidden="true" />
                            Create invoice
                        </Link>
                    </Can>
                }
            />
            <Card aria-label="Invoice filters">
                <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 sm:pt-6 xl:grid-cols-5">
                    <FormField label="Search invoices">
                        <Input
                            type="search"
                            placeholder="Number or client name"
                            value={filters.search ?? ''}
                            onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                        />
                    </FormField>
                    <FormField label="Client">
                        <Select
                            value={filters.client_id ?? ''}
                            onChange={(event) => updateFilters({ client_id: event.target.value === '' ? '' : Number(event.target.value) })}
                        >
                            <option value="">All clients</option>
                            {clientsQuery.data?.data.map((client) => (
                                <option key={client.id} value={client.id}>
                                    {client.display_name}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label="Status">
                        <Select
                            value={filters.status ?? ''}
                            onChange={(event) =>
                                updateFilters({ status: event.target.value === '' ? '' : (event.target.value as InvoiceStatus) })
                            }
                        >
                            <option value="">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="issued">Issued</option>
                            <option value="void">Void</option>
                        </Select>
                    </FormField>
                    <FormField label="From date">
                        <Input
                            type="date"
                            value={filters.date_from ?? ''}
                            onChange={(event) => updateFilters({ date_from: event.target.value || undefined })}
                        />
                    </FormField>
                    <FormField label="To date">
                        <Input
                            type="date"
                            value={filters.date_to ?? ''}
                            onChange={(event) => updateFilters({ date_to: event.target.value || undefined })}
                        />
                    </FormField>
                </CardContent>
            </Card>
            {invoicesQuery.isLoading ? (
                <TableSkeleton columns={6} />
            ) : (
                <>
                    <ErrorMessage error={invoicesQuery.error} />
                    <DataTable
                        rows={invoicesQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(invoice) => invoice.id}
                        ariaLabel="Invoices"
                        emptyMessage="No invoices match these filters."
                        emptyDescription="Adjust the filters or create a new invoice to get started."
                    />
                    {invoicesQuery.data && (
                        <Pagination
                            meta={invoicesQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}
        </section>
    );
}

export function InvoiceFormPage() {
    const { id } = useParams<{ id: string }>();
    const invoiceId = Number(id);
    const isEditing = id !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const invoiceQuery = useQuery({
        queryKey: ['invoices', invoiceId],
        queryFn: () => getInvoice(invoiceId),
        enabled: isEditing && Number.isInteger(invoiceId),
    });
    const clientsQuery = useQuery({
        queryKey: ['clients', 'invoice-options'],
        queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }),
    });
    const productsQuery = useQuery({
        queryKey: ['catalog', 'products', 'invoice-options'],
        queryFn: () => listProducts({ per_page: 100, sort: 'name', direction: 'asc', active: '' }),
    });
    const form = useForm<InvoiceFormValues>({ resolver: zodResolver(invoiceSchema), defaultValues: defaultValues() });
    const [pendingVoidValues, setPendingVoidValues] = useState<InvoiceFormValues | null>(null);
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
        const subtotal = watchedItems.reduce(
            (sum, item) =>
                sum + (Number.isFinite(item.quantity) ? item.quantity : 0) * (Number.isFinite(item.unit_price) ? item.unit_price : 0),
            0,
        );
        const tax = (subtotal * (Number.isFinite(taxRate) ? taxRate : 0)) / 100;

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

    if (isEditing && invoiceQuery.isLoading) return <PageSkeleton />;
    if (isEditing && !invoiceQuery.data) return <ErrorMessage error={invoiceQuery.error ?? new Error('Invoice not found.')} />;
    if (isEditing && invoiceQuery.data?.status !== 'draft')
        return (
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
                <AlertTitle>Invoice cannot be edited</AlertTitle>
                <AlertDescription>Only draft invoices can be edited.</AlertDescription>
            </Alert>
        );
    if (clientsQuery.isLoading || productsQuery.isLoading) return <PageSkeleton />;

    const clients = clientsQuery.data?.data ?? [];
    const products = productsQuery.data?.data ?? [];
    const submitDisabled = saveMutation.isPending || clients.length === 0 || products.length === 0;
    const submitInvoice = (values: InvoiceFormValues) => {
        if (values.status === 'void') {
            setPendingVoidValues(values);
            return;
        }

        saveMutation.mutate(values);
    };

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader
                title={isEditing ? 'Edit draft invoice' : 'Create invoice'}
                description="Add sold products and warranty terms. Totals are recalculated securely by the server."
            />
            <ConfirmDialog
                open={pendingVoidValues !== null}
                title={isEditing ? 'Void this invoice?' : 'Create a void invoice?'}
                description="Void invoices cannot be edited afterward. Confirm only when this record must be permanently void."
                confirmLabel={isEditing ? 'Void invoice' : 'Create void invoice'}
                isPending={saveMutation.isPending}
                onCancel={() => setPendingVoidValues(null)}
                onConfirm={() => pendingVoidValues && saveMutation.mutate(pendingVoidValues)}
            />
            {clients.length === 0 || products.length === 0 ? (
                <Alert className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
                    <AlertTitle>Invoice setup required</AlertTitle>
                    <AlertDescription>Create at least one client and one product before creating an invoice.</AlertDescription>
                </Alert>
            ) : null}
            <ErrorMessage error={clientsQuery.error ?? productsQuery.error} />
            <form
                className="space-y-6 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
                onSubmit={form.handleSubmit(submitInvoice)}
            >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field
                        label="Invoice number"
                        error={form.formState.errors.invoice_number?.message}
                        hint="Leave blank to generate a number automatically."
                    >
                        <Input placeholder="Generated automatically" {...form.register('invoice_number')} />
                    </Field>
                    <Field label="Client" error={form.formState.errors.client_id?.message} required>
                        <Select
                            value={form.watch('client_id')}
                            onChange={(event) => form.setValue('client_id', Number(event.target.value), { shouldValidate: true })}
                        >
                            <option value={0}>Select a client</option>
                            {clients.map((client) => (
                                <option key={client.id} value={client.id}>
                                    {client.display_name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Invoice date" error={form.formState.errors.invoice_date?.message} required>
                        <Input type="date" {...form.register('invoice_date')} />
                    </Field>
                    <Field label="Tax rate (%)" error={form.formState.errors.tax_rate?.message} required>
                        <Input type="number" min="0" max="100" step="0.01" {...form.register('tax_rate', { valueAsNumber: true })} />
                    </Field>
                    <Field label="Status" error={form.formState.errors.status?.message} required>
                        <Select {...form.register('status')}>
                            <option value="draft">Draft</option>
                            <option value="issued">Issued</option>
                            <option value="void">Void</option>
                        </Select>
                    </Field>
                </div>
                <Field label="Notes" error={form.formState.errors.notes?.message}>
                    <Textarea rows={3} {...form.register('notes')} />
                </Field>

                <section className="space-y-4 rounded-xl border border-border bg-muted/35 p-4" aria-labelledby="invoice-items-title">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 id="invoice-items-title" className="font-semibold text-foreground">
                                Invoice items
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Warranty end dates and monetary totals are generated by the server.
                            </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => append(defaultItem())}>
                            <Plus aria-hidden="true" />
                            Add line
                        </Button>
                    </div>
                    {form.formState.errors.items?.message && (
                        <p className="text-sm font-medium text-destructive" role="alert">
                            {form.formState.errors.items.message}
                        </p>
                    )}
                    {fields.map((field, index) => {
                        const selectedProduct = products.find((product) => product.id === watchedItems[index]?.product_id);
                        const itemError = form.formState.errors.items?.[index];

                        return (
                            <div
                                key={field.id}
                                className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6"
                            >
                                <Field label="Product" error={itemError?.product_id?.message} required>
                                    <Select
                                        value={watchedItems[index]?.product_id ?? 0}
                                        disabled={productsQuery.isLoading || products.length === 0}
                                        onChange={(event) => {
                                            const product = products.find((entry) => entry.id === Number(event.target.value));
                                            form.setValue(`items.${index}.product_id`, Number(event.target.value), {
                                                shouldValidate: true,
                                            });
                                            if (product)
                                                form.setValue(`items.${index}.warranty_months`, product.default_warranty_months, {
                                                    shouldValidate: true,
                                                });
                                        }}
                                    >
                                        <option value={0}>
                                            {productsQuery.isLoading
                                                ? 'Loading products...'
                                                : products.length === 0
                                                  ? 'No products available'
                                                  : 'Select product'}
                                        </option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.name} · {product.sku}
                                                {product.active ? '' : ' (inactive)'}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label="Quantity" error={itemError?.quantity?.message} required>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="10000"
                                        {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                                    />
                                </Field>
                                <Field label="Unit price (MAD)" error={itemError?.unit_price?.message} required>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="999999"
                                        step="0.01"
                                        {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                                    />
                                </Field>
                                <Field
                                    label={`Serial number${selectedProduct?.serial_number_required ? ' (required)' : ''}`}
                                    error={itemError?.serial_number?.message}
                                    required={selectedProduct?.serial_number_required}
                                >
                                    <Input {...form.register(`items.${index}.serial_number`)} />
                                </Field>
                                <Field label="Warranty months" error={itemError?.warranty_months?.message} required>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="120"
                                        {...form.register(`items.${index}.warranty_months`, { valueAsNumber: true })}
                                    />
                                </Field>
                                <Field label="Warranty starts" error={itemError?.warranty_start_date?.message}>
                                    <Input type="date" {...form.register(`items.${index}.warranty_start_date`)} />
                                </Field>
                                <div className="flex items-end justify-end md:col-span-2 xl:col-span-6">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        disabled={fields.length === 1}
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 aria-hidden="true" />
                                        Remove line
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </section>

                <section
                    className="ml-auto grid w-full max-w-sm gap-2 rounded-xl border border-border bg-muted/35 p-4 text-sm"
                    aria-label="Invoice total preview"
                >
                    <div className="flex justify-between gap-4 text-muted-foreground">
                        <span>Preview subtotal</span>
                        <span>{formatAmount(preview.subtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-muted-foreground">
                        <span>Preview tax</span>
                        <span>{formatAmount(preview.tax)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-border pt-2 font-bold text-foreground">
                        <span>Preview total</span>
                        <span>{formatAmount(preview.total)}</span>
                    </div>
                </section>
                <ErrorMessage error={saveMutation.error} />
                <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <Link
                        className={buttonVariants({ variant: 'outline' })}
                        to={isEditing ? `/admin/invoices/${invoiceId}` : '/admin/invoices'}
                    >
                        Cancel
                    </Link>
                    <Button type="submit" disabled={submitDisabled}>
                        {saveMutation.isPending ? 'Saving...' : 'Save invoice'}
                    </Button>
                </div>
            </form>
        </section>
    );
}

export function InvoiceDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const invoiceId = Number(id);
    const invoiceQuery = useQuery({
        queryKey: ['invoices', invoiceId],
        queryFn: () => getInvoice(invoiceId),
        enabled: Number.isInteger(invoiceId),
    });
    const invoice = invoiceQuery.data;

    if (invoiceQuery.isLoading) return <PageSkeleton />;
    if (!invoice) return <ErrorMessage error={invoiceQuery.error ?? new Error('Invoice not found.')} />;

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader
                title={invoice.invoice_number}
                description={`Invoice for ${invoice.client?.display_name ?? 'client'} · ${formatDateOnly(invoice.invoice_date)}`}
                action={
                    invoice.status === 'draft' ? (
                        <Can permission="invoices.update">
                            <Link className={buttonVariants()} to={`/admin/invoices/${invoice.id}/edit`}>
                                Edit draft
                            </Link>
                        </Can>
                    ) : undefined
                }
            />
            <Card>
                <CardContent className="pt-5 sm:pt-6">
                    <dl className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-4">
                        <Detail label="Status" value={<StatusBadge value={invoice.status} />} />
                        <Detail label="Client" value={invoice.client?.display_name ?? '—'} />
                        <Detail label="Invoice date" value={formatDateOnly(invoice.invoice_date)} />
                        <Detail label="Tax rate" value={`${invoice.tax_rate}%`} />
                        <Detail label="Subtotal" value={formatAmount(invoice.subtotal_amount)} />
                        <Detail label="Tax" value={formatAmount(invoice.tax_amount)} />
                        <Detail label="Total" value={<strong className="tabular-nums">{formatAmount(invoice.total_amount)}</strong>} />
                        <Detail label="Created" value={formatDate(invoice.created_at)} />
                        <div className="md:col-span-2 lg:col-span-4">
                            <Detail label="Notes" value={<p className="whitespace-pre-wrap">{invoice.notes ?? 'No notes.'}</p>} />
                        </div>
                    </dl>
                </CardContent>
            </Card>
            <InvoiceItemsTable items={invoice.items} />
        </section>
    );
}

export function ClientInvoiceHistory({ clientUuid }: { clientUuid: string }) {
    const historyQuery = useQuery({
        queryKey: ['clients', clientUuid, 'invoices'],
        queryFn: () => listClientInvoices(clientUuid, { per_page: 10, sort: 'invoice_date', direction: 'desc' }),
    });
    const columns: DataTableColumn<Invoice>[] = [
        {
            id: 'invoice',
            header: 'Invoice',
            cell: (invoice) => (
                <Link className="font-semibold text-foreground transition-colors hover:text-primary" to={`/admin/invoices/${invoice.id}`}>
                    {invoice.invoice_number}
                </Link>
            ),
        },
        {
            id: 'date',
            header: 'Date',
            cell: (invoice) => <span className="text-muted-foreground">{formatDateOnly(invoice.invoice_date)}</span>,
        },
        {
            id: 'total',
            header: 'Total',
            cell: (invoice) => <span className="font-medium tabular-nums">{formatAmount(invoice.total_amount)}</span>,
        },
        { id: 'status', header: 'Status', cell: (invoice) => <StatusBadge value={invoice.status} /> },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Invoice history</CardTitle>
                <p className="text-sm text-muted-foreground">Sales invoices and their current document status.</p>
            </CardHeader>
            <CardContent>
                {historyQuery.isLoading ? (
                    <TableSkeleton rows={3} columns={4} />
                ) : historyQuery.error ? (
                    <ErrorMessage error={historyQuery.error} />
                ) : (
                    <DataTable
                        rows={historyQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(invoice) => invoice.id}
                        ariaLabel="Client invoice history"
                        emptyMessage="No invoices yet"
                        emptyDescription="No invoices have been created for this client."
                        className="shadow-none"
                    />
                )}
            </CardContent>
        </Card>
    );
}

function InvoiceItemsTable({ items }: { items: Invoice['items'] }) {
    const columns: DataTableColumn<Invoice['items'][number]>[] = [
        {
            id: 'product',
            header: 'Product',
            cell: (item) => (
                <div className="font-medium text-foreground">
                    {item.product ? `${item.product.name} (${item.product.model})` : 'Unknown product'}
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">{item.product?.sku ?? '—'}</p>
                </div>
            ),
        },
        { id: 'serial', header: 'Serial', cell: (item) => <span className="text-muted-foreground">{item.serial_number ?? '—'}</span> },
        { id: 'quantity', header: 'Quantity', cell: (item) => <span className="tabular-nums">{item.quantity}</span> },
        {
            id: 'unit-price',
            header: 'Unit price',
            cell: (item) => <span className="tabular-nums text-muted-foreground">{formatAmount(item.unit_price)}</span>,
        },
        {
            id: 'warranty',
            header: 'Warranty',
            cell: (item) => (
                <div className="text-muted-foreground">
                    {item.warranty_months} months
                    <p className="mt-0.5 whitespace-nowrap text-xs">
                        {formatDateOnly(item.warranty_start_date)} → {formatDateOnly(item.warranty_end_date)}
                    </p>
                </div>
            ),
        },
        {
            id: 'line-total',
            header: 'Line total',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (item) => <span className="font-semibold tabular-nums text-foreground">{formatAmount(item.line_total)}</span>,
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sold products</CardTitle>
            </CardHeader>
            <CardContent>
                <DataTable
                    rows={items}
                    columns={columns}
                    getRowKey={(item) => item.id}
                    ariaLabel="Sold products on this invoice"
                    emptyMessage="No sold products"
                    emptyDescription="This invoice does not contain any product lines."
                    className="shadow-none"
                />
            </CardContent>
        </Card>
    );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-1.5 text-sm text-foreground">{value}</dd>
        </div>
    );
}
