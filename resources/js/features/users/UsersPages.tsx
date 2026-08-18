import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiErrorAlert as ErrorMessage, getApiErrorMessage } from '@/components/ApiErrorAlert';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, PageSkeleton, TableSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { listClients } from '@/features/clients/api';
import { archiveUser, createUser, getUser, listRoles, listUsers, updateUser } from '@/features/users/api';
import type { ManagedUser, UserFilters, UserPayload, UserStatus } from '@/features/users/types';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

const userStatuses: UserStatus[] = ['active', 'invited', 'suspended', 'archived'];

export function UsersPage() {
    const [filters, setFilters] = useState<UserFilters>({ per_page: 10, sort: 'created_at', direction: 'desc' });
    const [archiveTarget, setArchiveTarget] = useState<ManagedUser | null>(null);
    const queryClient = useQueryClient();
    const { roles } = usePermissions();
    const usersQuery = useQuery({ queryKey: ['users', filters], queryFn: () => listUsers(filters) });
    const archiveMutation = useMutation({
        mutationFn: archiveUser,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['users'] });
            setArchiveTarget(null);
        },
    });
    const canManagePrivilegedAccounts = roles.includes('super_admin');
    const updateFilters = (next: Partial<UserFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));
    const canManage = (user: ManagedUser) =>
        canManagePrivilegedAccounts || !user.roles.some((role) => role === 'super_admin' || role === 'admin');
    const columns: DataTableColumn<ManagedUser>[] = [
        {
            id: 'user',
            header: 'User',
            cell: (user) => (
                <div className="min-w-48">
                    <Link className="font-semibold text-foreground hover:text-primary hover:underline" to={`/admin/users/${user.uuid}`}>
                        {user.first_name} {user.last_name}
                    </Link>
                    <p className="mt-0.5 text-muted-foreground">{user.email}</p>
                </div>
            ),
        },
        {
            id: 'roles',
            header: 'Roles',
            cell: (user) => (
                <div className="flex min-w-36 flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                        <Badge key={role} variant="outline">
                            {role}
                        </Badge>
                    ))}
                </div>
            ),
        },
        {
            id: 'client',
            header: 'Client profile',
            cell: (user) => <span className="text-muted-foreground">{user.client?.display_name ?? '—'}</span>,
        },
        { id: 'status', header: 'Status', cell: (user) => <StatusBadge value={user.status} /> },
        {
            id: 'last-login',
            header: 'Last login',
            cell: (user) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(user.last_login_at)}</span>,
        },
        {
            id: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (user) => (
                <div className="flex min-w-max flex-wrap justify-end gap-1">
                    <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/users/${user.uuid}`}>
                        View
                    </Link>
                    {canManage(user) && (
                        <Can permission="users.update">
                            <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/users/${user.uuid}/edit`}>
                                Edit
                            </Link>
                        </Can>
                    )}
                    {canManage(user) && (
                        <Can permission="users.delete">
                            <Button
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                variant="ghost"
                                size="sm"
                                onClick={() => setArchiveTarget(user)}
                            >
                                Archive
                            </Button>
                        </Can>
                    )}
                </div>
            ),
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader
                title="Users"
                description="Manage staff and linked client portal accounts."
                actions={
                    <Can permission="users.create">
                        <Link className={buttonVariants()} to="/admin/users/new">
                            Add user
                        </Link>
                    </Can>
                }
            />
            <Card className="grid gap-3 bg-muted/30 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <label>
                    <span className="sr-only">Search users</span>
                    <Input
                        type="search"
                        placeholder="Search name, email, phone..."
                        value={filters.search ?? ''}
                        onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                    />
                </label>
                <label>
                    <span className="sr-only">Filter by status</span>
                    <Select
                        value={filters.status ?? ''}
                        onChange={(event) => updateFilters({ status: event.target.value as UserStatus | '' })}
                    >
                        <option value="">All statuses</option>
                        {userStatuses.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </Select>
                </label>
                <label>
                    <span className="sr-only">Filter by role</span>
                    <Select value={filters.role ?? ''} onChange={(event) => updateFilters({ role: event.target.value || undefined })}>
                        <option value="">All roles</option>
                        {['super_admin', 'admin', 'sav_agent', 'technician', 'client'].map((role) => (
                            <option key={role} value={role}>
                                {role}
                            </option>
                        ))}
                    </Select>
                </label>
                <label>
                    <span className="sr-only">Filter by account type</span>
                    <Select
                        value={filters.technician === undefined ? '' : String(filters.technician)}
                        onChange={(event) =>
                            updateFilters({ technician: event.target.value === '' ? undefined : event.target.value === 'true' })
                        }
                    >
                        <option value="">All account types</option>
                        <option value="true">Technicians only</option>
                        <option value="false">Without technician profile</option>
                    </Select>
                </label>
            </Card>
            {usersQuery.isLoading ? (
                <TableSkeleton rows={6} columns={6} />
            ) : usersQuery.error ? (
                <ErrorState
                    title="Unable to load users"
                    description={
                        getApiErrorMessage(usersQuery.error, 'The user list could not be loaded.') ?? 'The user list could not be loaded.'
                    }
                    onRetry={() => void usersQuery.refetch()}
                />
            ) : (
                <>
                    <DataTable
                        rows={usersQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(user) => user.uuid}
                        ariaLabel="Users"
                        emptyMessage="No users match these filters."
                        emptyDescription="Try changing or clearing one of the filters above."
                    />
                    {usersQuery.data && (
                        <Pagination meta={usersQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
                    )}
                </>
            )}
            <ConfirmDialog
                open={archiveTarget !== null}
                title="Archive user"
                description={`Archive ${archiveTarget?.first_name ?? ''} ${archiveTarget?.last_name ?? ''}? They will no longer be able to sign in.`}
                confirmLabel="Archive user"
                isPending={archiveMutation.isPending}
                onCancel={() => setArchiveTarget(null)}
                onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.uuid)}
            />
        </section>
    );
}

