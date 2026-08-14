import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { FileText, PackageCheck, Plus, ShieldCheck, TicketCheck } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AttachmentPanel } from '@/components/AttachmentPanel';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import {
    createPortalTicket,
    getPortalProduct,
    getPortalProfile,
    getPortalTicket,
    listPortalProducts,
    listPortalTickets,
    uploadPortalTicketAttachment,
} from '@/features/client-portal/api';
import type {
    PortalProductFilters,
    PortalPurchasedProduct,
    PortalTicket,
    PortalTicketFilters,
    PortalTicketPayload,
    PortalWarrantyStatus,
} from '@/features/client-portal/types';
import type { TicketStatus } from '@/features/tickets/types';
import { useTicketRealtime } from '@/hooks/useRealtime';
import { formatDate, humanize } from '@/utils/format';

const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const warrantyStatuses: PortalWarrantyStatus[] = ['active', 'expired', 'void', 'replaced'];
const ticketStatuses: TicketStatus[] = ['opened', 'received', 'awaiting_diagnosis', 'diagnosing', 'awaiting_customer_approval', 'awaiting_part', 'repairing', 'testing', 'repaired', 'ready_for_pickup', 'delivered', 'closed', 'cancelled'];

function errorMessage(error: unknown): string | null {
    if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data.message ?? error.message;
    return error instanceof Error ? error.message : null;
}

function ErrorMessage({ error }: { error: unknown }) {
    const message = errorMessage(error);
    return message ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null;
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div>{action}</header>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 break-words text-sm text-slate-800">{children}</div></div>;
}

function ProductName({ purchasedProduct }: { purchasedProduct: PortalPurchasedProduct }) {
    return <div><p className="font-semibold text-slate-900">{purchasedProduct.product?.name ?? 'Product unavailable'}</p><p className="mt-0.5 text-xs text-slate-500">{purchasedProduct.product?.model ?? purchasedProduct.product?.sku ?? 'No model'} · {purchasedProduct.serial_number ?? 'No serial number'}</p></div>;
}

export function ClientOverviewPage() {
    const profileQuery = useQuery({ queryKey: ['client-portal', 'profile'], queryFn: getPortalProfile });
    const productsQuery = useQuery({ queryKey: ['client-portal', 'products', 'overview'], queryFn: () => listPortalProducts({ per_page: 4 }) });
    const ticketsQuery = useQuery({ queryKey: ['client-portal', 'tickets', 'overview'], queryFn: () => listPortalTickets({ per_page: 5 }) });
    const profile = profileQuery.data;

    if (profileQuery.isLoading) return <p className="text-sm text-slate-600">Loading your portal...</p>;
    if (!profile) return <ErrorMessage error={profileQuery.error ?? new Error('Your account is not linked to a client profile.')} />;

    const activeWarranties = productsQuery.data?.data.filter((item) => item.warranty.status === 'active').length ?? 0;
    const activeTickets = ticketsQuery.data?.data.filter((ticket) => ticket.status !== 'closed' && ticket.status !== 'cancelled').length ?? 0;

    return <section className="space-y-6">
        <PageHeader title={`Welcome, ${profile.first_name}`} description="Track your products, warranties, service requests, and repair progress in one place." action={<Link className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to="/client/tickets/new"><Plus size={17} />New SAV request</Link>} />
        <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard icon={<PackageCheck size={20} />} label="Purchased products" value={productsQuery.data?.meta.total ?? 0} href="/client/products" />
            <SummaryCard icon={<ShieldCheck size={20} />} label="Active warranties shown" value={activeWarranties} href="/client/products?status=active" />
            <SummaryCard icon={<TicketCheck size={20} />} label="Active recent requests" value={activeTickets} href="/client/tickets" />
        </div>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Recent SAV requests</h3><p className="mt-1 text-sm text-slate-600">Your latest ticket and repair progress.</p></div><Link className="text-sm font-semibold text-blue-700" to="/client/tickets">View all</Link></div>
            <div className="mt-4 divide-y divide-slate-100">{ticketsQuery.data?.data.map((ticket) => <Link className="flex flex-wrap items-center justify-between gap-3 py-4 hover:text-blue-700" key={ticket.uuid} to={`/client/tickets/${ticket.uuid}`}><div><p className="font-semibold">{ticket.title}</p><p className="text-xs text-slate-500">{ticket.ticket_number} · {ticket.product?.name ?? 'Product'}</p></div><StatusBadge value={ticket.status} /></Link>)}{!ticketsQuery.isLoading && (ticketsQuery.data?.data.length ?? 0) === 0 && <p className="py-4 text-sm text-slate-500">You have not submitted an SAV request yet.</p>}</div>
        </section>
    </section>;
}

