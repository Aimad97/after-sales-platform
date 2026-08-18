import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ApiErrorAlert as ErrorMessage, getApiErrorMessage } from '@/components/ApiErrorAlert';
import { AttachmentPanel } from '@/components/AttachmentPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, PageSkeleton, TableSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { listProducts } from '@/features/catalog/api';
import { listClients } from '@/features/clients/api';
import { listTechnicians } from '@/features/technicians/api';
import { listWarranties } from '@/features/warranties/api';
import { startDiagnosis } from '@/features/repairs/api';
import {
    assignTicketTechnician,
    cancelTicket,
    changeTicketPriority,
    createTicket,
    getTicket,
    listTickets,
    transitionTicket,
    updateTicket,
} from '@/features/tickets/api';
import type {
    Ticket,
    TicketFilters,
    TicketPayload,
    TicketPriority,
    TicketSource,
    TicketStatus,
    TicketUpdatePayload,
} from '@/features/tickets/types';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { useTicketRealtime } from '@/hooks/useRealtime';
import { formatDate, humanize } from '@/utils/format';

export const ticketSchema = z.object({
    client_id: z.coerce.number().int().positive('Choose a client.'),
    product_id: z.coerce.number().int().positive('Choose a product.'),
    warranty_id: z.number().int().positive().nullable(),
    title: z.string().trim().min(3, 'Enter a meaningful title.').max(255),
    problem_description: z.string().trim().min(3, 'Describe the problem.').max(10_000),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    source: z.enum(['store', 'phone', 'email', 'web']),
});

const ticketUpdateSchema = z.object({
    title: z.string().trim().min(3).max(255),
    problem_description: z.string().trim().min(3).max(10_000),
    source: z.enum(['store', 'phone', 'email', 'web']),
});

type TicketFormValues = z.infer<typeof ticketSchema>;
type TicketEditValues = z.infer<typeof ticketUpdateSchema>;

const transitions: Record<TicketStatus, TicketStatus[]> = {
    opened: ['received'],
    received: ['awaiting_diagnosis'],
    awaiting_diagnosis: ['diagnosing'],
    diagnosing: ['awaiting_customer_approval', 'awaiting_part', 'repairing'],
    awaiting_customer_approval: ['diagnosing'],
    awaiting_part: ['repairing'],
    repairing: ['testing'],
    testing: ['repaired'],
    repaired: ['ready_for_pickup'],
    ready_for_pickup: ['delivered'],
    delivered: ['closed'],
    closed: [],
    cancelled: [],
};

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1 break-words text-sm text-foreground">{value}</div>
        </div>
    );
}

