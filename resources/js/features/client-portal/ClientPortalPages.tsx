import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    FileText,
    LoaderCircle,
    PackageCheck,
    PackageSearch,
    Plus,
    ShieldCheck,
    TicketCheck,
    Undo2,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AttachmentPanel } from '@/components/AttachmentPanel';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { FormField } from '@/components/FormField';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { EmptyState, PageSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    createPortalTicket,
    getPortalProduct,
    getPortalProfile,
    getPortalTicket,
    listPortalProducts,
    listPortalTickets,
    respondToPortalRepairApproval,
    uploadPortalTicketAttachment,
} from '@/features/client-portal/api';
import type {
    PortalProductFilters,
    PortalPurchasedProduct,
    PortalRepairApprovalPayload,
    PortalTicket,
    PortalTicketFilters,
    PortalTicketPayload,
    PortalWarrantyStatus,
} from '@/features/client-portal/types';
import type { TicketStatus } from '@/features/tickets/types';
import { useTicketRealtime } from '@/hooks/useRealtime';
import { cn } from '@/utils/cn';
import { formatDate, humanize } from '@/utils/format';

const warrantyStatuses: PortalWarrantyStatus[] = ['active', 'expired', 'void', 'replaced'];
const ticketStatuses: TicketStatus[] = [
    'opened',
    'received',
    'awaiting_diagnosis',
    'diagnosing',
    'awaiting_customer_approval',
    'awaiting_part',
    'repairing',
    'testing',
    'repaired',
    'ready_for_pickup',
    'delivered',
    'closed',
    'cancelled',
];

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <div className="mt-1.5 break-words text-sm leading-6 text-foreground">{children}</div>
        </div>
    );
}

function ProductName({ purchasedProduct }: { purchasedProduct: PortalPurchasedProduct }) {
    return (
        <div>
            <p className="font-semibold text-foreground">{purchasedProduct.product?.name ?? 'Product unavailable'}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {purchasedProduct.product?.model ?? purchasedProduct.product?.sku ?? 'No model'} ·{' '}
                {purchasedProduct.serial_number ?? 'No serial number'}
            </p>
        </div>
    );
}

function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading items">
            <span className="sr-only">Loading items...</span>
            {Array.from({ length: count }, (_, index) => (
                <Card key={index} className="p-5">
                    <div className="flex items-center justify-between gap-4">
                        <Skeleton className="size-9 rounded-lg" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="mt-5 h-5 w-3/5" />
                    <Skeleton className="mt-2 h-4 w-4/5" />
                    <Skeleton className="mt-5 h-3 w-2/3" />
                </Card>
            ))}
        </div>
    );
}

function TicketListSkeleton() {
    return (
        <div className="space-y-3" role="status" aria-label="Loading SAV requests">
            <span className="sr-only">Loading SAV requests...</span>
            {Array.from({ length: 5 }, (_, index) => (
                <Card key={index} className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-5 w-3/5" />
                            <Skeleton className="h-4 w-2/5" />
                        </div>
                        <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-4/5" />
                </Card>
            ))}
        </div>
    );
}