function SummaryCard({ icon, label, value, href }: { icon: ReactNode; label: string; value: number; href: string }) {
    return <Link className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md" to={href}><span className="inline-flex rounded-lg bg-blue-50 p-2 text-blue-700">{icon}</span><p className="mt-4 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-600">{label}</p></Link>;
}

export function ClientProfilePage() {
    const profileQuery = useQuery({ queryKey: ['client-portal', 'profile'], queryFn: getPortalProfile });
    const profile = profileQuery.data;
    if (profileQuery.isLoading) return <p className="text-sm text-slate-600">Loading your profile...</p>;
    if (!profile) return <ErrorMessage error={profileQuery.error ?? new Error('Profile unavailable.')} />;

    return <section className="max-w-4xl space-y-6"><PageHeader title="My profile" description="The identity and contact information associated with your service account." /><section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"><Detail label="Account type"><StatusBadge value={profile.type} /></Detail><Detail label="Display name">{profile.display_name}</Detail>{profile.company_name && <Detail label="Company">{profile.company_name}</Detail>}<Detail label="Contact name">{profile.first_name} {profile.last_name}</Detail><Detail label="Email">{profile.email ?? '—'}</Detail><Detail label="Phone">{profile.phone}</Detail><Detail label="City">{profile.city ?? '—'}</Detail><Detail label="Address">{profile.address ?? '—'}</Detail>{profile.tax_identifier && <Detail label="Tax identifier">{profile.tax_identifier}</Detail>}<Detail label="Customer since">{formatDate(profile.customer_since)}</Detail></section></section>;
}