interface UserFormValues {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    status: UserStatus;
    locale: string;
    timezone: string;
    client_id: number | null;
    password: string;
    password_confirmation: string;
    roles: string[];
}

export function UserFormPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const isEditing = uuid !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { roles: actorRoles } = usePermissions();
    const userQuery = useQuery({ queryKey: ['users', uuid], queryFn: () => getUser(uuid ?? ''), enabled: isEditing });
    const rolesQuery = useQuery({ queryKey: ['users', 'roles'], queryFn: listRoles });
    const schema = useMemo(
        () =>
            z
                .object({
                    first_name: z.string().min(1, 'First name is required.').max(100),
                    last_name: z.string().min(1, 'Last name is required.').max(100),
                    email: z.string().email('Enter a valid email address.'),
                    phone: z.string().max(30),
                    status: z.enum(['active', 'invited', 'suspended', 'archived']),
                    locale: z.string().min(2).max(10),
                    timezone: z.string().min(1),
                    client_id: z.number().int().positive().nullable(),
                    password: z.string(),
                    password_confirmation: z.string(),
                    roles: z.array(z.string()).min(1, 'Select at least one role.'),
                })
                .superRefine((values, context) => {
                    if (!isEditing && values.password.length === 0)
                        context.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'An initial password is required.' });
                    if (values.password.length > 0 && values.password.length < 12)
                        context.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'Use at least 12 characters.' });
                    if (values.password !== values.password_confirmation)
                        context.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['password_confirmation'],
                            message: 'Passwords do not match.',
                        });
                    if (values.roles.includes('client') && values.roles.length !== 1)
                        context.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['roles'],
                            message: 'The client role cannot be combined with staff roles.',
                        });
                    if (values.roles.includes('client') && values.client_id === null)
                        context.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['client_id'],
                            message: 'Select the client profile for this portal account.',
                        });
                }),
        [isEditing],
    );
    const form = useForm<UserFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            status: 'invited',
            locale: 'fr',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Casablanca',
            client_id: null,
            password: '',
            password_confirmation: '',
            roles: [],
        },
    });

    useEffect(() => {
        if (!userQuery.data) return;
        form.reset({
            first_name: userQuery.data.first_name,
            last_name: userQuery.data.last_name,
            email: userQuery.data.email,
            phone: userQuery.data.phone ?? '',
            status: userQuery.data.status,
            locale: userQuery.data.locale,
            timezone: userQuery.data.timezone,
            client_id: userQuery.data.client_id,
            password: '',
            password_confirmation: '',
            roles: userQuery.data.roles,
        });
    }, [form, userQuery.data]);

    const saveMutation = useMutation({
        mutationFn: (values: UserFormValues) => {
            const payload: UserPayload = {
                ...values,
                phone: values.phone || null,
                password: values.password || undefined,
                password_confirmation: values.password ? values.password_confirmation : undefined,
            };
            return isEditing ? updateUser(uuid ?? '', payload) : createUser(payload);
        },
        onSuccess: (user) => {
            void queryClient.invalidateQueries({ queryKey: ['users'] });
            navigate(`/admin/users/${user.uuid}`);
        },
    });
    const selectedRoles = form.watch('roles');
    const selectedClientId = form.watch('client_id');
    const clientsQuery = useQuery({
        queryKey: ['clients', 'user-form'],
        queryFn: () => listClients({ per_page: 100, sort: 'created_at', direction: 'desc' }),
        enabled: selectedRoles.includes('client'),
    });
    const assignableRoles = rolesQuery.data?.filter(
        (role) => actorRoles.includes('super_admin') || (role !== 'super_admin' && role !== 'admin'),
    );
    const toggleRole = (role: string) => {
        if (role === 'client') {
            form.setValue('roles', selectedRoles.includes('client') ? [] : ['client'], { shouldValidate: true });
            if (selectedRoles.includes('client')) form.setValue('client_id', null, { shouldValidate: true });
            return;
        }

        const staffRoles = selectedRoles.filter((item) => item !== 'client');
        form.setValue('roles', staffRoles.includes(role) ? staffRoles.filter((item) => item !== role) : [...staffRoles, role], {
            shouldValidate: true,
        });
        form.setValue('client_id', null, { shouldValidate: true });
    };

    if (isEditing && userQuery.isLoading) return <PageSkeleton />;
    if (isEditing && !userQuery.data && userQuery.error) {
        return (
            <ErrorState
                title="Unable to load user"
                description={getApiErrorMessage(userQuery.error, 'The user could not be loaded.') ?? 'The user could not be loaded.'}
                onRetry={() => void userQuery.refetch()}
            />
        );
    }

    return (
        <section className="max-w-3xl space-y-6">
            <PageHeader
                title={isEditing ? 'Edit user' : 'Add user'}
                description={
                    isEditing
                        ? 'Update account details, status, roles, and client link.'
                        : 'Create a staff or linked client portal account.'
                }
            />
            <form
                className="space-y-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
                onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <FormField required label="First name" error={form.formState.errors.first_name?.message}>
                        <Input required {...form.register('first_name')} />
                    </FormField>
                    <FormField required label="Last name" error={form.formState.errors.last_name?.message}>
                        <Input required {...form.register('last_name')} />
                    </FormField>
                    <FormField required label="Email" error={form.formState.errors.email?.message}>
                        <Input required type="email" autoComplete="email" {...form.register('email')} />
                    </FormField>
                    <FormField label="Phone" error={form.formState.errors.phone?.message}>
                        <Input type="tel" autoComplete="tel" {...form.register('phone')} />
                    </FormField>
                    <FormField required label="Status" error={form.formState.errors.status?.message}>
                        <Select required {...form.register('status')}>
                            {userStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField required label="Locale" error={form.formState.errors.locale?.message}>
                        <Input required {...form.register('locale')} />
                    </FormField>
                    <FormField required label="Timezone" error={form.formState.errors.timezone?.message}>
                        <Input required {...form.register('timezone')} />
                    </FormField>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                        required={!isEditing}
                        label={isEditing ? 'New password (optional)' : 'Initial password'}
                        error={form.formState.errors.password?.message}
                    >
                        <Input required={!isEditing} type="password" autoComplete="new-password" {...form.register('password')} />
                    </FormField>
                    <FormField required={!isEditing} label="Confirm password" error={form.formState.errors.password_confirmation?.message}>
                        <Input
                            required={!isEditing}
                            type="password"
                            autoComplete="new-password"
                            {...form.register('password_confirmation')}
                        />
                    </FormField>
                </div>
                <fieldset
                    className="rounded-lg border border-border p-4"
                    aria-describedby={form.formState.errors.roles?.message ? 'user-roles-error' : 'user-roles-hint'}
                    aria-invalid={form.formState.errors.roles?.message ? true : undefined}
                    aria-required="true"
                >
                    <legend className="px-1 text-sm font-semibold text-foreground">
                        Roles
                        <span className="ml-1 text-destructive" aria-hidden="true">
                            *
                        </span>
                    </legend>
                    <p id="user-roles-hint" className="text-sm text-muted-foreground">
                        Client portal accounts must use the client role alone and be linked to one client profile.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {assignableRoles?.map((role) => (
                            <label
                                key={role}
                                className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                            >
                                <input
                                    className="size-4 accent-primary"
                                    type="checkbox"
                                    checked={selectedRoles.includes(role)}
                                    onChange={() => toggleRole(role)}
                                />
                                {role}
                            </label>
                        ))}
                    </div>
                    {form.formState.errors.roles?.message && (
                        <p id="user-roles-error" className="mt-2 text-xs font-medium text-destructive" role="alert">
                            {form.formState.errors.roles.message}
                        </p>
                    )}
                </fieldset>
                {selectedRoles.includes('client') && (
                    <FormField required label="Linked client profile" error={form.formState.errors.client_id?.message}>
                        <Select
                            required
                            value={selectedClientId ?? ''}
                            onChange={(event) =>
                                form.setValue('client_id', event.target.value === '' ? null : Number(event.target.value), {
                                    shouldValidate: true,
                                })
                            }
                        >
                            <option value="">Select a client profile</option>
                            {clientsQuery.data?.data.map((client) => (
                                <option key={client.uuid} value={client.id}>
                                    {client.display_name} · {client.email ?? client.phone}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                )}
                <ErrorMessage error={rolesQuery.error ?? clientsQuery.error ?? saveMutation.error} />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link className={buttonVariants({ variant: 'outline' })} to={isEditing ? `/admin/users/${uuid}` : '/admin/users'}>
                        Cancel
                    </Link>
                    <Button type="submit" disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? 'Saving...' : 'Save user'}
                    </Button>
                </div>
            </form>
        </section>
    );
}

export function UserDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const { roles } = usePermissions();
    const userQuery = useQuery({ queryKey: ['users', uuid], queryFn: () => getUser(uuid ?? ''), enabled: uuid !== undefined });
    const user = userQuery.data;
    const canManage = roles.includes('super_admin') || !user?.roles.some((role) => role === 'super_admin' || role === 'admin');
    if (userQuery.isLoading) return <PageSkeleton />;
    if (!user) {
        return (
            <ErrorState
                title="User unavailable"
                description={
                    getApiErrorMessage(userQuery.error, 'The requested user could not be found.') ??
                    'The requested user could not be found.'
                }
                onRetry={() => void userQuery.refetch()}
            />
        );
    }

    return (
        <section className="max-w-3xl space-y-6">
            <PageHeader
                title={`${user.first_name} ${user.last_name}`}
                description="Account details and assigned access."
                actions={
                    canManage ? (
                        <Can permission="users.update">
                            <Link className={buttonVariants()} to={`/admin/users/${user.uuid}/edit`}>
                                Edit user
                            </Link>
                        </Can>
                    ) : undefined
                }
            />
            <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
                <Detail label="Email" value={user.email} />
                <Detail label="Phone" value={user.phone ?? '—'} />
                <Detail label="Status" value={<StatusBadge value={user.status} />} />
                <Detail label="Last login" value={formatDate(user.last_login_at)} />
                <Detail label="Locale" value={user.locale} />
                <Detail label="Timezone" value={user.timezone} />
                {user.client && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Linked client portal profile</p>
                        <Link
                            className="mt-1 inline-block font-semibold text-foreground hover:text-primary"
                            to={`/admin/clients/${user.client.uuid}`}
                        >
                            {user.client.display_name}
                        </Link>
                    </div>
                )}
                <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {user.roles.map((role) => (
                            <Badge key={role} variant="outline">
                                {role}
                            </Badge>
                        ))}
                    </div>
                </div>
                {user.technician && (
                    <div className="rounded-lg bg-muted/60 p-4 md:col-span-2">
                        <p className="font-semibold text-foreground">Technician profile</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span>{user.technician.employee_code}</span>
                            <span aria-hidden="true">·</span>
                            <StatusBadge value={user.technician.availability_status} />
                        </div>
                        <Link
                            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                            to={`/admin/technicians/${user.technician.id}`}
                        >
                            View technician profile
                        </Link>
                    </div>
                )}
            </Card>
        </section>
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
