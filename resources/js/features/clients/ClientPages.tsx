import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiErrorAlert as ErrorMessage, getApiErrorMessage } from '@/components/ApiErrorAlert';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FormField } from '@/components/FormField';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { ErrorState, PageSkeleton, TableSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { archiveClient, createClient, getClient, getClientProfile, listClients, updateClient } from '@/features/clients/api';
import type { Client, ClientFilters, ClientPayload, ClientProfile, ClientType, ClientWarranty } from '@/features/clients/types';
import { ClientInvoiceHistory } from '@/features/invoices/InvoicePages';
import { ClientWarrantyHistory } from '@/features/warranties/WarrantyPages';
import { Can } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

export const clientSchema = z
    .object({
        type: z.enum(['individual', 'company']),
        company_name: z.string().trim().max(255),
        first_name: z.string().trim().min(1, 'First name is required.').max(100),
        last_name: z.string().trim().min(1, 'Last name is required.').max(100),
        email: z.string().trim().email('Enter a valid email address.').or(z.literal('')),
        phone: z.string().trim().min(1, 'Phone is required.').max(30),
        address: z.string().trim().max(1000),
        city: z.string().trim().max(100),
        tax_identifier: z.string().trim().max(100),
        notes: z.string().max(5000),
    })
    .superRefine((values, context) => {
        if (values.type === 'company' && values.company_name.length === 0) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['company_name'], message: 'Company name is required.' });
        }

        if (values.type === 'company' && values.tax_identifier.length === 0) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['tax_identifier'], message: 'Tax identifier is required.' });
        }
    });

type ClientFormValues = z.infer<typeof clientSchema>;