export function ClientProductsPage() {
    const [searchParams] = useSearchParams();
    const initialStatus = searchParams.get('status');
    const [filters, setFilters] = useState<PortalProductFilters>({ per_page: 12, status: warrantyStatuses.includes(initialStatus as PortalWarrantyStatus) ? initialStatus as PortalWarrantyStatus : '' });
    const productsQuery = useQuery({ queryKey: ['client-portal', 'products', filters], queryFn: () => listPortalProducts(filters) });
    const updateFilters = (next: Partial<PortalProductFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    return <section className="space-y-6"><PageHeader title="My products & warranties" description="Only purchases registered to your client profile are shown." /><div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2"><input className={inputClassName} placeholder="Search product, SKU, model, or serial..." value={filters.search ?? ''} onChange={(event) => updateFilters({ search: event.target.value || undefined })} /><select className={inputClassName} value={filters.status ?? ''} onChange={(event) => updateFilters({ status: event.target.value as PortalWarrantyStatus | '' })}><option value="">All warranty statuses</option>{warrantyStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div><ErrorMessage error={productsQuery.error} />{productsQuery.isLoading ? <p className="text-sm text-slate-600">Loading purchased products...</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{productsQuery.data?.data.map((item) => <Link className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300" key={item.uuid} to={`/client/products/${item.uuid}`}><div className="flex items-start justify-between gap-3"><PackageCheck className="text-blue-700" size={22} /><StatusBadge value={item.warranty.status} /></div><div className="mt-4"><ProductName purchasedProduct={item} /></div><p className="mt-4 text-xs text-slate-500">Purchased {dateOnly(item.purchase_date)} · Warranty until {dateOnly(item.warranty.expires_at)}</p></Link>)}{productsQuery.data?.data.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No purchased products match these filters.</p>}</div>}{productsQuery.data && <Pagination meta={productsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</section>;
}

export function ClientProductDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const productQuery = useQuery({ queryKey: ['client-portal', 'products', uuid], queryFn: () => getPortalProduct(uuid ?? ''), enabled: uuid !== undefined });
    const item = productQuery.data;
    if (productQuery.isLoading) return <p className="text-sm text-slate-600">Loading product...</p>;
    if (!item) return <ErrorMessage error={productQuery.error ?? new Error('Purchased product not found.')} />;

    return <section className="max-w-5xl space-y-6"><PageHeader title={item.product?.name ?? 'Purchased product'} description={`${item.product?.sku ?? 'No SKU'} · ${item.product?.model ?? 'No model'}`} action={<Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to={`/client/tickets/new?product=${item.uuid}`}>Request service</Link>} /><section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-3"><Detail label="Warranty status"><StatusBadge value={item.warranty.status} /></Detail><Detail label="Coverage">{item.warranty.eligible ? 'Currently covered' : 'Not currently covered'}</Detail><Detail label="Serial number">{item.serial_number ?? '—'}</Detail><Detail label="Purchase date">{dateOnly(item.purchase_date)}</Detail><Detail label="Coverage starts">{dateOnly(item.warranty.starts_at)}</Detail><Detail label="Coverage ends">{dateOnly(item.warranty.expires_at)}</Detail><Detail label="Brand">{item.product?.brand ?? '—'}</Detail><Detail label="Category">{item.product?.category ?? '—'}</Detail><Detail label="Quantity">{item.quantity}</Detail>{item.product?.description && <div className="md:col-span-2 lg:col-span-3"><Detail label="Product description"><p className="whitespace-pre-wrap">{item.product.description}</p></Detail></div>}</section></section>;
}

