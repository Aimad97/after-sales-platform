import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { ApiErrorAlert as ErrorMessage, getApiErrorMessage } from '@/components/ApiErrorAlert';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, PageSkeleton, TableSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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

export const warrantyUpdateSchema = z
    .object({
        status: z.enum(['void', 'replaced']),
        void_reason: z.string().trim().max(1000),
        notes: z.string().max(5000),
    })
    .superRefine((values, context) => {
        if (values.status === 'void' && values.void_reason.length === 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['void_reason'],
                message: 'A reason is required when voiding a warranty.',
            });
        }
    });

type WarrantyUpdateFormValues = z.infer<typeof warrantyUpdateSchema>;

function formatDateOnly(value: string | null): string {
    if (!value) return '—';

    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

export function WarrantiesPage() {
    const [filters, setFilters] = useState<WarrantyFilters>({ per_page: 10, sort: 'expires_at', direction: 'asc' });
    const [lookupSerial, setLookupSerial] = useState('');
    const [submittedLookupSerial, setSubmittedLookupSerial] = useState<string | null>(null);
    const warrantiesQuery = useQuery({ queryKey: ['warranties', filters], queryFn: () => listWarranties(filters) });
    const lookupQuery = useQuery({
        queryKey: ['warranties', 'lookup', submittedLookupSerial],
        queryFn: () => lookupWarranty(submittedLookupSerial ?? ''),
        enabled: submittedLookupSerial !== null,
        retry: false,
    });
    const clientsQuery = useQuery({
        queryKey: ['clients', 'warranty-filters'],
        queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }),
    });
    const productsQuery = useQuery({
        queryKey: ['catalog', 'products', 'warranty-filters'],
        queryFn: () => listProducts({ per_page: 100, sort: 'name', direction: 'asc', active: '' }),
    });
    const updateFilters = (next: Partial<WarrantyFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Warranty>[] = [
        {
            id: 'serial',
            header: 'Warranty / serial',
            cell: (warranty) => (
                <div>
                    <Link className="font-semibold text-foreground hover:text-primary" to={`/admin/warranties/${warranty.uuid}`}>
                        {warranty.serial_number ?? 'No serial number'}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">{warranty.uuid}</p>
                </div>
            ),
        },
        {
            id: 'client',
            header: 'Client',
            cell: (warranty) => <span className="text-foreground/80">{warranty.client?.display_name ?? 'Unknown client'}</span>,
        },
        {
            id: 'product',
            header: 'Product',
            cell: (warranty) => (
                <div className="text-foreground/80">
                    <p>{warranty.product?.name ?? 'Unknown product'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {warranty.product?.sku ?? '—'} · {warranty.product?.model ?? '—'}
                    </p>
                </div>
            ),
        },
        {
            id: 'coverage',
            header: 'Coverage',
            cell: (warranty) => (
                <span className="text-muted-foreground">
                    {formatDateOnly(warranty.starts_at)}
                    <br />
                    {formatDateOnly(warranty.expires_at)}
                </span>
            ),
        },
        { id: 'status', header: 'Status', cell: (warranty) => <StatusBadge value={warranty.status} /> },
        {
            id: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (warranty) => (
                <Link className="font-medium text-primary hover:underline" to={`/admin/warranties/${warranty.uuid}`}>
                    View
                </Link>
            ),
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader
                title="Warranties"
                description="Verify coverage for individual sold products and manage warranty lifecycle decisions."
            />
            <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <form
                    className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setSubmittedLookupSerial(lookupSerial.trim() || null);
                    }}
                >
                    <FormField label="Serial number">
                        <Input
                            id="serial-lookup"
                            placeholder="Look up a serial number"
                            value={lookupSerial}
                            onChange={(event) => setLookupSerial(event.target.value)}
                        />
                    </FormField>
                    <Button type="submit" disabled={lookupSerial.trim().length === 0}>
                        Check warranty
                    </Button>
                </form>
                {lookupQuery.isFetching && (
                    <p className="mt-3 text-sm text-muted-foreground" role="status">
                        Looking up warranty...
                    </p>
                )}
                {lookupQuery.data && (
                    <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-semibold text-foreground">
                                {lookupQuery.data.warranty.product?.name ?? 'Product'} · {lookupQuery.data.warranty.serial_number}
                            </p>
                            <p className="mt-1 text-muted-foreground">{lookupQuery.data.eligibility.reason}</p>
                        </div>
                        <Link
                            className="font-medium text-primary hover:underline"
                            to={`/admin/warranties/${lookupQuery.data.warranty.uuid}`}
                        >
                            View warranty
                        </Link>
                    </div>
                )}
                {submittedLookupSerial !== null && lookupQuery.error && <ErrorMessage error={lookupQuery.error} />}
            </section>
            <div className="grid gap-4 rounded-xl border border-border bg-muted/35 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <FormField label="Search">
                    <Input
                        placeholder="Serial, client, or product"
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
                <FormField label="Product">
                    <Select
                        value={filters.product_id ?? ''}
                        onChange={(event) => updateFilters({ product_id: event.target.value === '' ? '' : Number(event.target.value) })}
                    >
                        <option value="">All products</option>
                        {productsQuery.data?.data.map((product) => (
                            <option key={product.id} value={product.id}>
                                {product.name} · {product.sku}
                            </option>
                        ))}
                    </Select>
                </FormField>
                <FormField label="Status">
                    <Select
                        value={filters.status ?? ''}
                        onChange={(event) =>
                            updateFilters({ status: event.target.value === '' ? '' : (event.target.value as WarrantyStatus) })
                        }
                    >
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="void">Void</option>
                        <option value="replaced">Replaced</option>
                    </Select>
                </FormField>
            </div>
            <ErrorMessage error={clientsQuery.error ?? productsQuery.error} />
            {warrantiesQuery.isLoading ? (
                <TableSkeleton columns={6} />
            ) : warrantiesQuery.error ? (
                <ErrorState
                    description={getApiErrorMessage(warrantiesQuery.error, 'Unable to load warranties.') ?? 'Unable to load warranties.'}
                    onRetry={() => void warrantiesQuery.refetch()}
                />
            ) : (
                <>
                    <DataTable
                        ariaLabel="Warranties"
                        rows={warrantiesQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(warranty) => warranty.uuid}
                        emptyMessage="No warranties match these filters."
                    />
                    {warrantiesQuery.data && (
                        <Pagination
                            meta={warrantiesQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}
        </section>
    );
}

export function WarrantyDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const queryClient = useQueryClient();
    const warrantyQuery = useQuery({ queryKey: ['warranties', uuid], queryFn: () => getWarranty(uuid ?? ''), enabled: uuid !== undefined });
    const eligibilityQuery = useQuery({
        queryKey: ['warranties', uuid, 'eligibility'],
        queryFn: () => getWarrantyEligibility(uuid ?? ''),
        enabled: uuid !== undefined,
    });
    const form = useForm<WarrantyUpdateFormValues>({
        resolver: zodResolver(warrantyUpdateSchema),
        defaultValues: { status: 'void', void_reason: '', notes: '' },
    });

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
            form.reset({
                status: warranty.status === 'replaced' ? 'replaced' : 'void',
                void_reason: warranty.void_reason ?? '',
                notes: warranty.notes ?? '',
            });
        },
    });
    const warranty = warrantyQuery.data;

    if (warrantyQuery.isLoading) return <PageSkeleton />;
    if (!warranty)
        return (
            <ErrorState
                title="Warranty unavailable"
                description={
                    getApiErrorMessage(warrantyQuery.error, 'The requested warranty could not be found.') ??
                    'The requested warranty could not be found.'
                }
                onRetry={() => void warrantyQuery.refetch()}
            />
        );

    return (
        <section className="max-w-5xl space-y-6">
            <PageHeader
                title={warranty.serial_number ?? 'Warranty record'}
                description={`${warranty.product?.name ?? 'Product'} · ${warranty.client?.display_name ?? 'Client'}`}
                actions={<StatusBadge value={warranty.status} />}
            />
            <EligibilityCard eligibility={eligibilityQuery.data} isLoading={eligibilityQuery.isLoading} error={eligibilityQuery.error} />
            <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 md:grid-cols-2 lg:grid-cols-3">
                <Detail label="Warranty UUID" value={warranty.uuid} />
                <Detail label="Status" value={<StatusBadge value={warranty.status} />} />
                <Detail label="Serial number" value={warranty.serial_number ?? 'Not recorded'} />
                <Detail label="Client" value={warranty.client?.display_name ?? '—'} />
                <Detail label="Product" value={warranty.product ? `${warranty.product.name} (${warranty.product.model})` : '—'} />
                <Detail label="SKU" value={warranty.product?.sku ?? '—'} />
                <Detail label="Starts" value={formatDateOnly(warranty.starts_at)} />
                <Detail label="Expires" value={formatDateOnly(warranty.expires_at)} />
                <Detail label="Invoice" value={warranty.invoice_item?.invoice_number ?? 'Legacy purchase'} />
                <Detail label="Void reason" value={warranty.void_reason ?? '—'} />
                <Detail label="Created" value={formatDate(warranty.created_at)} />
                <div className="md:col-span-2 lg:col-span-3">
                    <Detail label="Notes" value={<p className="whitespace-pre-wrap">{warranty.notes ?? 'No notes.'}</p>} />
                </div>
            </section>
            {!['void', 'replaced'].includes(warranty.status) && (
                <Can permission="warranties.manage">
                    <WarrantyManagementForm form={form} mutation={updateMutation} />
                </Can>
            )}
        </section>
    );
}