export function TicketsPage() {
    const [filters, setFilters] = useState<TicketFilters>({ per_page: 10, sort: 'received_at', direction: 'desc' });
    const ticketsQuery = useQuery({ queryKey: ['tickets', filters], queryFn: () => listTickets(filters) });
    const clientsQuery = useQuery({
        queryKey: ['clients', 'ticket-filters'],
        queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }),
    });
    const techniciansQuery = useQuery({
        queryKey: ['technicians', 'ticket-filters'],
        queryFn: () => listTechnicians({ per_page: 100, sort: 'employee_code', direction: 'asc' }),
    });
    const updateFilters = (next: Partial<TicketFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Ticket>[] = [
        {
            id: 'ticket',
            header: 'Ticket',
            cell: (ticket) => (
                <div>
                    <Link className="font-semibold text-foreground hover:text-primary" to={`/admin/tickets/${ticket.uuid}`}>
                        {ticket.ticket_number}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ticket.title}</p>
                </div>
            ),
        },
        {
            id: 'client',
            header: 'Client',
            cell: (ticket) => <span className="text-foreground/80">{ticket.client?.display_name ?? 'Unknown client'}</span>,
        },
        {
            id: 'product',
            header: 'Product',
            cell: (ticket) => (
                <div className="text-foreground/80">
                    <p>{ticket.product?.name ?? 'Unknown product'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ticket.warranty?.serial_number ?? ticket.product?.sku ?? '—'}</p>
                </div>
            ),
        },
        { id: 'priority', header: 'Priority', cell: (ticket) => <StatusBadge value={ticket.priority} /> },
        { id: 'status', header: 'Status', cell: (ticket) => <StatusBadge value={ticket.status} /> },
        {
            id: 'technician',
            header: 'Technician',
            cell: (ticket) => <span className="text-foreground/80">{ticket.assigned_technician?.user?.display_name ?? 'Unassigned'}</span>,
        },
        {
            id: 'received',
            header: 'Received',
            cell: (ticket) => <span className="text-muted-foreground">{formatDate(ticket.received_at)}</span>,
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader
                title="SAV tickets"
                description="Manage product support requests through a controlled repair workflow."
                actions={
                    <Can permission="tickets.create">
                        <Link className={buttonVariants()} to="/admin/tickets/new">
                            Create ticket
                        </Link>
                    </Can>
                }
            />
            <div className="grid gap-4 rounded-xl border border-border bg-muted/35 p-4 sm:grid-cols-2 xl:grid-cols-5">
                <FormField label="Search">
                    <Input
                        placeholder="Ticket, client, or serial"
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
                <FormField label="Technician">
                    <Select
                        value={filters.assigned_technician_id ?? ''}
                        onChange={(event) =>
                            updateFilters({ assigned_technician_id: event.target.value === '' ? '' : Number(event.target.value) })
                        }
                    >
                        <option value="">All technicians</option>
                        {techniciansQuery.data?.data.map((technician) => (
                            <option key={technician.id} value={technician.id}>
                                {technician.user ? `${technician.user.first_name} ${technician.user.last_name}` : technician.employee_code}
                            </option>
                        ))}
                    </Select>
                </FormField>
                <FormField label="Status">
                    <Select
                        value={filters.status ?? ''}
                        onChange={(event) =>
                            updateFilters({ status: event.target.value === '' ? '' : (event.target.value as TicketStatus) })
                        }
                    >
                        <option value="">All statuses</option>
                        {Object.keys(transitions).map((status) => (
                            <option key={status} value={status}>
                                {humanize(status)}
                            </option>
                        ))}
                    </Select>
                </FormField>
                <FormField label="Priority">
                    <Select
                        value={filters.priority ?? ''}
                        onChange={(event) =>
                            updateFilters({ priority: event.target.value === '' ? '' : (event.target.value as TicketPriority) })
                        }
                    >
                        <option value="">All priorities</option>
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </Select>
                </FormField>
                <FormField label="Source">
                    <Select
                        value={filters.source ?? ''}
                        onChange={(event) =>
                            updateFilters({ source: event.target.value === '' ? '' : (event.target.value as TicketSource) })
                        }
                    >
                        <option value="">All sources</option>
                        <option value="store">Store</option>
                        <option value="phone">Phone</option>
                        <option value="email">Email</option>
                        <option value="web">Web</option>
                    </Select>
                </FormField>
                <FormField label="Warranty coverage">
                    <Select
                        value={
                            filters.warranty_eligible === '' || filters.warranty_eligible === undefined
                                ? ''
                                : String(filters.warranty_eligible)
                        }
                        onChange={(event) =>
                            updateFilters({ warranty_eligible: event.target.value === '' ? '' : event.target.value === 'true' })
                        }
                    >
                        <option value="">Any eligibility</option>
                        <option value="true">Under warranty</option>
                        <option value="false">Out of warranty</option>
                    </Select>
                </FormField>
                <FormField label="Received from">
                    <Input
                        type="date"
                        value={filters.received_from ?? ''}
                        onChange={(event) => updateFilters({ received_from: event.target.value || undefined })}
                    />
                </FormField>
                <FormField label="Received to">
                    <Input
                        type="date"
                        value={filters.received_to ?? ''}
                        onChange={(event) => updateFilters({ received_to: event.target.value || undefined })}
                    />
                </FormField>
            </div>
            <ErrorMessage error={clientsQuery.error ?? techniciansQuery.error} />
            {ticketsQuery.isLoading ? (
                <TableSkeleton columns={7} />
            ) : ticketsQuery.error ? (
                <ErrorState
                    description={getApiErrorMessage(ticketsQuery.error, 'Unable to load tickets.') ?? 'Unable to load tickets.'}
                    onRetry={() => void ticketsQuery.refetch()}
                />
            ) : (
                <>
                    <DataTable
                        ariaLabel="SAV tickets"
                        rows={ticketsQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(ticket) => ticket.uuid}
                        emptyMessage="No tickets match these filters."
                    />
                    {ticketsQuery.data && (
                        <Pagination
                            meta={ticketsQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}
        </section>
    );
}

export function TicketFormPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const form = useForm<TicketFormValues>({
        resolver: zodResolver(ticketSchema),
        defaultValues: {
            client_id: undefined,
            product_id: undefined,
            warranty_id: null,
            title: '',
            problem_description: '',
            priority: 'normal',
            source: 'web',
        },
    });
    const selectedClientId = form.watch('client_id');
    const selectedProductId = form.watch('product_id');
    const clientsQuery = useQuery({
        queryKey: ['clients', 'ticket-create'],
        queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }),
    });
    const productsQuery = useQuery({
        queryKey: ['catalog', 'products', 'ticket-create'],
        queryFn: () => listProducts({ per_page: 100, sort: 'name', direction: 'asc' }),
    });
    const warrantiesQuery = useQuery({
        queryKey: ['warranties', 'ticket-create', selectedClientId, selectedProductId],
        queryFn: () =>
            listWarranties({
                client_id: selectedClientId,
                product_id: selectedProductId,
                per_page: 100,
                sort: 'expires_at',
                direction: 'asc',
            }),
        enabled: Number.isInteger(selectedClientId) && Number.isInteger(selectedProductId),
    });
    const createMutation = useMutation({
        mutationFn: (values: TicketFormValues) => createTicket(values as TicketPayload),
        onSuccess: (ticket) => navigate(`/admin/tickets/${ticket.uuid}`),
    });
    const next = async () => {
        const fields =
            step === 1 ? (['client_id', 'product_id'] as const) : (['title', 'problem_description', 'priority', 'source'] as const);
        if (await form.trigger(fields)) setStep((current) => Math.min(3, current + 1));
    };

    return (
        <section className="mx-auto max-w-3xl space-y-6">
            <PageHeader
                title="Create SAV ticket"
                description="Capture the product issue, coverage context, and intake source."
                actions={
                    <Link className={buttonVariants({ variant: 'outline' })} to="/admin/tickets">
                        Back to tickets
                    </Link>
                }
            />
            <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Ticket creation progress">
                {[1, 2, 3].map((number) => (
                    <li
                        key={number}
                        aria-current={number === step ? 'step' : undefined}
                        className={`rounded-full px-3 py-1 font-semibold ${
                            number === step
                                ? 'bg-primary text-primary-foreground'
                                : number < step
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        Step {number}
                    </li>
                ))}
            </ol>
            <form
                className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
                onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
            >
                {step === 1 && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField label="Client" required error={form.formState.errors.client_id?.message}>
                            <Select
                                {...form.register('client_id')}
                                onChange={(event) => {
                                    form.setValue('client_id', Number(event.target.value));
                                    form.setValue('warranty_id', null);
                                }}
                            >
                                <option value="">Select a client</option>
                                {clientsQuery.data?.data.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.display_name}
                                    </option>
                                ))}
                            </Select>
                        </FormField>
                        <FormField label="Product" required error={form.formState.errors.product_id?.message}>
                            <Select
                                {...form.register('product_id')}
                                onChange={(event) => {
                                    form.setValue('product_id', Number(event.target.value));
                                    form.setValue('warranty_id', null);
                                }}
                            >
                                <option value="">Select a product</option>
                                {productsQuery.data?.data.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {product.name} · {product.sku}
                                        {product.active ? '' : ' (inactive)'}
                                    </option>
                                ))}
                            </Select>
                        </FormField>
                        {productsQuery.error && <ErrorMessage className="md:col-span-2" error={productsQuery.error} />}
                        <div className="md:col-span-2">
                            <FormField
                                label="Warranty (optional)"
                                hint="Only warranties belonging to the selected client and product are listed."
                                error={form.formState.errors.warranty_id?.message}
                            >
                                <Select
                                    value={form.watch('warranty_id') ?? ''}
                                    onChange={(event) =>
                                        form.setValue('warranty_id', event.target.value === '' ? null : Number(event.target.value), {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <option value="">No linked warranty</option>
                                    {warrantiesQuery.data?.data.map((warranty) => (
                                        <option key={warranty.id} value={warranty.id}>
                                            {warranty.serial_number ?? warranty.uuid} · {humanize(warranty.status)}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                        </div>
                    </div>
                )}
                {step === 2 && (
                    <div className="space-y-4">
                        <FormField label="Ticket title" required error={form.formState.errors.title?.message}>
                            <Input {...form.register('title')} />
                        </FormField>
                        <FormField label="Problem description" required error={form.formState.errors.problem_description?.message}>
                            <Textarea rows={7} {...form.register('problem_description')} />
                        </FormField>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField label="Priority" required error={form.formState.errors.priority?.message}>
                                <Select {...form.register('priority')}>
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </Select>
                            </FormField>
                            <FormField label="Source" required error={form.formState.errors.source?.message}>
                                <Select {...form.register('source')}>
                                    <option value="store">Store</option>
                                    <option value="phone">Phone</option>
                                    <option value="email">Email</option>
                                    <option value="web">Web</option>
                                </Select>
                            </FormField>
                        </div>
                    </div>
                )}
                {step === 3 && (
                    <div className="space-y-3 rounded-lg bg-muted/50 p-5 text-sm text-foreground">
                        <p className="font-semibold">Review ticket</p>
                        <p>
                            <span className="font-medium">Title:</span> {form.watch('title')}
                        </p>
                        <p>
                            <span className="font-medium">Priority:</span> {humanize(form.watch('priority'))}
                        </p>
                        <p>
                            <span className="font-medium">Source:</span> {humanize(form.watch('source'))}
                        </p>
                        <p className="whitespace-pre-wrap text-foreground/80">{form.watch('problem_description')}</p>
                        <p className="text-muted-foreground">
                            The ticket will start in the Opened state. Warranty eligibility is calculated by the server.
                        </p>
                    </div>
                )}
                <ErrorMessage error={createMutation.error} />
                <div className="flex flex-wrap justify-between gap-3">
                    <Button variant="outline" disabled={step === 1} onClick={() => setStep((current) => current - 1)}>
                        Back
                    </Button>
                    {step < 3 ? (
                        <Button onClick={() => void next()}>Continue</Button>
                    ) : (
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Creating...' : 'Create ticket'}
                        </Button>
                    )}
                </div>
            </form>
        </section>
    );
}

export function TicketDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const ticketQuery = useQuery({ queryKey: ['tickets', uuid], queryFn: () => getTicket(uuid ?? ''), enabled: uuid !== undefined });
    const techniciansQuery = useQuery({
        queryKey: ['technicians', 'ticket-assignment'],
        queryFn: () => listTechnicians({ per_page: 100, sort: 'employee_code', direction: 'asc' }),
    });
    const editForm = useForm<TicketEditValues>({
        resolver: zodResolver(ticketUpdateSchema),
        defaultValues: { title: '', problem_description: '', source: 'web' },
    });
    const [nextStatus, setNextStatus] = useState<TicketStatus | ''>('');
    const [transitionNotes, setTransitionNotes] = useState('');
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] = useState(false);
    const { can } = usePermissions();
    const refresh = (ticket: Ticket) => {
        queryClient.setQueryData(['tickets', uuid], ticket);
        void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    };

    useEffect(() => {
        if (!ticketQuery.data) return;
        editForm.reset({
            title: ticketQuery.data.title,
            problem_description: ticketQuery.data.problem_description,
            source: ticketQuery.data.source,
        });
    }, [editForm, ticketQuery.data]);

    const ticket = ticketQuery.data;
    const nextStates = ticket ? transitions[ticket.status] : [];
    const selectedNextStatus = nextStates.includes(nextStatus as TicketStatus) ? (nextStatus as TicketStatus) : (nextStates[0] ?? '');

    const updateMutation = useMutation({
        mutationFn: (values: TicketEditValues) => updateTicket(uuid ?? '', values as TicketUpdatePayload),
        onSuccess: refresh,
    });
    const assignmentMutation = useMutation({ mutationFn: (id: number) => assignTicketTechnician(uuid ?? '', id), onSuccess: refresh });
    const priorityMutation = useMutation({
        mutationFn: (priority: TicketPriority) => changeTicketPriority(uuid ?? '', priority),
        onSuccess: refresh,
    });
    const transitionMutation = useMutation({
        mutationFn: () => transitionTicket(uuid ?? '', selectedNextStatus as TicketStatus, transitionNotes || null),
        onSuccess: (ticket) => {
            setTransitionNotes('');
            refresh(ticket);
        },
    });
    const cancelMutation = useMutation({
        mutationFn: () => cancelTicket(uuid ?? '', cancelReason),
        onSuccess: (ticket) => {
            setCancelReason('');
            setIsCancelConfirmationOpen(false);
            refresh(ticket);
        },
    });
    const startDiagnosisMutation = useMutation({
        mutationFn: () => startDiagnosis(uuid ?? ''),
        onSuccess: (repair) => navigate(`/admin/repairs/${repair.id}`),
    });
    useTicketRealtime(ticket?.id ?? null);

    if (ticketQuery.isLoading) return <PageSkeleton />;
    if (!ticket)
        return (
            <ErrorState
                title="Ticket unavailable"
                description={
                    getApiErrorMessage(ticketQuery.error, 'The requested ticket could not be found.') ??
                    'The requested ticket could not be found.'
                }
                onRetry={() => void ticketQuery.refetch()}
            />
        );
    const isTerminal = ticket.status === 'closed' || ticket.status === 'cancelled';

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader
                title={ticket.ticket_number}
                description={ticket.title}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={ticket.priority} />
                        <StatusBadge value={ticket.status} />
                    </div>
                }
            />
            <AttachmentPanel
                resourceType="tickets"
                resourceKey={ticket.uuid}
                canUpload={can('tickets.update')}
                canDelete={can('tickets.update')}
                disabled={isTerminal}
            />
            <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 md:grid-cols-2 lg:grid-cols-4">
                <Detail label="Client" value={ticket.client?.display_name ?? '—'} />
                <Detail label="Product" value={ticket.product ? `${ticket.product.name} (${ticket.product.sku})` : '—'} />
                <Detail label="Warranty" value={ticket.warranty?.serial_number ?? 'No linked warranty'} />
                <Detail
                    label="Coverage"
                    value={
                        ticket.warranty_eligible ? (
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">Eligible</span>
                        ) : (
                            <span className="font-medium text-muted-foreground">Not eligible</span>
                        )
                    }
                />
                <Detail label="Source" value={humanize(ticket.source)} />
                <Detail label="Received" value={formatDate(ticket.received_at)} />
                <Detail label="Closed" value={formatDate(ticket.closed_at)} />
                <Detail label="Created by" value={ticket.created_by_user?.display_name ?? '—'} />
            </section>
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Can permission="tickets.update">
                        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-semibold text-foreground">Ticket information</h2>
                            <form className="mt-4 space-y-4" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate(values))}>
                                <FormField label="Title" required error={editForm.formState.errors.title?.message}>
                                    <Input disabled={isTerminal} {...editForm.register('title')} />
                                </FormField>
                                <FormField
                                    label="Problem description"
                                    required
                                    error={editForm.formState.errors.problem_description?.message}
                                >
                                    <Textarea rows={6} disabled={isTerminal} {...editForm.register('problem_description')} />
                                </FormField>
                                <FormField label="Source" required error={editForm.formState.errors.source?.message}>
                                    <Select disabled={isTerminal} {...editForm.register('source')}>
                                        <option value="store">Store</option>
                                        <option value="phone">Phone</option>
                                        <option value="email">Email</option>
                                        <option value="web">Web</option>
                                    </Select>
                                </FormField>
                                <ErrorMessage error={updateMutation.error} />
                                {!isTerminal && (
                                    <Button type="submit" disabled={updateMutation.isPending}>
                                        {updateMutation.isPending ? 'Saving...' : 'Save details'}
                                    </Button>
                                )}
                            </form>
                        </section>
                    </Can>
                    <TicketHistoryTimeline history={ticket.ticket_history} statusHistory={ticket.status_history} />
                </div>
                <aside className="space-y-6">
                    <Can permission="tickets.assign">
                        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                            <h2 className="font-semibold text-foreground">Technician assignment</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {ticket.assigned_technician?.user?.display_name ?? 'No technician assigned.'}
                            </p>
                            <FormField className="mt-4" label="Assigned technician">
                                <Select
                                    disabled={isTerminal || assignmentMutation.isPending}
                                    value={ticket.assigned_technician_id ?? ''}
                                    onChange={(event) => event.target.value && assignmentMutation.mutate(Number(event.target.value))}
                                >
                                    <option value="">Choose technician</option>
                                    {techniciansQuery.data?.data.map((technician) => (
                                        <option key={technician.id} value={technician.id}>
                                            {technician.user
                                                ? `${technician.user.first_name} ${technician.user.last_name}`
                                                : technician.employee_code}{' '}
                                            · {humanize(technician.availability_status)}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <ErrorMessage error={assignmentMutation.error} />
                        </section>
                    </Can>
                    <Can permission="tickets.update">
                        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                            <h2 className="font-semibold text-foreground">Priority</h2>
                            <FormField className="mt-4" label="Ticket priority">
                                <Select
                                    disabled={isTerminal || priorityMutation.isPending}
                                    value={ticket.priority}
                                    onChange={(event) => priorityMutation.mutate(event.target.value as TicketPriority)}
                                >
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </Select>
                            </FormField>
                            <ErrorMessage error={priorityMutation.error} />
                        </section>
                    </Can>
                    {ticket.status === 'awaiting_diagnosis' && (
                        <Can permission="repairs.update">
                            <section className="rounded-xl border border-primary/25 bg-primary/5 p-5">
                                <h2 className="font-semibold text-foreground">Technician diagnosis</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Create the repair record and begin diagnosis for this assigned ticket.
                                </p>
                                <ErrorMessage error={startDiagnosisMutation.error} />
                                <Button
                                    className="mt-4"
                                    disabled={startDiagnosisMutation.isPending}
                                    onClick={() => startDiagnosisMutation.mutate()}
                                >
                                    {startDiagnosisMutation.isPending ? 'Starting...' : 'Start diagnosis'}
                                </Button>
                            </section>
                        </Can>
                    )}
                    {nextStates.length > 0 && (
                        <Can permission="tickets.update">
                            <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                                <h2 className="font-semibold text-foreground">Advance workflow</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Only the next valid states are available.</p>
                                <div className="mt-4 space-y-4">
                                    <FormField label="Next status" required>
                                        <Select
                                            value={selectedNextStatus}
                                            onChange={(event) => setNextStatus(event.target.value as TicketStatus)}
                                        >
                                            {nextStates.map((status) => (
                                                <option key={status} value={status}>
                                                    {humanize(status)}
                                                </option>
                                            ))}
                                        </Select>
                                    </FormField>
                                    <FormField label="Transition notes (optional)">
                                        <Textarea
                                            rows={3}
                                            value={transitionNotes}
                                            onChange={(event) => setTransitionNotes(event.target.value)}
                                        />
                                    </FormField>
                                </div>
                                <ErrorMessage error={transitionMutation.error} />
                                <Button
                                    className="mt-4 w-full sm:w-auto"
                                    disabled={transitionMutation.isPending}
                                    onClick={() => transitionMutation.mutate()}
                                >
                                    {transitionMutation.isPending ? 'Updating...' : `Move to ${humanize(selectedNextStatus)}`}
                                </Button>
                            </section>
                        </Can>
                    )}
                    {!isTerminal && (
                        <Can permission="tickets.close">
                            <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                                <h2 className="font-semibold text-destructive">Cancel ticket</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Cancellation is permanent and requires a reason.</p>
                                <FormField
                                    className="mt-4"
                                    label="Cancellation reason"
                                    required
                                    error={
                                        cancelReason.length > 0 && cancelReason.trim().length < 3
                                            ? 'Enter at least 3 characters.'
                                            : undefined
                                    }
                                >
                                    <Textarea rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
                                </FormField>
                                <ErrorMessage error={cancelMutation.error} />
                                <Button
                                    className="mt-4 w-full sm:w-auto"
                                    variant="destructive"
                                    disabled={cancelMutation.isPending || cancelReason.trim().length < 3}
                                    onClick={() => setIsCancelConfirmationOpen(true)}
                                >
                                    {cancelMutation.isPending ? 'Cancelling...' : 'Cancel ticket'}
                                </Button>
                            </section>
                        </Can>
                    )}
                </aside>
            </div>
            <ConfirmDialog
                open={isCancelConfirmationOpen}
                title="Cancel ticket"
                description={`Cancel ${ticket.ticket_number}? This action cannot be undone.`}
                confirmLabel="Cancel ticket"
                isPending={cancelMutation.isPending}
                onCancel={() => setIsCancelConfirmationOpen(false)}
                onConfirm={() => cancelMutation.mutate()}
            />
        </section>
    );
}

function StatusTimeline({ history }: { history: Ticket['status_history'] }) {
    return (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">Status timeline</h2>
            {history.length === 0 ? (
                <EmptyState compact title="No status history" description="Status changes will appear here as this ticket progresses." />
            ) : (
                <div className="mt-5 space-y-5 border-l-2 border-border pl-5">
                    {history.map((entry) => (
                        <article className="relative" key={entry.id}>
                            <span className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge value={entry.to_status} />
                                <span className="text-sm text-muted-foreground">{formatDate(entry.transitioned_at)}</span>
                            </div>
                            <p className="mt-1 text-sm text-foreground/80">
                                {entry.from_status ? `${humanize(entry.from_status)} → ${humanize(entry.to_status)}` : 'Ticket created'}
                            </p>
                            {entry.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{entry.notes}</p>}
                            <p className="mt-1 text-xs text-muted-foreground">by {entry.transitioned_by?.display_name ?? 'System'}</p>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

function TicketHistoryTimeline({ history, statusHistory }: { history: Ticket['ticket_history']; statusHistory: Ticket['status_history'] }) {
    const chronologicalHistory = [...(history ?? [])].sort(
        (left, right) => new Date(left.occurred_at ?? 0).getTime() - new Date(right.occurred_at ?? 0).getTime(),
    );
    if (chronologicalHistory.length === 0) return <StatusTimeline history={statusHistory} />;

    return (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">Ticket history</h2>
            <p className="mt-1 text-sm text-muted-foreground">Business activity recorded throughout this ticket's lifecycle.</p>
            <div className="mt-5 space-y-5 border-l-2 border-border pl-5">
                {chronologicalHistory.map((entry) => (
                    <article className="relative" key={entry.id}>
                        <span className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                {humanize(entry.event)}
                            </span>
                            <span className="text-sm text-muted-foreground">{formatDate(entry.occurred_at)}</span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{entry.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">by {entry.actor?.display_name ?? 'System'}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