export function ClientTicketsPage() {
    const [filters, setFilters] = useState<PortalTicketFilters>({ per_page: 10 });
    const ticketsQuery = useQuery({ queryKey: ['client-portal', 'tickets', filters], queryFn: () => listPortalTickets(filters) });
    const updateFilters = (next: Partial<PortalTicketFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    return <section className="space-y-6"><PageHeader title="My SAV requests" description="Follow every request opened for your client profile." action={<Link className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to="/client/tickets/new"><Plus size={17} />New request</Link>} /><div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2"><input className={inputClassName} placeholder="Search ticket, issue, or product..." value={filters.search ?? ''} onChange={(event) => updateFilters({ search: event.target.value || undefined })} /><select className={inputClassName} value={filters.status ?? ''} onChange={(event) => updateFilters({ status: event.target.value as TicketStatus | '' })}><option value="">All statuses</option>{ticketStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div><ErrorMessage error={ticketsQuery.error} />{ticketsQuery.isLoading ? <p className="text-sm text-slate-600">Loading SAV requests...</p> : <div className="space-y-3">{ticketsQuery.data?.data.map((ticket) => <TicketCard key={ticket.uuid} ticket={ticket} />)}{ticketsQuery.data?.data.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No SAV requests match these filters.</p>}</div>}{ticketsQuery.data && <Pagination meta={ticketsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</section>;
}

function TicketCard({ ticket }: { ticket: PortalTicket }) {
    return <Link className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300" to={`/client/tickets/${ticket.uuid}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{ticket.ticket_number}</p><h3 className="mt-1 font-bold text-slate-900">{ticket.title}</h3><p className="mt-1 text-sm text-slate-600">{ticket.product?.name ?? 'Product'} · Received {formatDate(ticket.received_at)}</p></div><StatusBadge value={ticket.status} /></div><p className="mt-3 line-clamp-2 text-sm text-slate-600">{ticket.problem_description}</p></Link>;
}

export const portalTicketSchema = z.object({
    purchased_product_uuid: z.string().uuid('Select one of your purchased products.'),
    title: z.string().min(3, 'Describe the issue in at least 3 characters.').max(255),
    problem_description: z.string().min(10, 'Provide at least 10 characters of detail.').max(10000),
});

type PortalTicketFormValues = z.infer<typeof portalTicketSchema>;

export function ClientTicketFormPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const selectedProduct = searchParams.get('product') ?? '';
    const productsQuery = useQuery({ queryKey: ['client-portal', 'products', 'ticket-form'], queryFn: () => listPortalProducts({ per_page: 50 }) });
    const selectedProductQuery = useQuery({ queryKey: ['client-portal', 'products', selectedProduct], queryFn: () => getPortalProduct(selectedProduct), enabled: selectedProduct !== '' });
    const form = useForm<PortalTicketFormValues>({ resolver: zodResolver(portalTicketSchema), defaultValues: { purchased_product_uuid: selectedProduct, title: '', problem_description: '' } });
    const mutation = useMutation({
        mutationFn: async (values: PortalTicketPayload) => {
            const ticket = await createPortalTicket(values);
            let failedUploads = 0;
            for (const file of files) {
                try {
                    await uploadPortalTicketAttachment(ticket.uuid, file, (progress) => setUploadProgress((current) => ({ ...current, [file.name]: progress.percentage })));
                } catch {
                    failedUploads += 1;
                }
            }

            return { ticket, failedUploads };
        },
        onSuccess: ({ ticket, failedUploads }) => {
            void queryClient.invalidateQueries({ queryKey: ['client-portal'] });
            navigate(`/client/tickets/${ticket.uuid}${failedUploads > 0 ? `?uploads_failed=${failedUploads}` : ''}`);
        },
    });
    const options = useMemo(() => {
        const available = productsQuery.data?.data ?? [];
        const selected = selectedProductQuery.data;
        return selected && !available.some((item) => item.uuid === selected.uuid) ? [selected, ...available] : available;
    }, [productsQuery.data, selectedProductQuery.data]);

    return <section className="max-w-3xl space-y-6"><PageHeader title="Submit an SAV request" description="Choose a registered purchase and describe the problem. The service team will triage priority and warranty coverage." /><form className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><Field label="Purchased product" error={form.formState.errors.purchased_product_uuid?.message}><select className={inputClassName} {...form.register('purchased_product_uuid')}><option value="">Select a product</option>{options.map((item) => <option key={item.uuid} value={item.uuid}>{item.product?.name ?? 'Product'} · {item.serial_number ?? item.product?.sku ?? item.uuid}</option>)}</select></Field><Field label="Issue summary" error={form.formState.errors.title?.message}><input className={inputClassName} placeholder="Example: Laptop no longer powers on" {...form.register('title')} /></Field><Field label="Problem description" error={form.formState.errors.problem_description?.message}><textarea className={inputClassName} rows={7} placeholder="Explain what happened, when it started, and any troubleshooting already attempted." {...form.register('problem_description')} /></Field><Field label="Photos or documents (optional)"><input className={inputClassName} type="file" multiple accept="image/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><span className="mt-1 block text-xs font-normal text-slate-500">Files are uploaded privately after the request is created.</span></Field>{files.length > 0 && <ul className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">{files.map((file) => <li className="flex justify-between gap-3" key={`${file.name}-${file.lastModified}`}><span className="truncate">{file.name}</span><span className="text-slate-500">{uploadProgress[file.name] !== undefined ? `${uploadProgress[file.name]}%` : formatBytes(file.size)}</span></li>)}</ul>}<ErrorMessage error={productsQuery.error ?? mutation.error} /><div className="flex justify-end gap-3"><Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" to="/client/tickets">Cancel</Link><button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={mutation.isPending || productsQuery.isLoading || options.length === 0}>{mutation.isPending ? 'Submitting...' : 'Submit request'}</button></div></form></section>;
}