export function ClientWarrantyHistory({ clientUuid }: { clientUuid: string }) {
    const warrantiesQuery = useQuery({
        queryKey: ['clients', clientUuid, 'warranties'],
        queryFn: () => listClientWarranties(clientUuid, { per_page: 20, sort: 'expires_at', direction: 'asc' }),
    });

    return (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">Warranty history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                All product warranties, including active, expired, void, and replaced coverage.
            </p>
            {warrantiesQuery.isLoading ? (
                <div className="mt-4">
                    <TableSkeleton rows={3} columns={4} />
                </div>
            ) : warrantiesQuery.error ? (
                <ErrorState
                    className="mt-4"
                    description={
                        getApiErrorMessage(warrantiesQuery.error, 'Unable to load warranty history.') ?? 'Unable to load warranty history.'
                    }
                    onRetry={() => void warrantiesQuery.refetch()}
                />
            ) : warrantiesQuery.data?.data.length === 0 ? (
                <EmptyState
                    className="mt-4 rounded-lg border border-dashed border-border"
                    compact
                    title="No warranties yet"
                    description="No warranties are registered for this client."
                />
            ) : (
                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <caption className="sr-only">Warranty history for this client</caption>
                        <thead className="border-b border-border text-left text-muted-foreground">
                            <tr>
                                <th scope="col" className="pb-2 font-semibold">
                                    Product
                                </th>
                                <th scope="col" className="pb-2 font-semibold">
                                    Serial
                                </th>
                                <th scope="col" className="pb-2 font-semibold">
                                    Expires
                                </th>
                                <th scope="col" className="pb-2 font-semibold">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {warrantiesQuery.data?.data.map((warranty) => (
                                <tr key={warranty.uuid}>
                                    <td className="py-3">
                                        <Link
                                            className="font-medium text-primary hover:underline"
                                            to={`/admin/warranties/${warranty.uuid}`}
                                        >
                                            {warranty.product?.name ?? 'Unknown product'}
                                        </Link>
                                    </td>
                                    <td className="py-3 text-muted-foreground">{warranty.serial_number ?? '—'}</td>
                                    <td className="py-3 text-muted-foreground">{formatDateOnly(warranty.expires_at)}</td>
                                    <td className="py-3">
                                        <StatusBadge value={warranty.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function EligibilityCard({ eligibility, isLoading, error }: { eligibility?: WarrantyEligibility; isLoading: boolean; error: unknown }) {
    if (isLoading) {
        return (
            <div className="space-y-3 rounded-xl border border-border bg-card p-5" role="status" aria-label="Checking warranty eligibility">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-full max-w-lg" />
                <Skeleton className="h-4 w-72" />
            </div>
        );
    }
    if (!eligibility)
        return (
            <ErrorState
                title="Eligibility unavailable"
                description={
                    getApiErrorMessage(error, 'Warranty eligibility could not be checked.') ?? 'Warranty eligibility could not be checked.'
                }
            />
        );

    return (
        <section
            className={`rounded-xl border p-5 ${
                eligibility.is_under_warranty
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
            }`}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-semibold text-foreground">
                        {eligibility.is_under_warranty ? 'Product is under warranty' : 'Product is not under warranty'}
                    </h2>
                    <p className="mt-1 text-sm text-foreground/80">{eligibility.reason}</p>
                </div>
                <StatusBadge value={eligibility.status} />
            </div>
            <p className="mt-3 text-sm text-foreground/80">
                Coverage: {formatDateOnly(eligibility.starts_at)} to {formatDateOnly(eligibility.expires_at)} · {eligibility.remaining_days}{' '}
                day{eligibility.remaining_days === 1 ? '' : 's'} remaining
            </p>
        </section>
    );
}

function WarrantyManagementForm({
    form,
    mutation,
}: {
    form: ReturnType<typeof useForm<WarrantyUpdateFormValues>>;
    mutation: ReturnType<typeof useMutation<Warranty, Error, WarrantyUpdateFormValues>>;
}) {
    const status = form.watch('status');
    const [pendingDecision, setPendingDecision] = useState<WarrantyUpdateFormValues | null>(null);
    const isVoidDecision = pendingDecision?.status === 'void';

    return (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">Manage warranty</h2>
            <p className="mt-1 text-sm text-foreground/80">
                Void or mark this warranty as replaced. These lifecycle decisions cannot be reversed.
            </p>
            <form className="mt-4 space-y-4" onSubmit={form.handleSubmit((values) => setPendingDecision(values))}>
                <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="New status" required error={form.formState.errors.status?.message}>
                        <Select {...form.register('status')}>
                            <option value="void">Void warranty</option>
                            <option value="replaced">Mark as replaced</option>
                        </Select>
                    </FormField>
                    {status === 'void' && (
                        <FormField label="Void reason" required error={form.formState.errors.void_reason?.message}>
                            <Input {...form.register('void_reason')} />
                        </FormField>
                    )}
                </div>
                <FormField label="Notes (optional)" error={form.formState.errors.notes?.message}>
                    <Textarea rows={3} {...form.register('notes')} />
                </FormField>
                <ErrorMessage error={mutation.error} />
                <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                    {mutation.isPending ? 'Saving...' : 'Save warranty decision'}
                </Button>
            </form>
            <ConfirmDialog
                open={pendingDecision !== null}
                title={isVoidDecision ? 'Void warranty' : 'Mark warranty as replaced'}
                description={
                    isVoidDecision
                        ? 'Void this warranty? Coverage will end immediately and this decision cannot be reversed.'
                        : 'Mark this warranty as replaced? This lifecycle decision cannot be reversed.'
                }
                confirmLabel={isVoidDecision ? 'Void warranty' : 'Mark as replaced'}
                isPending={mutation.isPending}
                onCancel={() => setPendingDecision(null)}
                onConfirm={() => {
                    if (!pendingDecision) return;
                    mutation.mutate(pendingDecision, { onSuccess: () => setPendingDecision(null) });
                }}
            />
        </section>
    );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1 break-words text-sm text-foreground">{value}</div>
        </div>
    );
}