export function ClientsPage() {
    const [filters, setFilters] = useState<ClientFilters>({ per_page: 10, sort: 'created_at', direction: 'desc' });
    const [archiveTarget, setArchiveTarget] = useState<Client | null>(null);
    const queryClient = useQueryClient();
    const clientsQuery = useQuery({ queryKey: ['clients', filters], queryFn: () => listClients(filters) });
    const archiveMutation = useMutation({
        mutationFn: archiveClient,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['clients'] });
            setArchiveTarget(null);
        },
    });

    const updateFilters = (next: Partial<ClientFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));
    const columns: DataTableColumn<Client>[] = [
        {
            id: 'client',
            header: 'Client',
            cell: (client) => (
                <div className="min-w-52">
                    <Link className="font-semibold text-foreground hover:text-primary hover:underline" to={`/admin/clients/${client.uuid}`}>
                        {client.display_name}
                    </Link>
                    <p className="mt-0.5 text-muted-foreground">
                        {client.type === 'company' ? `${client.first_name} ${client.last_name}` : (client.email ?? 'No email')}
                    </p>
                </div>
            ),
        },
        { id: 'type', header: 'Type', cell: (client) => <StatusBadge value={client.type} /> },
        {
            id: 'contact',
            header: 'Contact',
            cell: (client) => (
                <div className="min-w-48 text-muted-foreground">
                    <p>{client.email ?? 'No email'}</p>
                    <p className="mt-0.5">{client.phone}</p>
                </div>
            ),
        },
        { id: 'city', header: 'City', cell: (client) => <span className="text-muted-foreground">{client.city ?? '—'}</span> },
        {
            id: 'created',
            header: 'Created',
            cell: (client) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(client.created_at)}</span>,
        },
        {
            id: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (client) => (
                <div className="flex min-w-max flex-wrap justify-end gap-1">
                    <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/clients/${client.uuid}`}>
                        View
                    </Link>
                    <Can permission="clients.update">
                        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/clients/${client.uuid}/edit`}>
                            Edit
                        </Link>
                    </Can>
                    <Can permission="clients.delete">
                        <Button
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            variant="ghost"
                            size="sm"
                            onClick={() => setArchiveTarget(client)}
                        >
                            Archive
                        </Button>
                    </Can>
                </div>
            ),
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader
                title="Clients"
                description="Manage customer contact details, purchase history, warranties, and SAV activity."
                actions={
                    <Can permission="clients.create">
                        <Link className={buttonVariants()} to="/admin/clients/new">
                            Add client
                        </Link>
                    </Can>
                }
            />

            <Card className="grid gap-3 bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <label>
                    <span className="sr-only">Search clients</span>
                    <Input
                        type="search"
                        placeholder="Search name, company, email, or phone..."
                        value={filters.search ?? ''}
                        onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                    />
                </label>
                <label>
                    <span className="sr-only">Filter by client type</span>
                    <Select
                        value={filters.type ?? ''}
                        onChange={(event) =>
                            updateFilters({ type: event.target.value === '' ? undefined : (event.target.value as ClientType) })
                        }
                    >
                        <option value="">All client types</option>
                        <option value="individual">Individual</option>
                        <option value="company">Company</option>
                    </Select>
                </label>
                <label className="sm:col-span-2 lg:col-span-1">
                    <span className="sr-only">Sort clients</span>
                    <Select
                        value={filters.sort ?? 'created_at'}
                        onChange={(event) => updateFilters({ sort: event.target.value as NonNullable<ClientFilters['sort']> })}
                    >
                        <option value="created_at">Newest first</option>
                        <option value="first_name">First name</option>
                        <option value="last_name">Last name</option>
                        <option value="company_name">Company name</option>
                        <option value="city">City</option>
                    </Select>
                </label>
            </Card>

            {clientsQuery.isLoading ? (
                <TableSkeleton rows={6} columns={6} />
            ) : clientsQuery.error ? (
                <ErrorState
                    title="Unable to load clients"
                    description={
                        getApiErrorMessage(clientsQuery.error, 'The client list could not be loaded.') ??
                        'The client list could not be loaded.'
                    }
                    onRetry={() => void clientsQuery.refetch()}
                />
            ) : (
                <>
                    <DataTable
                        rows={clientsQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(client) => client.uuid}
                        ariaLabel="Clients"
                        emptyMessage="No clients match these filters."
                        emptyDescription="Try changing or clearing one of the filters above."
                    />
                    {clientsQuery.data && (
                        <Pagination
                            meta={clientsQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}

            <ConfirmDialog
                open={archiveTarget !== null}
                title="Archive client"
                description={`Archive ${archiveTarget?.display_name ?? 'this client'}? Their historical purchases and support records remain available to authorized staff.`}
                confirmLabel="Archive client"
                isPending={archiveMutation.isPending}
                onCancel={() => setArchiveTarget(null)}
                onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.uuid)}
            />
        </section>
    );
}