export function ClientTicketDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const [searchParams] = useSearchParams();
    const ticketQuery = useQuery({ queryKey: ['client-portal', 'tickets', uuid], queryFn: () => getPortalTicket(uuid ?? ''), enabled: uuid !== undefined });
    const ticket = ticketQuery.data;
    useTicketRealtime(ticket?.id ?? null);

    if (ticketQuery.isLoading) return <p className="text-sm text-slate-600">Loading SAV request...</p>;
    if (!ticket) return <ErrorMessage error={ticketQuery.error ?? new Error('SAV request not found.')} />;

    return <section className="max-w-6xl space-y-6"><PageHeader title={ticket.title} description={`${ticket.ticket_number} · Received ${formatDate(ticket.received_at)}`} action={<Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" to="/client/tickets">Back to requests</Link>} />{searchParams.has('uploads_failed') && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">The request was created, but {searchParams.get('uploads_failed')} file(s) could not be uploaded. You can retry below.</p>}<section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-4"><Detail label="Status"><StatusBadge value={ticket.status} /></Detail><Detail label="Priority"><StatusBadge value={ticket.priority} /></Detail><Detail label="Product">{ticket.product?.name ?? '—'}</Detail><Detail label="Serial number">{ticket.warranty?.serial_number ?? '—'}</Detail><Detail label="Warranty"><StatusBadge value={ticket.warranty?.status ?? 'not_registered'} /></Detail><Detail label="Coverage at submission">{ticket.warranty_eligible ? 'Covered' : 'Not covered'}</Detail><Detail label="Assigned technician">{ticket.assigned_technician?.display_name ?? 'Pending assignment'}</Detail><Detail label="Closed">{formatDate(ticket.closed_at)}</Detail><div className="md:col-span-2 lg:col-span-4"><Detail label="Problem description"><p className="whitespace-pre-wrap">{ticket.problem_description}</p></Detail></div></section><TicketProgress ticket={ticket} />{ticket.repair_outcome && <RepairOutcome ticket={ticket} />}<AttachmentPanel resourceType="client/tickets" resourceKey={ticket.uuid} title="My photos and documents" canUpload={ticket.can_upload_attachments} canDelete={false} disabled={!ticket.can_upload_attachments} /></section>;
}

function TicketProgress({ ticket }: { ticket: PortalTicket }) {
    return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Ticket progress</h3><p className="mt-1 text-sm text-slate-600">Customer-safe status updates are shown here in chronological order.</p><div className="mt-5 space-y-5 border-l-2 border-slate-200 pl-6">{ticket.status_timeline.map((entry) => <article className="relative" key={entry.id}><span className="absolute -left-[1.92rem] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" /><p className="font-semibold text-slate-900">{humanize(entry.to_status)}</p><p className="mt-1 text-sm text-slate-500">{formatDate(entry.transitioned_at)}</p></article>)}</div></section>;
}

function RepairOutcome({ ticket }: { ticket: PortalTicket }) {
    const outcome = ticket.repair_outcome;
    if (!outcome) return null;

    return <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">Repair outcome</h3><p className="mt-1 text-sm text-slate-600">Technical information approved for customer visibility.</p></div>{outcome.result && <StatusBadge value={outcome.result} />}</div><div className="mt-5 grid gap-5 md:grid-cols-2"><Detail label="Diagnosis"><p className="whitespace-pre-wrap">{outcome.diagnosis ?? 'Diagnosis pending.'}</p></Detail><Detail label="Repair action"><p className="whitespace-pre-wrap">{outcome.repair_action ?? 'Repair action pending.'}</p></Detail><div className="md:col-span-2"><Detail label="Customer notes"><p className="whitespace-pre-wrap">{outcome.customer_notes ?? 'No customer notes have been added.'}</p></Detail></div><Detail label="Repair started">{formatDate(outcome.started_at)}</Detail><Detail label="Repair completed">{formatDate(outcome.completed_at)}</Detail></div></section>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <label className="block text-sm font-medium text-slate-800">{label}{children}{error && <span className="mt-1 block font-normal text-rose-700">{error}</span>}</label>;
}

function dateOnly(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