export function ClientOverviewPage() {
    const profileQuery = useQuery({ queryKey: ['client-portal', 'profile'], queryFn: getPortalProfile });
    const productsQuery = useQuery({
        queryKey: ['client-portal', 'products', 'overview'],
        queryFn: () => listPortalProducts({ per_page: 4 }),
    });
    const ticketsQuery = useQuery({
        queryKey: ['client-portal', 'tickets', 'overview'],
        queryFn: () => listPortalTickets({ per_page: 5 }),
    });
    const profile = profileQuery.data;

    if (profileQuery.isLoading) return <PageSkeleton />;
    if (!profile) return <ErrorMessage error={profileQuery.error ?? new Error('Your account is not linked to a client profile.')} />;

    const activeWarranties = productsQuery.data?.data.filter((item) => item.warranty.status === 'active').length ?? 0;
    const activeTickets =
        ticketsQuery.data?.data.filter((ticket) => ticket.status !== 'closed' && ticket.status !== 'cancelled').length ?? 0;

    return (
        <section className="space-y-6">
            <PageHeader
                title={`Welcome, ${profile.first_name}`}
                description="Track your products, warranties, service requests, and repair progress in one place."
                actions={
                    <Link className={cn(buttonVariants(), 'w-full sm:w-auto')} to="/client/tickets/new">
                        <Plus aria-hidden="true" />
                        New SAV request
                    </Link>
                }
            />
            <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard
                    icon={<PackageCheck size={20} />}
                    label="Purchased products"
                    value={productsQuery.data?.meta.total ?? 0}
                    href="/client/products"
                    isLoading={productsQuery.isLoading}
                />
                <SummaryCard
                    icon={<ShieldCheck size={20} />}
                    label="Active warranties shown"
                    value={activeWarranties}
                    href="/client/products?status=active"
                    isLoading={productsQuery.isLoading}
                />
                <SummaryCard
                    icon={<TicketCheck size={20} />}
                    label="Active recent requests"
                    value={activeTickets}
                    href="/client/tickets"
                    isLoading={ticketsQuery.isLoading}
                />
            </div>
            <ErrorMessage error={productsQuery.error ?? ticketsQuery.error} />
            <Card>
                <CardHeader className="border-b border-border">
                    <SectionHeader
                        title="Recent SAV requests"
                        description="Your latest ticket and repair progress."
                        actions={
                            <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/client/tickets">
                                View all
                            </Link>
                        }
                    />
                </CardHeader>
                <CardContent className="pt-0">
                    {ticketsQuery.isLoading && (
                        <div className="space-y-4 py-5" role="status" aria-label="Loading recent SAV requests">
                            <span className="sr-only">Loading recent SAV requests...</span>
                            {Array.from({ length: 3 }, (_, index) => (
                                <div className="flex items-center justify-between gap-4" key={index}>
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-2/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="divide-y divide-border">
                        {ticketsQuery.data?.data.map((ticket) => (
                            <Link
                                className="flex flex-col gap-3 rounded-md py-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                                key={ticket.uuid}
                                to={`/client/tickets/${ticket.uuid}`}
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-semibold">{ticket.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {ticket.ticket_number} · {ticket.product?.name ?? 'Product'}
                                    </p>
                                </div>
                                <StatusBadge value={ticket.status} />
                            </Link>
                        ))}
                        {!ticketsQuery.isLoading && (ticketsQuery.data?.data.length ?? 0) === 0 && (
                            <EmptyState
                                className="border-0"
                                compact
                                icon={TicketCheck}
                                title="You have not submitted an SAV request yet."
                                description="Create a request when one of your registered products needs service."
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}

function SummaryCard({
    icon,
    label,
    value,
    href,
    isLoading = false,
}: {
    icon: ReactNode;
    label: string;
    value: number;
    href: string;
    isLoading?: boolean;
}) {
    return (
        <Link
            className="group rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={href}
        >
            <span
                className="inline-flex rounded-lg bg-accent p-2 text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                aria-hidden="true"
            >
                {icon}
            </span>
            {isLoading ? <Skeleton className="mt-4 h-9 w-16" /> : <p className="mt-4 text-3xl font-bold text-foreground">{value}</p>}
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </Link>
    );
}

export function ClientProfilePage() {
    const profileQuery = useQuery({ queryKey: ['client-portal', 'profile'], queryFn: getPortalProfile });
    const profile = profileQuery.data;
    if (profileQuery.isLoading) return <PageSkeleton />;
    if (!profile) return <ErrorMessage error={profileQuery.error ?? new Error('Profile unavailable.')} />;

    return (
        <section className="max-w-4xl space-y-6">
            <PageHeader title="My profile" description="The identity and contact information associated with your service account." />
            <Card>
                <CardContent className="grid gap-x-8 gap-y-6 pt-5 sm:pt-6 md:grid-cols-2">
                    <Detail label="Account type">
                        <StatusBadge value={profile.type} />
                    </Detail>
                    <Detail label="Display name">{profile.display_name}</Detail>
                    {profile.company_name && <Detail label="Company">{profile.company_name}</Detail>}
                    <Detail label="Contact name">
                        {profile.first_name} {profile.last_name}
                    </Detail>
                    <Detail label="Email">{profile.email ?? '—'}</Detail>
                    <Detail label="Phone">{profile.phone}</Detail>
                    <Detail label="City">{profile.city ?? '—'}</Detail>
                    <Detail label="Address">{profile.address ?? '—'}</Detail>
                    {profile.tax_identifier && <Detail label="Tax identifier">{profile.tax_identifier}</Detail>}
                    <Detail label="Customer since">{formatDate(profile.customer_since)}</Detail>
                </CardContent>
            </Card>
        </section>
    );
}

export function ClientProductsPage() {
    const [searchParams] = useSearchParams();
    const initialStatus = searchParams.get('status');
    const [filters, setFilters] = useState<PortalProductFilters>({
        per_page: 12,
        status: warrantyStatuses.includes(initialStatus as PortalWarrantyStatus) ? (initialStatus as PortalWarrantyStatus) : '',
    });
    const productsQuery = useQuery({ queryKey: ['client-portal', 'products', filters], queryFn: () => listPortalProducts(filters) });
    const updateFilters = (next: Partial<PortalProductFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    return (
        <section className="space-y-6">
            <PageHeader title="My products & warranties" description="Only purchases registered to your client profile are shown." />
            <Card>
                <CardContent className="grid gap-4 pt-5 sm:pt-6 md:grid-cols-2">
                    <FormField label="Search products">
                        <Input
                            id="client-product-search"
                            type="search"
                            placeholder="Search product, SKU, model, or serial..."
                            value={filters.search ?? ''}
                            onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                        />
                    </FormField>
                    <FormField label="Warranty status">
                        <Select
                            id="client-product-warranty-status"
                            value={filters.status ?? ''}
                            onChange={(event) => updateFilters({ status: event.target.value as PortalWarrantyStatus | '' })}
                        >
                            <option value="">All warranty statuses</option>
                            {warrantyStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {humanize(status)}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                </CardContent>
            </Card>
            <ErrorMessage error={productsQuery.error} />
            {productsQuery.isLoading ? (
                <CardGridSkeleton />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {productsQuery.data?.data.map((item) => (
                        <Link
                            className="group rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            key={item.uuid}
                            to={`/client/products/${item.uuid}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <span className="rounded-lg bg-accent p-2 text-accent-foreground" aria-hidden="true">
                                    <PackageCheck size={20} />
                                </span>
                                <StatusBadge value={item.warranty.status} />
                            </div>
                            <div className="mt-4">
                                <ProductName purchasedProduct={item} />
                            </div>
                            <p className="mt-4 text-xs leading-5 text-muted-foreground">
                                Purchased {dateOnly(item.purchase_date)} · Warranty until {dateOnly(item.warranty.expires_at)}
                            </p>
                        </Link>
                    ))}
                    {productsQuery.data?.data.length === 0 && (
                        <Card className="col-span-full border-dashed">
                            <EmptyState
                                icon={PackageSearch}
                                title="No purchased products match these filters."
                                description="Try a different search term or warranty status."
                            />
                        </Card>
                    )}
                </div>
            )}
            {productsQuery.data && (
                <Pagination meta={productsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
            )}
        </section>
    );
}

export function ClientProductDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const productQuery = useQuery({
        queryKey: ['client-portal', 'products', uuid],
        queryFn: () => getPortalProduct(uuid ?? ''),
        enabled: uuid !== undefined,
    });
    const item = productQuery.data;
    if (productQuery.isLoading) return <PageSkeleton />;
    if (!item) return <ErrorMessage error={productQuery.error ?? new Error('Purchased product not found.')} />;

    return (
        <section className="max-w-5xl space-y-6">
            <PageHeader
                title={item.product?.name ?? 'Purchased product'}
                description={`${item.product?.sku ?? 'No SKU'} · ${item.product?.model ?? 'No model'}`}
                actions={
                    <Link className={cn(buttonVariants(), 'w-full sm:w-auto')} to={`/client/tickets/new?product=${item.uuid}`}>
                        Request service
                    </Link>
                }
            />
            <Card className="grid gap-x-8 gap-y-6 p-5 sm:p-6 md:grid-cols-2 lg:grid-cols-3">
                <Detail label="Warranty status">
                    <StatusBadge value={item.warranty.status} />
                </Detail>
                <Detail label="Coverage">{item.warranty.eligible ? 'Currently covered' : 'Not currently covered'}</Detail>
                <Detail label="Serial number">{item.serial_number ?? '—'}</Detail>
                <Detail label="Purchase date">{dateOnly(item.purchase_date)}</Detail>
                <Detail label="Coverage starts">{dateOnly(item.warranty.starts_at)}</Detail>
                <Detail label="Coverage ends">{dateOnly(item.warranty.expires_at)}</Detail>
                <Detail label="Brand">{item.product?.brand ?? '—'}</Detail>
                <Detail label="Category">{item.product?.category ?? '—'}</Detail>
                <Detail label="Quantity">{item.quantity}</Detail>
                {item.product?.description && (
                    <div className="md:col-span-2 lg:col-span-3">
                        <Detail label="Product description">
                            <p className="whitespace-pre-wrap">{item.product.description}</p>
                        </Detail>
                    </div>
                )}
            </Card>
        </section>
    );
}

export function ClientTicketsPage() {
    const [filters, setFilters] = useState<PortalTicketFilters>({ per_page: 10 });
    const ticketsQuery = useQuery({ queryKey: ['client-portal', 'tickets', filters], queryFn: () => listPortalTickets(filters) });
    const updateFilters = (next: Partial<PortalTicketFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    return (
        <section className="space-y-6">
            <PageHeader
                title="My SAV requests"
                description="Follow every request opened for your client profile."
                actions={
                    <Link className={cn(buttonVariants(), 'w-full sm:w-auto')} to="/client/tickets/new">
                        <Plus aria-hidden="true" />
                        New request
                    </Link>
                }
            />
            <Card>
                <CardContent className="grid gap-4 pt-5 sm:pt-6 md:grid-cols-2">
                    <FormField label="Search requests">
                        <Input
                            id="client-ticket-search"
                            type="search"
                            placeholder="Search ticket, issue, or product..."
                            value={filters.search ?? ''}
                            onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                        />
                    </FormField>
                    <FormField label="Request status">
                        <Select
                            id="client-ticket-status"
                            value={filters.status ?? ''}
                            onChange={(event) => updateFilters({ status: event.target.value as TicketStatus | '' })}
                        >
                            <option value="">All statuses</option>
                            {ticketStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {humanize(status)}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                </CardContent>
            </Card>
            <ErrorMessage error={ticketsQuery.error} />
            {ticketsQuery.isLoading ? (
                <TicketListSkeleton />
            ) : (
                <div className="space-y-3">
                    {ticketsQuery.data?.data.map((ticket) => (
                        <TicketCard key={ticket.uuid} ticket={ticket} />
                    ))}
                    {ticketsQuery.data?.data.length === 0 && (
                        <Card className="border-dashed">
                            <EmptyState
                                icon={TicketCheck}
                                title="No SAV requests match these filters."
                                description="Try another search or status, or create a new request when you need service."
                            />
                        </Card>
                    )}
                </div>
            )}
            {ticketsQuery.data && (
                <Pagination meta={ticketsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
            )}
        </section>
    );
}

function TicketCard({ ticket }: { ticket: PortalTicket }) {
    return (
        <Link
            className="block rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
            to={`/client/tickets/${ticket.uuid}`}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{ticket.ticket_number}</p>
                    <h2 className="mt-1 font-bold text-foreground">{ticket.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {ticket.product?.name ?? 'Product'} · Received {formatDate(ticket.received_at)}
                    </p>
                </div>
                <StatusBadge value={ticket.status} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{ticket.problem_description}</p>
        </Link>
    );
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
    const productsQuery = useQuery({
        queryKey: ['client-portal', 'products', 'ticket-form'],
        queryFn: () => listPortalProducts({ per_page: 50 }),
    });
    const selectedProductQuery = useQuery({
        queryKey: ['client-portal', 'products', selectedProduct],
        queryFn: () => getPortalProduct(selectedProduct),
        enabled: selectedProduct !== '',
    });
    const form = useForm<PortalTicketFormValues>({
        resolver: zodResolver(portalTicketSchema),
        defaultValues: { purchased_product_uuid: selectedProduct, title: '', problem_description: '' },
    });
    const mutation = useMutation({
        mutationFn: async (values: PortalTicketPayload) => {
            const ticket = await createPortalTicket(values);
            let failedUploads = 0;
            for (const file of files) {
                try {
                    await uploadPortalTicketAttachment(ticket.uuid, file, (progress) =>
                        setUploadProgress((current) => ({ ...current, [file.name]: progress.percentage })),
                    );
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

    return (
        <section className="max-w-3xl space-y-6">
            <PageHeader
                title="Submit an SAV request"
                description="Choose a registered purchase and describe the problem. The service team will triage priority and warranty coverage."
            />
            <form
                className="space-y-6 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
                noValidate
                aria-busy={mutation.isPending}
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            >
                <FormField
                    label="Purchased product"
                    error={form.formState.errors.purchased_product_uuid?.message}
                    hint={
                        productsQuery.isLoading
                            ? 'Loading products registered to your account...'
                            : options.length === 0
                              ? 'No eligible registered purchases are available. Contact support if a purchase is missing.'
                              : 'Only products registered to your client profile can be selected.'
                    }
                    required
                >
                    <Select
                        id="portal-ticket-product"
                        disabled={productsQuery.isLoading}
                        required
                        {...form.register('purchased_product_uuid')}
                    >
                        <option value="">Select a product</option>
                        {options.map((item) => (
                            <option key={item.uuid} value={item.uuid}>
                                {item.product?.name ?? 'Product'} · {item.serial_number ?? item.product?.sku ?? item.uuid}
                            </option>
                        ))}
                    </Select>
                </FormField>
                <FormField label="Issue summary" error={form.formState.errors.title?.message} required>
                    <Input
                        id="portal-ticket-title"
                        placeholder="Example: Laptop no longer powers on"
                        autoComplete="off"
                        required
                        {...form.register('title')}
                    />
                </FormField>
                <FormField label="Problem description" error={form.formState.errors.problem_description?.message} required>
                    <Textarea
                        id="portal-ticket-description"
                        rows={7}
                        placeholder="Explain what happened, when it started, and any troubleshooting already attempted."
                        required
                        {...form.register('problem_description')}
                    />
                </FormField>
                <FormField
                    label="Photos or documents (optional)"
                    hint="Files are uploaded privately after the request is created. Add photos, PDFs, or office documents that help explain the issue."
                >
                    <Input
                        id="portal-ticket-files"
                        className="h-auto cursor-pointer py-2 file:mr-3 file:rounded-md file:bg-muted file:px-3 file:py-1 file:text-foreground"
                        type="file"
                        multiple
                        accept="image/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.csv"
                        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    />
                </FormField>
                {files.length > 0 && (
                    <ul
                        className="space-y-3 rounded-lg border border-border bg-muted/45 p-3 text-sm"
                        aria-label="Selected files"
                        aria-live="polite"
                    >
                        {files.map((file) => (
                            <li className="space-y-2" key={`${file.name}-${file.lastModified}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                                        <FileText className="shrink-0 text-muted-foreground" size={16} aria-hidden="true" />
                                        <span className="truncate">{file.name}</span>
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {uploadProgress[file.name] !== undefined ? `${uploadProgress[file.name]}%` : formatBytes(file.size)}
                                    </span>
                                </div>
                                {uploadProgress[file.name] !== undefined && (
                                    <div
                                        className="h-1.5 overflow-hidden rounded-full bg-border"
                                        role="progressbar"
                                        aria-label={`Uploading ${file.name}`}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={uploadProgress[file.name]}
                                    >
                                        <div
                                            className="h-full rounded-full bg-primary transition-[width]"
                                            style={{ width: `${uploadProgress[file.name]}%` }}
                                        />
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <ErrorMessage error={productsQuery.error ?? selectedProductQuery.error ?? mutation.error} />
                <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <Link className={cn(buttonVariants({ variant: 'outline' }), 'w-full sm:w-auto')} to="/client/tickets">
                        Cancel
                    </Link>
                    <Button
                        className="w-full sm:w-auto"
                        type="submit"
                        disabled={mutation.isPending || productsQuery.isLoading || options.length === 0}
                    >
                        {mutation.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                        {mutation.isPending ? 'Submitting...' : 'Submit request'}
                    </Button>
                </div>
            </form>
        </section>
    );
}

export function ClientTicketDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const [searchParams] = useSearchParams();
    const ticketQuery = useQuery({
        queryKey: ['client-portal', 'tickets', uuid],
        queryFn: () => getPortalTicket(uuid ?? ''),
        enabled: uuid !== undefined,
    });
    const ticket = ticketQuery.data;
    const queryClient = useQueryClient();
    useTicketRealtime(ticket?.id ?? null);

    const updateTicket = (updatedTicket: PortalTicket) => {
        queryClient.setQueryData(['client-portal', 'tickets', uuid], updatedTicket);
        void queryClient.invalidateQueries({
            queryKey: ['client-portal', 'tickets'],
            exact: false,
            refetchType: 'none',
        });
    };

    if (ticketQuery.isLoading) return <PageSkeleton />;
    if (!ticket) return <ErrorMessage error={ticketQuery.error ?? new Error('SAV request not found.')} />;

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader
                title={ticket.title}
                description={`${ticket.ticket_number} · Received ${formatDate(ticket.received_at)}`}
                actions={
                    <Link className={cn(buttonVariants({ variant: 'outline' }), 'w-full sm:w-auto')} to="/client/tickets">
                        <ArrowLeft aria-hidden="true" />
                        Back to requests
                    </Link>
                }
            />
            {searchParams.has('uploads_failed') && (
                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40" role="alert">
                    <AlertTriangle className="text-amber-700 dark:text-amber-400" aria-hidden="true" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                        The request was created, but {searchParams.get('uploads_failed')} file(s) could not be uploaded. You can retry
                        below.
                    </AlertDescription>
                </Alert>
            )}
            <Card className="grid gap-x-8 gap-y-6 p-5 sm:p-6 md:grid-cols-2 lg:grid-cols-4">
                <Detail label="Status">
                    <StatusBadge value={ticket.status} />
                </Detail>
                <Detail label="Priority">
                    <StatusBadge value={ticket.priority} />
                </Detail>
                <Detail label="Product">{ticket.product?.name ?? '—'}</Detail>
                <Detail label="Serial number">{ticket.warranty?.serial_number ?? '—'}</Detail>
                <Detail label="Warranty">
                    <StatusBadge value={ticket.warranty?.status ?? 'not_registered'} />
                </Detail>
                <Detail label="Coverage at submission">{ticket.warranty_eligible ? 'Covered' : 'Not covered'}</Detail>
                <Detail label="Assigned technician">{ticket.assigned_technician?.display_name ?? 'Pending assignment'}</Detail>
                <Detail label="Closed">{formatDate(ticket.closed_at)}</Detail>
                <div className="md:col-span-2 lg:col-span-4">
                    <Detail label="Problem description">
                        <p className="whitespace-pre-wrap">{ticket.problem_description}</p>
                    </Detail>
                </div>
            </Card>
            {ticket.can_respond_to_repair_approval && <RepairApprovalPanel ticket={ticket} onUpdated={updateTicket} />}
            <TicketProgress ticket={ticket} />
            {ticket.repair_outcome && !ticket.can_respond_to_repair_approval && <RepairOutcome ticket={ticket} />}
            <AttachmentPanel
                resourceType="client/tickets"
                resourceKey={ticket.uuid}
                title="My photos and documents"
                canUpload={ticket.can_upload_attachments}
                canDelete={false}
                disabled={!ticket.can_upload_attachments}
            />
        </section>
    );
}

function RepairApprovalPanel({ ticket, onUpdated }: { ticket: PortalTicket; onUpdated: (ticket: PortalTicket) => void }) {
    const [notes, setNotes] = useState('');
    const mutation = useMutation({
        mutationFn: (decision: PortalRepairApprovalPayload['decision']) =>
            respondToPortalRepairApproval(ticket.uuid, {
                decision,
                notes: notes.trim() === '' ? null : notes.trim(),
            }),
        onSuccess: (updatedTicket) => {
            setNotes('');
            onUpdated(updatedTicket);
        },
    });

    return (
        <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25">
            <CardHeader className="border-b border-amber-200 dark:border-amber-900">
                <SectionHeader
                    title="Your approval is required"
                    description="The technician is waiting for your decision before continuing this repair."
                />
            </CardHeader>
            <CardContent className="space-y-5 pt-5 sm:pt-6">
                {ticket.repair_outcome?.customer_notes && (
                    <div className="rounded-lg border border-amber-200 bg-card p-4 dark:border-amber-900">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Service team message</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{ticket.repair_outcome.customer_notes}</p>
                    </div>
                )}
                <FormField label="Message to the technician (optional)" hint="Add a question or condition before sending your decision.">
                    <Textarea
                        maxLength={2000}
                        rows={3}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Add an optional message"
                    />
                </FormField>
                <ErrorMessage error={mutation.error} />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button
                        className="w-full sm:w-auto"
                        type="button"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate('changes_requested')}
                    >
                        {mutation.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
                        Request changes
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate('approved')}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" aria-hidden="true" />
                        ) : (
                            <CheckCircle2 aria-hidden="true" />
                        )}
                        {mutation.isPending ? 'Sending decision...' : 'Approve repair'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function TicketProgress({ ticket }: { ticket: PortalTicket }) {
    return (
        <Card>
            <CardHeader className="border-b border-border">
                <SectionHeader title="Ticket progress" description="Customer-safe status updates are shown here in chronological order." />
            </CardHeader>
            <CardContent className="pt-5 sm:pt-6">
                {ticket.status_timeline.length === 0 ? (
                    <EmptyState
                        compact
                        icon={TicketCheck}
                        title="No progress updates yet."
                        description="The service team will post customer-visible updates here as your request moves forward."
                    />
                ) : (
                    <ol className="space-y-0" aria-label="Ticket status history">
                        {ticket.status_timeline.map((entry, index) => (
                            <li className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-6 last:pb-0" key={entry.id}>
                                {index < ticket.status_timeline.length - 1 && (
                                    <span
                                        className="absolute left-[0.34rem] top-4 h-[calc(100%-0.5rem)] w-px bg-border"
                                        aria-hidden="true"
                                    />
                                )}
                                <span className="relative mt-1 size-3 rounded-full bg-primary ring-4 ring-card" aria-hidden="true" />
                                <div>
                                    <p className="font-semibold text-foreground">{humanize(entry.to_status)}</p>
                                    <time
                                        className="mt-1 block text-sm text-muted-foreground"
                                        dateTime={entry.transitioned_at ?? undefined}
                                    >
                                        {formatDate(entry.transitioned_at)}
                                    </time>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}

function RepairOutcome({ ticket }: { ticket: PortalTicket }) {
    const outcome = ticket.repair_outcome;
    if (!outcome) return null;

    return (
        <Card className="border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900 dark:bg-emerald-950/25 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-foreground">Repair outcome</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Technical information approved for customer visibility.</p>
                </div>
                {outcome.result && <StatusBadge value={outcome.result} />}
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Detail label="Diagnosis">
                    <p className="whitespace-pre-wrap">{outcome.diagnosis ?? 'Diagnosis pending.'}</p>
                </Detail>
                <Detail label="Repair action">
                    <p className="whitespace-pre-wrap">{outcome.repair_action ?? 'Repair action pending.'}</p>
                </Detail>
                <div className="md:col-span-2">
                    <Detail label="Customer notes">
                        <p className="whitespace-pre-wrap">{outcome.customer_notes ?? 'No customer notes have been added.'}</p>
                    </Detail>
                </div>
                <Detail label="Repair started">{formatDate(outcome.started_at)}</Detail>
                <Detail label="Repair completed">{formatDate(outcome.completed_at)}</Detail>
            </div>
        </Card>
    );
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