export function ClientFormPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const isEditing = uuid !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const clientQuery = useQuery({ queryKey: ['clients', uuid], queryFn: () => getClient(uuid ?? ''), enabled: isEditing });
    const form = useForm<ClientFormValues>({
        resolver: zodResolver(clientSchema),
        defaultValues: {
            type: 'individual',
            company_name: '',
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            tax_identifier: '',
            notes: '',
        },
    });
    const clientType = form.watch('type');

    useEffect(() => {
        if (!clientQuery.data) return;

        form.reset({
            type: clientQuery.data.type,
            company_name: clientQuery.data.company_name ?? '',
            first_name: clientQuery.data.first_name,
            last_name: clientQuery.data.last_name,
            email: clientQuery.data.email ?? '',
            phone: clientQuery.data.phone,
            address: clientQuery.data.address ?? '',
            city: clientQuery.data.city ?? '',
            tax_identifier: clientQuery.data.tax_identifier ?? '',
            notes: clientQuery.data.notes ?? '',
        });
    }, [clientQuery.data, form]);

    const saveMutation = useMutation({
        mutationFn: (values: ClientFormValues) => {
            const payload: ClientPayload = {
                ...values,
                company_name: values.type === 'company' ? values.company_name || null : null,
                tax_identifier: values.type === 'company' ? values.tax_identifier || null : null,
                email: values.email || null,
                address: values.address || null,
                city: values.city || null,
                notes: values.notes || null,
            };

            return isEditing ? updateClient(uuid ?? '', payload) : createClient(payload);
        },
        onSuccess: (client) => {
            void queryClient.invalidateQueries({ queryKey: ['clients'] });
            navigate(`/admin/clients/${client.uuid}`);
        },
    });

    const setType = (type: ClientType) => {
        form.setValue('type', type, { shouldValidate: true });
        if (type === 'individual') {
            form.setValue('company_name', '');
            form.setValue('tax_identifier', '');
        }
    };

    if (isEditing && clientQuery.isLoading) return <PageSkeleton />;
    if (isEditing && !clientQuery.data && clientQuery.error) {
        return (
            <ErrorState
                title="Unable to load client"
                description={getApiErrorMessage(clientQuery.error, 'The client could not be loaded.') ?? 'The client could not be loaded.'}
                onRetry={() => void clientQuery.refetch()}
            />
        );
    }

    return (
        <section className="max-w-3xl space-y-6">
            <PageHeader
                title={isEditing ? 'Edit client' : 'Add client'}
                description={
                    isEditing ? 'Update client identity and contact information.' : 'Create an individual or company client record.'
                }
            />
            <form
                className="space-y-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
                onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <FormField required label="Client type" error={form.formState.errors.type?.message}>
                        <Select required value={clientType} onChange={(event) => setType(event.target.value as ClientType)}>
                            <option value="individual">Individual</option>
                            <option value="company">Company</option>
                        </Select>
                    </FormField>
                    <FormField required label="Phone" error={form.formState.errors.phone?.message}>
                        <Input required type="tel" autoComplete="tel" {...form.register('phone')} />
                    </FormField>
                </div>

                {clientType === 'company' && (
                    <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 md:grid-cols-2">
                        <FormField required label="Company name" error={form.formState.errors.company_name?.message}>
                            <Input required autoComplete="organization" {...form.register('company_name')} />
                        </FormField>
                        <FormField required label="Tax identifier" error={form.formState.errors.tax_identifier?.message}>
                            <Input required {...form.register('tax_identifier')} />
                        </FormField>
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <FormField required label="First name" error={form.formState.errors.first_name?.message}>
                        <Input required autoComplete="given-name" {...form.register('first_name')} />
                    </FormField>
                    <FormField required label="Last name" error={form.formState.errors.last_name?.message}>
                        <Input required autoComplete="family-name" {...form.register('last_name')} />
                    </FormField>
                    <FormField label="Email" error={form.formState.errors.email?.message}>
                        <Input type="email" autoComplete="email" {...form.register('email')} />
                    </FormField>
                    <FormField label="City" error={form.formState.errors.city?.message}>
                        <Input autoComplete="address-level2" {...form.register('city')} />
                    </FormField>
                </div>

                <FormField label="Address" error={form.formState.errors.address?.message}>
                    <Textarea rows={3} autoComplete="street-address" {...form.register('address')} />
                </FormField>
                <FormField label="Notes" error={form.formState.errors.notes?.message}>
                    <Textarea rows={5} {...form.register('notes')} />
                </FormField>
                <ErrorMessage error={saveMutation.error} />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link className={buttonVariants({ variant: 'outline' })} to={isEditing ? `/admin/clients/${uuid}` : '/admin/clients'}>
                        Cancel
                    </Link>
                    <Button type="submit" disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? 'Saving...' : 'Save client'}
                    </Button>
                </div>
            </form>
        </section>
    );
}

