import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { listProducts } from '@/features/catalog/api';
import { listClients } from '@/features/clients/api';
import { listTechnicians } from '@/features/technicians/api';
import { listWarranties } from '@/features/warranties/api';
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
import type { Ticket, TicketFilters, TicketPayload, TicketPriority, TicketSource, TicketStatus, TicketUpdatePayload } from '@/features/tickets/types';
import { Can } from '@/hooks/usePermissions';
import { formatDate, humanize } from '@/utils/format';

const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
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

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div>{action}</div>;
}

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p> : null;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <label className="block text-sm font-medium text-slate-800">{label}{children}{error && <span className="mt-1 block text-sm font-normal text-rose-700">{error}</span>}</label>;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 break-words text-sm text-slate-800">{value}</div></div>;
}

export function TicketsPage() {
    const [filters, setFilters] = useState<TicketFilters>({ per_page: 10, sort: 'received_at', direction: 'desc' });
    const ticketsQuery = useQuery({ queryKey: ['tickets', filters], queryFn: () => listTickets(filters) });
    const clientsQuery = useQuery({ queryKey: ['clients', 'ticket-filters'], queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }) });
    const techniciansQuery = useQuery({ queryKey: ['technicians', 'ticket-filters'], queryFn: () => listTechnicians({ per_page: 100, sort: 'employee_code', direction: 'asc' }) });
    const updateFilters = (next: Partial<TicketFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Ticket>[] = [
        { id: 'ticket', header: 'Ticket', cell: (ticket) => <div><Link className="font-semibold text-slate-900 hover:text-blue-700" to={`/admin/tickets/${ticket.uuid}`}>{ticket.ticket_number}</Link><p className="mt-0.5 text-xs text-slate-500">{ticket.title}</p></div> },
        { id: 'client', header: 'Client', cell: (ticket) => <span className="text-slate-700">{ticket.client?.display_name ?? 'Unknown client'}</span> },
        { id: 'product', header: 'Product', cell: (ticket) => <div className="text-slate-700"><p>{ticket.product?.name ?? 'Unknown product'}</p><p className="mt-0.5 text-xs text-slate-500">{ticket.warranty?.serial_number ?? ticket.product?.sku ?? '—'}</p></div> },
        { id: 'priority', header: 'Priority', cell: (ticket) => <StatusBadge value={ticket.priority} /> },
        { id: 'status', header: 'Status', cell: (ticket) => <StatusBadge value={ticket.status} /> },
        { id: 'technician', header: 'Technician', cell: (ticket) => <span className="text-slate-700">{ticket.assigned_technician?.user?.display_name ?? 'Unassigned'}</span> },
        { id: 'received', header: 'Received', cell: (ticket) => <span className="text-slate-600">{formatDate(ticket.received_at)}</span> },
    ];

    return (
        <section className="space-y-6">
            <PageHeader title="SAV tickets" description="Manage product support requests through a controlled repair workflow." action={<Can permission="tickets.create"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" to="/admin/tickets/new">Create ticket</Link></Can>} />
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
                <input className={inputClassName} placeholder="Search ticket, client, serial..." value={filters.search ?? ''} onChange={(event) => updateFilters({ search: event.target.value || undefined })} />
                <select className={inputClassName} value={filters.client_id ?? ''} onChange={(event) => updateFilters({ client_id: event.target.value === '' ? '' : Number(event.target.value) })}><option value="">All clients</option>{clientsQuery.data?.data.map((client) => <option key={client.id} value={client.id}>{client.display_name}</option>)}</select>
                <select className={inputClassName} value={filters.assigned_technician_id ?? ''} onChange={(event) => updateFilters({ assigned_technician_id: event.target.value === '' ? '' : Number(event.target.value) })}><option value="">All technicians</option>{techniciansQuery.data?.data.map((technician) => <option key={technician.id} value={technician.id}>{technician.user ? `${technician.user.first_name} ${technician.user.last_name}` : technician.employee_code}</option>)}</select>
                <select className={inputClassName} value={filters.status ?? ''} onChange={(event) => updateFilters({ status: event.target.value === '' ? '' : event.target.value as TicketStatus })}><option value="">All statuses</option>{Object.keys(transitions).map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select>
                <select className={inputClassName} value={filters.priority ?? ''} onChange={(event) => updateFilters({ priority: event.target.value === '' ? '' : event.target.value as TicketPriority })}><option value="">All priorities</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
                <select className={inputClassName} value={filters.source ?? ''} onChange={(event) => updateFilters({ source: event.target.value === '' ? '' : event.target.value as TicketSource })}><option value="">All sources</option><option value="store">Store</option><option value="phone">Phone</option><option value="email">Email</option><option value="web">Web</option></select>
                <select className={inputClassName} value={filters.warranty_eligible === '' || filters.warranty_eligible === undefined ? '' : String(filters.warranty_eligible)} onChange={(event) => updateFilters({ warranty_eligible: event.target.value === '' ? '' : event.target.value === 'true' })}><option value="">Any warranty eligibility</option><option value="true">Under warranty</option><option value="false">Out of warranty</option></select>
                <input className={inputClassName} type="date" aria-label="Received from" value={filters.received_from ?? ''} onChange={(event) => updateFilters({ received_from: event.target.value || undefined })} />
                <input className={inputClassName} type="date" aria-label="Received to" value={filters.received_to ?? ''} onChange={(event) => updateFilters({ received_to: event.target.value || undefined })} />
            </div>
            {ticketsQuery.isLoading ? <p className="text-sm text-slate-600">Loading tickets...</p> : <><ErrorMessage error={ticketsQuery.error} /><DataTable rows={ticketsQuery.data?.data ?? []} columns={columns} getRowKey={(ticket) => ticket.uuid} emptyMessage="No tickets match these filters." />{ticketsQuery.data && <Pagination meta={ticketsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</>}
        </section>
    );
}

export function TicketFormPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const form = useForm<TicketFormValues>({ resolver: zodResolver(ticketSchema), defaultValues: { client_id: undefined, product_id: undefined, warranty_id: null, title: '', problem_description: '', priority: 'normal', source: 'web' } });
    const selectedClientId = form.watch('client_id');
    const selectedProductId = form.watch('product_id');
    const clientsQuery = useQuery({ queryKey: ['clients', 'ticket-create'], queryFn: () => listClients({ per_page: 100, sort: 'first_name', direction: 'asc' }) });
    const productsQuery = useQuery({ queryKey: ['catalog', 'products', 'ticket-create'], queryFn: () => listProducts({ per_page: 100, sort: 'name', direction: 'asc' }) });
    const warrantiesQuery = useQuery({ queryKey: ['warranties', 'ticket-create', selectedClientId, selectedProductId], queryFn: () => listWarranties({ client_id: selectedClientId, product_id: selectedProductId, per_page: 100, sort: 'expires_at', direction: 'asc' }), enabled: Number.isInteger(selectedClientId) && Number.isInteger(selectedProductId) });
    const createMutation = useMutation({
        mutationFn: (values: TicketFormValues) => createTicket(values as TicketPayload),
        onSuccess: (ticket) => navigate(`/admin/tickets/${ticket.uuid}`),
    });
    const next = async () => {
        const fields = step === 1 ? ['client_id', 'product_id'] as const : ['title', 'problem_description', 'priority', 'source'] as const;
        if (await form.trigger(fields)) setStep((current) => Math.min(3, current + 1));
    };

    return (
        <section className="mx-auto max-w-3xl space-y-6">
            <PageHeader title="Create SAV ticket" description="Capture the product issue, coverage context, and intake source." action={<Link className="text-sm font-medium text-blue-700" to="/admin/tickets">Back to tickets</Link>} />
            <div className="flex items-center gap-2 text-sm">{[1, 2, 3].map((number) => <span key={number} className={`rounded-full px-3 py-1 font-semibold ${number === step ? 'bg-blue-600 text-white' : number < step ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>Step {number}</span>)}</div>
            <form className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
                {step === 1 && <div className="grid gap-4 md:grid-cols-2"><Field label="Client" error={form.formState.errors.client_id?.message}><select className={inputClassName} {...form.register('client_id')} onChange={(event) => { form.setValue('client_id', Number(event.target.value)); form.setValue('warranty_id', null); }}><option value="">Select a client</option>{clientsQuery.data?.data.map((client) => <option key={client.id} value={client.id}>{client.display_name}</option>)}</select></Field><Field label="Product" error={form.formState.errors.product_id?.message}><select className={inputClassName} {...form.register('product_id')} onChange={(event) => { form.setValue('product_id', Number(event.target.value)); form.setValue('warranty_id', null); }}><option value="">Select a product</option>{productsQuery.data?.data.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}{product.active ? '' : ' (inactive)'}</option>)}</select>{productsQuery.error && <ErrorMessage error={productsQuery.error} />}</Field><div className="md:col-span-2"><Field label="Warranty (optional)" error={form.formState.errors.warranty_id?.message}><select className={inputClassName} value={form.watch('warranty_id') ?? ''} onChange={(event) => form.setValue('warranty_id', event.target.value === '' ? null : Number(event.target.value), { shouldDirty: true, shouldValidate: true })}><option value="">No linked warranty</option>{warrantiesQuery.data?.data.map((warranty) => <option key={warranty.id} value={warranty.id}>{warranty.serial_number ?? warranty.uuid} · {humanize(warranty.status)}</option>)}</select></Field><p className="mt-1 text-xs text-slate-500">Only warranties belonging to the selected client and product are listed.</p></div></div>}
                {step === 2 && <div className="space-y-4"><Field label="Ticket title" error={form.formState.errors.title?.message}><input className={inputClassName} {...form.register('title')} /></Field><Field label="Problem description" error={form.formState.errors.problem_description?.message}><textarea className={inputClassName} rows={7} {...form.register('problem_description')} /></Field><div className="grid gap-4 md:grid-cols-2"><Field label="Priority" error={form.formState.errors.priority?.message}><select className={inputClassName} {...form.register('priority')}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field><Field label="Source" error={form.formState.errors.source?.message}><select className={inputClassName} {...form.register('source')}><option value="store">Store</option><option value="phone">Phone</option><option value="email">Email</option><option value="web">Web</option></select></Field></div></div>}
                {step === 3 && <div className="space-y-3 rounded-lg bg-slate-50 p-5 text-sm"><p className="font-semibold text-slate-900">Review ticket</p><p><span className="font-medium">Title:</span> {form.watch('title')}</p><p><span className="font-medium">Priority:</span> {humanize(form.watch('priority'))}</p><p><span className="font-medium">Source:</span> {humanize(form.watch('source'))}</p><p className="whitespace-pre-wrap text-slate-700">{form.watch('problem_description')}</p><p className="text-slate-500">The ticket will start in the Opened state. Warranty eligibility is calculated by the server.</p></div>}
                <ErrorMessage error={createMutation.error} />
                <div className="flex justify-between gap-3"><button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50" disabled={step === 1} onClick={() => setStep((current) => current - 1)}>Back</button>{step < 3 ? <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => void next()}>Continue</button> : <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create ticket'}</button>}</div>
            </form>
        </section>
    );
}

export function TicketDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const queryClient = useQueryClient();
    const ticketQuery = useQuery({ queryKey: ['tickets', uuid], queryFn: () => getTicket(uuid ?? ''), enabled: uuid !== undefined });
    const techniciansQuery = useQuery({ queryKey: ['technicians', 'ticket-assignment'], queryFn: () => listTechnicians({ per_page: 100, sort: 'employee_code', direction: 'asc' }) });
    const editForm = useForm<TicketEditValues>({ resolver: zodResolver(ticketUpdateSchema), defaultValues: { title: '', problem_description: '', source: 'web' } });
    const [nextStatus, setNextStatus] = useState<TicketStatus | ''>('');
    const [transitionNotes, setTransitionNotes] = useState('');
    const [cancelReason, setCancelReason] = useState('');
    const refresh = (ticket: Ticket) => { queryClient.setQueryData(['tickets', uuid], ticket); void queryClient.invalidateQueries({ queryKey: ['tickets'] }); };

    useEffect(() => {
        if (!ticketQuery.data) return;
        editForm.reset({ title: ticketQuery.data.title, problem_description: ticketQuery.data.problem_description, source: ticketQuery.data.source });
        setNextStatus(transitions[ticketQuery.data.status][0] ?? '');
    }, [editForm, ticketQuery.data]);

    const updateMutation = useMutation({ mutationFn: (values: TicketEditValues) => updateTicket(uuid ?? '', values as TicketUpdatePayload), onSuccess: refresh });
    const assignmentMutation = useMutation({ mutationFn: (id: number) => assignTicketTechnician(uuid ?? '', id), onSuccess: refresh });
    const priorityMutation = useMutation({ mutationFn: (priority: TicketPriority) => changeTicketPriority(uuid ?? '', priority), onSuccess: refresh });
    const transitionMutation = useMutation({ mutationFn: () => transitionTicket(uuid ?? '', nextStatus as TicketStatus, transitionNotes || null), onSuccess: (ticket) => { setTransitionNotes(''); refresh(ticket); } });
    const cancelMutation = useMutation({ mutationFn: () => cancelTicket(uuid ?? '', cancelReason), onSuccess: (ticket) => { setCancelReason(''); refresh(ticket); } });
    const ticket = ticketQuery.data;

    if (ticketQuery.isLoading) return <p className="text-sm text-slate-600">Loading ticket...</p>;
    if (!ticket) return <ErrorMessage error={ticketQuery.error ?? new Error('Ticket not found.')} />;
    const isTerminal = ticket.status === 'closed' || ticket.status === 'cancelled';
    const nextStates = transitions[ticket.status];

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader title={ticket.ticket_number} description={ticket.title} action={<div className="flex items-center gap-2"><StatusBadge value={ticket.priority} /><StatusBadge value={ticket.status} /></div>} />
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2 lg:grid-cols-4"><Detail label="Client" value={ticket.client?.display_name ?? '—'} /><Detail label="Product" value={ticket.product ? `${ticket.product.name} (${ticket.product.sku})` : '—'} /><Detail label="Warranty" value={ticket.warranty?.serial_number ?? 'No linked warranty'} /><Detail label="Coverage" value={ticket.warranty_eligible ? <span className="font-medium text-emerald-700">Eligible</span> : <span className="font-medium text-slate-600">Not eligible</span>} /><Detail label="Source" value={humanize(ticket.source)} /><Detail label="Received" value={formatDate(ticket.received_at)} /><Detail label="Closed" value={formatDate(ticket.closed_at)} /><Detail label="Created by" value={ticket.created_by_user?.display_name ?? '—'} /></section>
            <div className="grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><Can permission="tickets.update"><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Ticket information</h3><form className="mt-4 space-y-4" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate(values))}><Field label="Title" error={editForm.formState.errors.title?.message}><input className={inputClassName} disabled={isTerminal} {...editForm.register('title')} /></Field><Field label="Problem description" error={editForm.formState.errors.problem_description?.message}><textarea className={inputClassName} rows={6} disabled={isTerminal} {...editForm.register('problem_description')} /></Field><Field label="Source" error={editForm.formState.errors.source?.message}><select className={inputClassName} disabled={isTerminal} {...editForm.register('source')}><option value="store">Store</option><option value="phone">Phone</option><option value="email">Email</option><option value="web">Web</option></select></Field><ErrorMessage error={updateMutation.error} />{!isTerminal && <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save details'}</button>}</form></section></Can><TicketHistoryTimeline history={ticket.ticket_history} statusHistory={ticket.status_history} /></div><aside className="space-y-6"><Can permission="tickets.assign"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Technician assignment</h3><p className="mt-1 text-sm text-slate-600">{ticket.assigned_technician?.user?.display_name ?? 'No technician assigned.'}</p><select className={inputClassName} disabled={isTerminal || assignmentMutation.isPending} value={ticket.assigned_technician_id ?? ''} onChange={(event) => event.target.value && assignmentMutation.mutate(Number(event.target.value))}><option value="">Choose technician</option>{techniciansQuery.data?.data.map((technician) => <option key={technician.id} value={technician.id}>{technician.user ? `${technician.user.first_name} ${technician.user.last_name}` : technician.employee_code} · {humanize(technician.availability_status)}</option>)}</select><ErrorMessage error={assignmentMutation.error} /></section></Can><Can permission="tickets.update"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Priority</h3><select className={inputClassName} disabled={isTerminal || priorityMutation.isPending} value={ticket.priority} onChange={(event) => priorityMutation.mutate(event.target.value as TicketPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><ErrorMessage error={priorityMutation.error} /></section></Can>{nextStates.length > 0 && <Can permission="tickets.update"><section className="rounded-xl border border-blue-100 bg-blue-50 p-5"><h3 className="font-bold text-slate-900">Advance workflow</h3><p className="mt-1 text-sm text-slate-700">Only the next valid states are available.</p><select className={inputClassName} value={nextStatus} onChange={(event) => setNextStatus(event.target.value as TicketStatus)}>{nextStates.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select><textarea className={inputClassName} rows={3} placeholder="Transition notes (optional)" value={transitionNotes} onChange={(event) => setTransitionNotes(event.target.value)} /><ErrorMessage error={transitionMutation.error} /><button className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={transitionMutation.isPending || nextStatus === ''} onClick={() => transitionMutation.mutate()}>{transitionMutation.isPending ? 'Updating...' : `Move to ${humanize(nextStatus)}`}</button></section></Can>}{!isTerminal && <Can permission="tickets.close"><section className="rounded-xl border border-rose-200 bg-rose-50 p-5"><h3 className="font-bold text-rose-900">Cancel ticket</h3><textarea className={inputClassName} rows={3} placeholder="Cancellation reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /><ErrorMessage error={cancelMutation.error} /><button className="mt-3 rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={cancelMutation.isPending || cancelReason.trim().length < 3} onClick={() => { if (window.confirm('Cancel this ticket? This action cannot be undone.')) cancelMutation.mutate(); }}>{cancelMutation.isPending ? 'Cancelling...' : 'Cancel ticket'}</button></section></Can>}</aside></div>
        </section>
    );
}

function StatusTimeline({ history }: { history: Ticket['status_history'] }) {
    return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Status timeline</h3><div className="mt-5 space-y-5 border-l-2 border-slate-200 pl-5">{history.map((entry) => <article className="relative" key={entry.id}><span className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" /><div className="flex flex-wrap items-center gap-2"><StatusBadge value={entry.to_status} /><span className="text-sm text-slate-500">{formatDate(entry.transitioned_at)}</span></div><p className="mt-1 text-sm text-slate-700">{entry.from_status ? `${humanize(entry.from_status)} → ${humanize(entry.to_status)}` : 'Ticket created'}</p>{entry.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{entry.notes}</p>}<p className="mt-1 text-xs text-slate-500">by {entry.transitioned_by?.display_name ?? 'System'}</p></article>)}</div></section>;
}

function TicketHistoryTimeline({ history, statusHistory }: { history: Ticket['ticket_history']; statusHistory: Ticket['status_history'] }) {
    const chronologicalHistory = [...(history ?? [])].sort((left, right) => new Date(left.occurred_at ?? 0).getTime() - new Date(right.occurred_at ?? 0).getTime());
    if (chronologicalHistory.length === 0) return <StatusTimeline history={statusHistory} />;

    return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Ticket history</h3><p className="mt-1 text-sm text-slate-600">Business activity recorded throughout this ticket's lifecycle.</p><div className="mt-5 space-y-5 border-l-2 border-slate-200 pl-5">{chronologicalHistory.map((entry) => <article className="relative" key={entry.id}><span className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" /><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{humanize(entry.event)}</span><span className="text-sm text-slate-500">{formatDate(entry.occurred_at)}</span></div><p className="mt-2 text-sm text-slate-800">{entry.description}</p><p className="mt-1 text-xs text-slate-500">by {entry.actor?.display_name ?? 'System'}</p></article>)}</div></section>;
}
