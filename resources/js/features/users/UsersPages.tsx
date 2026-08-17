import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { listClients } from '@/features/clients/api';
import { archiveUser, createUser, getUser, listRoles, listUsers, updateUser } from '@/features/users/api';
import type { ManagedUser, UserFilters, UserPayload, UserStatus } from '@/features/users/types';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

const userStatuses: UserStatus[] = ['active', 'invited', 'suspended', 'archived'];
const inputClassName =
    'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

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

    return (
        <section className="space-y-6">
            <PageHeader
                title="Users"
                description="Manage staff and linked client portal accounts."
                action={
                    <Can permission="users.create">
                        <Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm" to="/admin/users/new">
                            Add user
                        </Link>
                    </Can>
                }
            />
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <input
                    className={inputClassName}
                    placeholder="Search name, email, phone..."
                    value={filters.search ?? ''}
                    onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                />
                <select
                    className={inputClassName}
                    value={filters.status ?? ''}
                    onChange={(event) => updateFilters({ status: event.target.value as UserStatus | '' })}
                >
                    <option value="">All statuses</option>
                    {userStatuses.map((status) => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>
                <select
                    className={inputClassName}
                    value={filters.role ?? ''}
                    onChange={(event) => updateFilters({ role: event.target.value || undefined })}
                >
                    <option value="">All roles</option>
                    {['super_admin', 'admin', 'sav_agent', 'technician', 'client'].map((role) => (
                        <option key={role} value={role}>
                            {role}
                        </option>
                    ))}
                </select>
                <select
                    className={inputClassName}
                    value={filters.technician === undefined ? '' : String(filters.technician)}
                    onChange={(event) =>
                        updateFilters({ technician: event.target.value === '' ? undefined : event.target.value === 'true' })
                    }
                >
                    <option value="">All account types</option>
                    <option value="true">Technicians only</option>
                    <option value="false">Without technician profile</option>
                </select>
            </div>
            {usersQuery.isLoading ? (
                <p className="text-sm text-slate-600">Loading users...</p>
            ) : (
                <>
                    <ErrorMessage error={usersQuery.error} />
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50 text-left text-slate-600">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">User</th>
                                    <th className="px-4 py-3 font-semibold">Roles</th>
                                    <th className="px-4 py-3 font-semibold">Client profile</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">Last login</th>
                                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {usersQuery.data?.data.map((user) => (
                                    <tr key={user.uuid}>
                                        <td className="px-4 py-3">
                                            <Link
                                                className="font-semibold text-slate-900 hover:text-blue-700"
                                                to={`/admin/users/${user.uuid}`}
                                            >
                                                {user.first_name} {user.last_name}
                                            </Link>
                                            <p className="mt-0.5 text-slate-500">{user.email}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles.map((role) => (
                                                    <span key={role} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{user.client?.display_name ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge value={user.status} />
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{formatDate(user.last_login_at)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-3">
                                                <Link className="font-medium text-blue-700" to={`/admin/users/${user.uuid}`}>
                                                    View
                                                </Link>
                                                {canManage(user) && (
                                                    <Can permission="users.update">
                                                        <Link className="font-medium text-blue-700" to={`/admin/users/${user.uuid}/edit`}>
                                                            Edit
                                                        </Link>
                                                    </Can>
                                                )}
                                                {canManage(user) && (
                                                    <Can permission="users.delete">
                                                        <button
                                                            className="font-medium text-rose-700"
                                                            onClick={() => setArchiveTarget(user)}
                                                        >
                                                            Archive
                                                        </button>
                                                    </Can>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {usersQuery.data?.data.length === 0 && (
                            <p className="p-6 text-center text-sm text-slate-600">No users match these filters.</p>
                        )}
                    </div>
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

    if (isEditing && userQuery.isLoading) return <p className="text-sm text-slate-600">Loading user...</p>;

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
                className="space-y-6 rounded-xl border border-slate-200 bg-white p-6"
                onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First name" error={form.formState.errors.first_name?.message}>
                        <input className={inputClassName} {...form.register('first_name')} />
                    </Field>
                    <Field label="Last name" error={form.formState.errors.last_name?.message}>
                        <input className={inputClassName} {...form.register('last_name')} />
                    </Field>
                    <Field label="Email" error={form.formState.errors.email?.message}>
                        <input className={inputClassName} type="email" {...form.register('email')} />
                    </Field>
                    <Field label="Phone" error={form.formState.errors.phone?.message}>
                        <input className={inputClassName} {...form.register('phone')} />
                    </Field>
                    <Field label="Status" error={form.formState.errors.status?.message}>
                        <select className={inputClassName} {...form.register('status')}>
                            {userStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Locale" error={form.formState.errors.locale?.message}>
                        <input className={inputClassName} {...form.register('locale')} />
                    </Field>
                    <Field label="Timezone" error={form.formState.errors.timezone?.message}>
                        <input className={inputClassName} {...form.register('timezone')} />
                    </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field
                        label={isEditing ? 'New password (optional)' : 'Initial password'}
                        error={form.formState.errors.password?.message}
                    >
                        <input className={inputClassName} type="password" autoComplete="new-password" {...form.register('password')} />
                    </Field>
                    <Field label="Confirm password" error={form.formState.errors.password_confirmation?.message}>
                        <input
                            className={inputClassName}
                            type="password"
                            autoComplete="new-password"
                            {...form.register('password_confirmation')}
                        />
                    </Field>
                </div>
                <fieldset>
                    <legend className="text-sm font-semibold text-slate-900">Roles</legend>
                    <p className="mt-1 text-sm text-slate-600">
                        Client portal accounts must use the client role alone and be linked to one client profile.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                        {assignableRoles?.map((role) => (
                            <label key={role} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                                <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} />
                                {role}
                            </label>
                        ))}
                    </div>
                    {form.formState.errors.roles?.message && (
                        <p className="mt-2 text-sm text-rose-700">{form.formState.errors.roles.message}</p>
                    )}
                </fieldset>
                {selectedRoles.includes('client') && (
                    <Field label="Linked client profile" error={form.formState.errors.client_id?.message}>
                        <select
                            className={inputClassName}
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
                        </select>
                    </Field>
                )}
                <ErrorMessage error={clientsQuery.error ?? saveMutation.error} />
                <div className="flex justify-end gap-3">
                    <Link
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                        to={isEditing ? `/admin/users/${uuid}` : '/admin/users'}
                    >
                        Cancel
                    </Link>
                    <button
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        disabled={saveMutation.isPending}
                    >
                        {saveMutation.isPending ? 'Saving...' : 'Save user'}
                    </button>
                </div>
            </form>
        </section>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <label className="block text-sm font-medium text-slate-800">
            {label}
            {children}
            {error && <span className="mt-1 block text-sm font-normal text-rose-700">{error}</span>}
        </label>
    );
}

export function UserDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const { roles } = usePermissions();
    const userQuery = useQuery({ queryKey: ['users', uuid], queryFn: () => getUser(uuid ?? ''), enabled: uuid !== undefined });
    const user = userQuery.data;
    const canManage = roles.includes('super_admin') || !user?.roles.some((role) => role === 'super_admin' || role === 'admin');
    if (userQuery.isLoading) return <p className="text-sm text-slate-600">Loading user...</p>;
    if (!user) return <ErrorMessage error={userQuery.error ?? new Error('User not found.')} />;

    return (
        <section className="max-w-3xl space-y-6">
            <PageHeader
                title={`${user.first_name} ${user.last_name}`}
                description="Account details and assigned access."
                action={
                    canManage ? (
                        <Can permission="users.update">
                            <Link
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                                to={`/admin/users/${user.uuid}/edit`}
                            >
                                Edit user
                            </Link>
                        </Can>
                    ) : undefined
                }
            />
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2">
                <Detail label="Email" value={user.email} />
                <Detail label="Phone" value={user.phone ?? '—'} />
                <Detail label="Status" value={<StatusBadge value={user.status} />} />
                <Detail label="Last login" value={formatDate(user.last_login_at)} />
                <Detail label="Locale" value={user.locale} />
                <Detail label="Timezone" value={user.timezone} />
                {user.client && (
                    <div className="md:col-span-2 rounded-lg bg-blue-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Linked client portal profile</p>
                        <Link className="mt-1 inline-block font-semibold text-blue-900" to={`/admin/clients/${user.client.uuid}`}>
                            {user.client.display_name}
                        </Link>
                    </div>
                )}
                <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {user.roles.map((role) => (
                            <span key={role} className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-700">
                                {role}
                            </span>
                        ))}
                    </div>
                </div>
                {user.technician && (
                    <div className="md:col-span-2 rounded-lg bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">Technician profile</p>
                        <p className="mt-1 text-sm text-slate-600">
                            {user.technician.employee_code} · <StatusBadge value={user.technician.availability_status} />
                        </p>
                        <Link
                            className="mt-3 inline-block text-sm font-medium text-blue-700"
                            to={`/admin/technicians/${user.technician.id}`}
                        >
                            View technician profile
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <div className="mt-1 text-sm text-slate-800">{value}</div>
        </div>
    );
}