export function ClientDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const profileQuery = useQuery({
        queryKey: ['clients', uuid, 'profile'],
        queryFn: () => getClientProfile(uuid ?? ''),
        enabled: uuid !== undefined,
    });
    const profile = profileQuery.data;

    if (profileQuery.isLoading) return <PageSkeleton />;
    if (!profile) {
        return (
            <ErrorState
                title="Client unavailable"
                description={
                    getApiErrorMessage(profileQuery.error, 'The requested client could not be found.') ??
                    'The requested client could not be found.'
                }
                onRetry={() => void profileQuery.refetch()}
            />
        );
    }

    return (
        <section className="space-y-6">
            <PageHeader
                title={profile.client.display_name}
                description={`${profile.client.type === 'company' ? 'Company' : 'Individual'} client profile and SAV history.`}
                actions={
                    <Can permission="clients.update">
                        <Link className={buttonVariants()} to={`/admin/clients/${profile.client.uuid}/edit`}>
                            Edit client
                        </Link>
                    </Can>
                }
            />

            <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2 lg:grid-cols-3">
                <Detail label="Type" value={<StatusBadge value={profile.client.type} />} />
                {profile.client.type === 'company' && <Detail label="Company" value={profile.client.company_name ?? '—'} />}
                {profile.client.type === 'company' && <Detail label="Tax identifier" value={profile.client.tax_identifier ?? '—'} />}
                <Detail label="Contact person" value={`${profile.client.first_name} ${profile.client.last_name}`} />
                <Detail label="Email" value={profile.client.email ?? '—'} />
                <Detail label="Phone" value={profile.client.phone} />
                <Detail label="City" value={profile.client.city ?? '—'} />
                <Detail label="Address" value={profile.client.address ?? '—'} />
                <Detail label="Client since" value={formatDate(profile.client.created_at)} />
                <div className="md:col-span-2 lg:col-span-3">
                    <Detail label="Notes" value={<p className="whitespace-pre-wrap">{profile.client.notes ?? 'No notes.'}</p>} />
                </div>
            </Card>

            <WarrantySection
                title="Purchased products"
                description="Products registered to this client, including serial and purchase dates."
                warranties={profile.purchased_products}
            />
            <div className="grid gap-6 xl:grid-cols-2">
                <WarrantySection
                    title="Active warranties"
                    description="Warranty coverage currently valid."
                    warranties={profile.active_warranties}
                    tone="active"
                />
                <WarrantySection
                    title="Expired warranties"
                    description="Warranty coverage that has ended."
                    warranties={profile.expired_warranties}
                    tone="expired"
                />
            </div>
            <Can permission="invoices.view">
                <ClientInvoiceHistory clientUuid={profile.client.uuid} />
            </Can>
            <Can permission="warranties.view">
                <ClientWarrantyHistory clientUuid={profile.client.uuid} />
            </Can>
            <TicketSection tickets={profile.tickets} />
            <RepairSection profile={profile} />
        </section>
    );
}

function WarrantySection({
    title,
    description,
    warranties,
    tone,
}: {
    title: string;
    description: string;
    warranties: ClientWarranty[];
    tone?: 'active' | 'expired';
}) {
    const columns: DataTableColumn<ClientWarranty>[] = [
        {
            id: 'product',
            header: 'Product',
            cell: (warranty) => (
                <span className="min-w-52 font-medium text-foreground">
                    {warranty.product ? `${warranty.product.name} (${warranty.product.model})` : 'Unknown product'}
                </span>
            ),
        },
        {
            id: 'serial',
            header: 'Serial number',
            cell: (warranty) => <span className="text-muted-foreground">{warranty.serial_number ?? '—'}</span>,
        },
        { id: 'quantity', header: 'Quantity', cell: (warranty) => <span className="text-muted-foreground">{warranty.quantity}</span> },
        {
            id: 'purchased',
            header: 'Purchased',
            cell: (warranty) => <span className="whitespace-nowrap text-muted-foreground">{formatDateOnly(warranty.purchase_date)}</span>,
        },
        {
            id: 'warranty-end',
            header: 'Warranty end',
            cell: (warranty) => <span className="whitespace-nowrap text-muted-foreground">{formatDateOnly(warranty.warranty_end)}</span>,
        },
    ];

    return (
        <Card>
            <CardHeader>
                <SectionHeader title={title} description={description} actions={tone ? <StatusBadge value={tone} /> : undefined} />
            </CardHeader>
            <CardContent>
                <DataTable
                    className="shadow-none"
                    rows={warranties}
                    columns={columns}
                    getRowKey={(warranty) => warranty.id}
                    ariaLabel={title}
                    emptyMessage="No records available."
                    emptyDescription="No purchases or warranties are recorded in this category."
                />
            </CardContent>
        </Card>
    );
}

