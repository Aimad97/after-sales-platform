import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { archiveClient, createClient, getClient, getClientProfile, listClients, updateClient } from '@/features/clients/api';
import type { Client, ClientFilters, ClientPayload, ClientProfile, ClientType, ClientWarranty } from '@/features/clients/types';
import { ClientInvoiceHistory } from '@/features/invoices/InvoicePages';
import { Can } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export const clientSchema = z.object({
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
}).superRefine((values, context) => {
    if (values.type === 'company' && values.company_name.length === 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['company_name'], message: 'Company name is required.' });
    }

    if (values.type === 'company' && values.tax_identifier.length === 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['tax_identifier'], message: 'Tax identifier is required.' });
    }
});

type ClientFormValues = z.infer<typeof clientSchema>;

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
            </div>
            {action}
        </div>
    );
}

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error
        ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p>
        : null;
}

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

    return (
        <section className="space-y-6">
            <PageHeader
                title="Clients"
                description="Manage customer contact details, purchase history, warranties, and SAV activity."
                action={<Can permission="clients.create"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm" to="/admin/clients/new">Add client</Link></Can>}
            />

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                <input
                    className={inputClassName}
                    placeholder="Search name, company, email, or phone..."
                    value={filters.search ?? ''}
                    onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                />
                <select
                    className={inputClassName}
                    value={filters.type ?? ''}
                    onChange={(event) => updateFilters({ type: event.target.value === '' ? undefined : event.target.value as ClientType })}
                >
                    <option value="">All client types</option>
                    <option value="individual">Individual</option>
                    <option value="company">Company</option>
                </select>
                <select
                    className={inputClassName}
                    value={filters.sort ?? 'created_at'}
                    onChange={(event) => updateFilters({ sort: event.target.value as NonNullable<ClientFilters['sort']> })}
                >
                    <option value="created_at">Newest first</option>
                    <option value="first_name">First name</option>
                    <option value="last_name">Last name</option>
                    <option value="company_name">Company name</option>
                    <option value="city">City</option>
                </select>
            </div>

            {clientsQuery.isLoading ? <p className="text-sm text-slate-600">Loading clients...</p> : (
                <>
                    <ErrorMessage error={clientsQuery.error} />
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50 text-left text-slate-600">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Client</th>
                                    <th className="px-4 py-3 font-semibold">Type</th>
                                    <th className="px-4 py-3 font-semibold">Contact</th>
                                    <th className="px-4 py-3 font-semibold">City</th>
                                    <th className="px-4 py-3 font-semibold">Created</th>
                                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {clientsQuery.data?.data.map((client) => (
                                    <tr key={client.uuid}>
                                        <td className="px-4 py-3">
                                            <Link className="font-semibold text-slate-900 hover:text-blue-700" to={`/admin/clients/${client.uuid}`}>{client.display_name}</Link>
                                            <p className="mt-0.5 text-slate-500">{client.type === 'company' ? `${client.first_name} ${client.last_name}` : client.email ?? 'No email'}</p>
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge value={client.type} /></td>
                                        <td className="px-4 py-3 text-slate-600"><p>{client.email ?? 'No email'}</p><p className="mt-0.5">{client.phone}</p></td>
                                        <td className="px-4 py-3 text-slate-600">{client.city ?? '—'}</td>
                                        <td className="px-4 py-3 text-slate-600">{formatDate(client.created_at)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-3">
                                                <Link className="font-medium text-blue-700" to={`/admin/clients/${client.uuid}`}>View</Link>
                                                <Can permission="clients.update"><Link className="font-medium text-blue-700" to={`/admin/clients/${client.uuid}/edit`}>Edit</Link></Can>
                                                <Can permission="clients.delete"><button className="font-medium text-rose-700" onClick={() => setArchiveTarget(client)}>Archive</button></Can>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {clientsQuery.data?.data.length === 0 && <p className="p-6 text-center text-sm text-slate-600">No clients match these filters.</p>}
                    </div>
                    {clientsQuery.data && <Pagination meta={clientsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}
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
            type: 'individual', company_name: '', first_name: '', last_name: '', email: '', phone: '', address: '', city: '', tax_identifier: '', notes: '',
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

    if (isEditing && clientQuery.isLoading) return <p className="text-sm text-slate-600">Loading client...</p>;
    if (isEditing && !clientQuery.data && clientQuery.error) return <ErrorMessage error={clientQuery.error} />;

    return (
        <section className="max-w-3xl space-y-6">
            <PageHeader title={isEditing ? 'Edit client' : 'Add client'} description={isEditing ? 'Update client identity and contact information.' : 'Create an individual or company client record.'} />
            <form className="space-y-6 rounded-xl border border-slate-200 bg-white p-6" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Client type" error={form.formState.errors.type?.message}>
                        <select className={inputClassName} value={clientType} onChange={(event) => setType(event.target.value as ClientType)}>
                            <option value="individual">Individual</option>
                            <option value="company">Company</option>
                        </select>
                    </Field>
                    <Field label="Phone" error={form.formState.errors.phone?.message}><input className={inputClassName} type="tel" {...form.register('phone')} /></Field>
                </div>

                {clientType === 'company' && (
                    <div className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
                        <Field label="Company name" error={form.formState.errors.company_name?.message}><input className={inputClassName} {...form.register('company_name')} /></Field>
                        <Field label="Tax identifier" error={form.formState.errors.tax_identifier?.message}><input className={inputClassName} {...form.register('tax_identifier')} /></Field>
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First name" error={form.formState.errors.first_name?.message}><input className={inputClassName} {...form.register('first_name')} /></Field>
                    <Field label="Last name" error={form.formState.errors.last_name?.message}><input className={inputClassName} {...form.register('last_name')} /></Field>
                    <Field label="Email" error={form.formState.errors.email?.message}><input className={inputClassName} type="email" {...form.register('email')} /></Field>
                    <Field label="City" error={form.formState.errors.city?.message}><input className={inputClassName} {...form.register('city')} /></Field>
                </div>

                <Field label="Address" error={form.formState.errors.address?.message}><textarea className={inputClassName} rows={3} {...form.register('address')} /></Field>
                <Field label="Notes" error={form.formState.errors.notes?.message}><textarea className={inputClassName} rows={5} {...form.register('notes')} /></Field>
                <ErrorMessage error={saveMutation.error} />
                <div className="flex justify-end gap-3">
                    <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" to={isEditing ? `/admin/clients/${uuid}` : '/admin/clients'}>Cancel</Link>
                    <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save client'}</button>
                </div>
            </form>
        </section>
    );
}

export function ClientDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const profileQuery = useQuery({ queryKey: ['clients', uuid, 'profile'], queryFn: () => getClientProfile(uuid ?? ''), enabled: uuid !== undefined });
    const profile = profileQuery.data;

    if (profileQuery.isLoading) return <p className="text-sm text-slate-600">Loading client profile...</p>;
    if (!profile) return <ErrorMessage error={profileQuery.error ?? new Error('Client not found.')} />;

    return (
        <section className="space-y-6">
            <PageHeader
                title={profile.client.display_name}
                description={`${profile.client.type === 'company' ? 'Company' : 'Individual'} client profile and SAV history.`}
                action={<Can permission="clients.update"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to={`/admin/clients/${profile.client.uuid}/edit`}>Edit client</Link></Can>}
            />

            <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2 lg:grid-cols-3">
                <Detail label="Type" value={<StatusBadge value={profile.client.type} />} />
                {profile.client.type === 'company' && <Detail label="Company" value={profile.client.company_name ?? '—'} />}
                {profile.client.type === 'company' && <Detail label="Tax identifier" value={profile.client.tax_identifier ?? '—'} />}
                <Detail label="Contact person" value={`${profile.client.first_name} ${profile.client.last_name}`} />
                <Detail label="Email" value={profile.client.email ?? '—'} />
                <Detail label="Phone" value={profile.client.phone} />
                <Detail label="City" value={profile.client.city ?? '—'} />
                <Detail label="Address" value={profile.client.address ?? '—'} />
                <Detail label="Client since" value={formatDate(profile.client.created_at)} />
                <div className="md:col-span-2 lg:col-span-3"><Detail label="Notes" value={<p className="whitespace-pre-wrap">{profile.client.notes ?? 'No notes.'}</p>} /></div>
            </section>

            <WarrantySection title="Purchased products" description="Products registered to this client, including serial and purchase dates." warranties={profile.purchased_products} />
            <div className="grid gap-6 xl:grid-cols-2">
                <WarrantySection title="Active warranties" description="Warranty coverage currently valid." warranties={profile.active_warranties} tone="active" />
                <WarrantySection title="Expired warranties" description="Warranty coverage that has ended." warranties={profile.expired_warranties} tone="expired" />
            </div>
            <Can permission="invoices.view"><ClientInvoiceHistory clientUuid={profile.client.uuid} /></Can>
            <TicketSection tickets={profile.tickets} />
            <RepairSection profile={profile} />
        </section>
    );
}

function WarrantySection({ title, description, warranties, tone }: { title: string; description: string; warranties: ClientWarranty[]; tone?: 'active' | 'expired' }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p></div>{tone && <StatusBadge value={tone} />}</div>
            {warranties.length === 0 ? <EmptyState message="No records available." /> : (
                <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="pb-2 font-semibold">Product</th><th className="pb-2 font-semibold">Serial number</th><th className="pb-2 font-semibold">Quantity</th><th className="pb-2 font-semibold">Purchased</th><th className="pb-2 font-semibold">Warranty end</th></tr></thead><tbody className="divide-y divide-slate-100">{warranties.map((warranty) => <tr key={warranty.id}><td className="py-3 font-medium text-slate-900">{warranty.product ? `${warranty.product.name} (${warranty.product.model})` : 'Unknown product'}</td><td className="py-3 text-slate-600">{warranty.serial_number ?? 'â€”'}</td><td className="py-3 text-slate-600">{warranty.quantity}</td><td className="py-3 text-slate-600">{formatDateOnly(warranty.purchase_date)}</td><td className="py-3 text-slate-600">{formatDateOnly(warranty.warranty_end)}</td></tr>)}</tbody></table></div>
            )}
        </section>
    );
}

function TicketSection({ tickets }: { tickets: ClientProfile['tickets'] }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">SAV ticket history</h3>
            <p className="mt-1 text-sm text-slate-600">All support tickets opened for this client.</p>
            {tickets.length === 0 ? <EmptyState message="No SAV tickets have been opened." /> : (
                <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="pb-2 font-semibold">Subject</th><th className="pb-2 font-semibold">Status</th><th className="pb-2 font-semibold">Opened</th><th className="pb-2 font-semibold">Closed</th></tr></thead><tbody className="divide-y divide-slate-100">{tickets.map((ticket) => <tr key={ticket.uuid}><td className="py-3"><p className="font-medium text-slate-900">{ticket.subject}</p><p className="mt-0.5 max-w-xl truncate text-slate-500">{ticket.description}</p></td><td className="py-3 text-slate-600">{ticket.status?.name ?? '—'}</td><td className="py-3 text-slate-600">{formatDate(ticket.opened_at)}</td><td className="py-3 text-slate-600">{formatDate(ticket.closed_at)}</td></tr>)}</tbody></table></div>
            )}
        </section>
    );
}

function RepairSection({ profile }: { profile: ClientProfile }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Repair history</h3>
            <p className="mt-1 text-sm text-slate-600">Completed and recorded technical interventions linked to SAV tickets.</p>
            {profile.repair_history.length === 0 ? <EmptyState message="No repair interventions have been recorded." /> : (
                <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="pb-2 font-semibold">Ticket</th><th className="pb-2 font-semibold">Diagnostic</th><th className="pb-2 font-semibold">Solution</th><th className="pb-2 font-semibold">Labor</th><th className="pb-2 font-semibold">Recorded</th></tr></thead><tbody className="divide-y divide-slate-100">{profile.repair_history.map((repair) => <tr key={repair.id}><td className="py-3 font-medium text-slate-900">{repair.ticket?.subject ?? '—'}</td><td className="py-3 text-slate-600">{repair.diagnostic}</td><td className="py-3 text-slate-600">{repair.solution ?? '—'}</td><td className="py-3 text-slate-600">{formatCurrency(repair.labor_cost)}</td><td className="py-3 text-slate-600">{formatDate(repair.created_at)}</td></tr>)}</tbody></table></div>
            )}
        </section>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <label className="block text-sm font-medium text-slate-800">{label}{children}{error && <span className="mt-1 block text-sm font-normal text-rose-700">{error}</span>}</label>;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 text-sm text-slate-800">{value}</div></div>;
}

function EmptyState({ message }: { message: string }) {
    return <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">{message}</p>;
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