function TicketSection({ tickets }: { tickets: ClientProfile['tickets'] }) {
    type ClientTicket = ClientProfile['tickets'][number];
    const columns: DataTableColumn<ClientTicket>[] = [
        {
            id: 'ticket',
            header: 'Ticket',
            cell: (ticket) => (
                <div className="min-w-72 max-w-xl">
                    <p className="font-medium text-foreground">{ticket.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ticket.ticket_number}</p>
                    <p className="mt-0.5 truncate text-muted-foreground" title={ticket.problem_description}>
                        {ticket.problem_description}
                    </p>
                </div>
            ),
        },
        { id: 'status', header: 'Status', cell: (ticket) => <StatusBadge value={ticket.status} /> },
        {
            id: 'received',
            header: 'Received',
            cell: (ticket) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(ticket.received_at)}</span>,
        },
        {
            id: 'closed',
            header: 'Closed',
            cell: (ticket) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(ticket.closed_at)}</span>,
        },
    ];

    return (
        <Card>
            <CardHeader>
                <SectionHeader title="SAV ticket history" description="All support tickets opened for this client." />
            </CardHeader>
            <CardContent>
                <DataTable
                    className="shadow-none"
                    rows={tickets}
                    columns={columns}
                    getRowKey={(ticket) => ticket.uuid}
                    ariaLabel="SAV ticket history"
                    emptyMessage="No SAV tickets have been opened."
                    emptyDescription="New client tickets will appear here."
                />
            </CardContent>
        </Card>
    );
}

function RepairSection({ profile }: { profile: ClientProfile }) {
    type ClientRepair = ClientProfile['repair_history'][number];
    const columns: DataTableColumn<ClientRepair>[] = [
        {
            id: 'ticket',
            header: 'Ticket',
            cell: (repair) => <span className="min-w-40 font-medium text-foreground">{repair.ticket?.title ?? '—'}</span>,
        },
        { id: 'diagnostic', header: 'Diagnostic', cell: (repair) => <span className="text-muted-foreground">{repair.diagnostic}</span> },
        { id: 'solution', header: 'Solution', cell: (repair) => <span className="text-muted-foreground">{repair.solution ?? '—'}</span> },
        {
            id: 'labor',
            header: 'Labor',
            cell: (repair) => <span className="whitespace-nowrap text-muted-foreground">{formatCurrency(repair.labor_cost)}</span>,
        },
        {
            id: 'recorded',
            header: 'Recorded',
            cell: (repair) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(repair.created_at)}</span>,
        },
    ];

    return (
        <Card>
            <CardHeader>
                <SectionHeader title="Repair history" description="Completed and recorded technical interventions linked to SAV tickets." />
            </CardHeader>
            <CardContent>
                <DataTable
                    className="shadow-none"
                    rows={profile.repair_history}
                    columns={columns}
                    getRowKey={(repair) => repair.id}
                    ariaLabel="Repair history"
                    emptyMessage="No repair interventions have been recorded."
                    emptyDescription="Completed repair work linked to this client will appear here."
                />
            </CardContent>
        </Card>
    );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1 break-words text-sm text-foreground">{value}</div>
        </div>
    );
}

function formatDateOnly(value: string | null): string {
    if (!value) return '—';

    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

function formatCurrency(value: number | string): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';

    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'MAD' }).format(amount);
}
