import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { listUsers } from '@/features/users/api';
import {
    archiveTechnician,
    createTechnician,
    getOwnTechnicianProfile,
    getTechnician,
    listTechnicians,
    updateOwnTechnicianProfile,
    updateTechnician,
} from '@/features/technicians/api';
import type {
    TechnicianAvailabilityStatus,
    TechnicianFilters,
    TechnicianPayload,
    TechnicianProfile,
    TechnicianSelfProfilePayload,
} from '@/features/technicians/types';
import { Can } from '@/hooks/usePermissions';
import { formatDate, humanize } from '@/utils/format';

const availabilityStatuses: TechnicianAvailabilityStatus[] = ['available', 'busy', 'unavailable', 'leave'];

export function TechniciansPage() {
    const [filters, setFilters] = useState<TechnicianFilters>({ per_page: 10, sort: 'created_at', direction: 'desc' });
    const [archiveTarget, setArchiveTarget] = useState<TechnicianProfile | null>(null);
    const queryClient = useQueryClient();
    const techniciansQuery = useQuery({ queryKey: ['technicians', filters], queryFn: () => listTechnicians(filters) });
    const archiveMutation = useMutation({
        mutationFn: archiveTechnician,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['technicians'] });
            setArchiveTarget(null);
        },
    });
    const updateFilters = (next: Partial<TechnicianFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));
    const columns: DataTableColumn<TechnicianProfile>[] = [
        {
            id: 'technician',
            header: 'Technician',
            cell: (technician) => (
                <div className="min-w-52">
                    <Link
                        className="font-semibold text-foreground hover:text-primary hover:underline"
                        to={`/admin/technicians/${technician.id}`}
                    >
                        {technician.user?.first_name} {technician.user?.last_name}
                    </Link>
                    <p className="mt-0.5 text-muted-foreground">{technician.employee_code}</p>
                </div>
            ),
        },
        {
            id: 'specialization',
            header: 'Specialization',
            cell: (technician) => <span className="text-muted-foreground">{technician.specialization ?? '—'}</span>,
        },
        {
            id: 'skill',
            header: 'Skill',
            cell: (technician) => <span className="whitespace-nowrap text-muted-foreground">Level {technician.skill_level}</span>,
        },
        {
            id: 'availability',
            header: 'Availability',
            cell: (technician) => <StatusBadge value={technician.availability_status} />,
        },
        {
            id: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (technician) => (
                <div className="flex min-w-max flex-wrap justify-end gap-1">
                    <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/technicians/${technician.id}`}>
                        View
                    </Link>
                    <Can permission="users.update">
                        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/technicians/${technician.id}/edit`}>
                            Edit
                        </Link>
                    </Can>
                    <Can permission="users.delete">
                        <Button
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            variant="ghost"
                            size="sm"
                            onClick={() => setArchiveTarget(technician)}
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
                title="Technicians"
                description="Track technical capacity, specialization, and current availability."
                actions={
                    <Can permission="users.create">
                        <Link className={buttonVariants()} to="/admin/technicians/new">
                            Add technician profile
                        </Link>
                    </Can>
                }
            />
            <Card className="grid gap-3 bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <label>
                    <span className="sr-only">Search technicians</span>
                    <Input
                        type="search"
                        placeholder="Search technician or employee code…"
                        value={filters.search ?? ''}
                        onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                    />
                </label>
                <label>
                    <span className="sr-only">Filter by availability</span>
                    <Select
                        value={filters.availability_status ?? ''}
                        onChange={(event) =>
                            updateFilters({ availability_status: event.target.value as TechnicianAvailabilityStatus | '' })
                        }
                    >
                        <option value="">All availability states</option>
                        {availabilityStatuses.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </Select>
                </label>
                <label className="sm:col-span-2 lg:col-span-1">
                    <span className="sr-only">Filter by skill level</span>
                    <Select
                        value={filters.skill_level ?? ''}
                        onChange={(event) => updateFilters({ skill_level: event.target.value === '' ? '' : Number(event.target.value) })}
                    >
                        <option value="">All skill levels</option>
                        {[1, 2, 3, 4, 5].map((level) => (
                            <option key={level} value={level}>
                                Level {level}
                            </option>
                        ))}
                    </Select>
                </label>
            </Card>
            {techniciansQuery.isLoading ? (
                <TableSkeleton rows={6} columns={5} />
            ) : techniciansQuery.error ? (
                <ErrorState
                    title="Unable to load technicians"
                    description={
                        getApiErrorMessage(techniciansQuery.error, 'The technician list could not be loaded.') ??
                        'The technician list could not be loaded.'
                    }
                    onRetry={() => void techniciansQuery.refetch()}
                />
            ) : (
                <>
                    <DataTable
                        rows={techniciansQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(technician) => technician.id}
                        ariaLabel="Technicians"
                        emptyMessage="No technicians match these filters."
                        emptyDescription="Try changing or clearing one of the filters above."
                    />
                    {techniciansQuery.data && (
                        <Pagination
                            meta={techniciansQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}
            <ConfirmDialog
                open={archiveTarget !== null}
                title="Archive technician profile"
                description={`Archive the technician profile for ${archiveTarget?.user?.first_name ?? ''} ${archiveTarget?.user?.last_name ?? ''}?`}
                confirmLabel="Archive profile"
                isPending={archiveMutation.isPending}
                onCancel={() => setArchiveTarget(null)}
                onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
            />
        </section>
    );
}

interface TechnicianFormValues {
    user_id: number;
    employee_code: string;
    specialization: string;
    skill_level: number;
    availability_status: TechnicianAvailabilityStatus;
    notes: string;
}

const technicianSelfProfileSchema = z.object({
    first_name: z.string().trim().min(1, 'First name is required.').max(100),
    last_name: z.string().trim().min(1, 'Last name is required.').max(100),
    email: z.string().trim().email('Enter a valid email address.').max(255),
    phone: z.string().trim().max(30),
    specialization: z.string().trim().max(150),
    availability_status: z.enum(['available', 'busy', 'unavailable', 'leave']),
});

type TechnicianSelfProfileFormValues = z.infer<typeof technicianSelfProfileSchema>;

export function TechnicianSelfProfilePage() {
    const queryClient = useQueryClient();
    const [wasSaved, setWasSaved] = useState(false);
    const profileQuery = useQuery({ queryKey: ['technicians', 'me'], queryFn: getOwnTechnicianProfile });
    const form = useForm<TechnicianSelfProfileFormValues>({
        resolver: zodResolver(technicianSelfProfileSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            specialization: '',
            availability_status: 'available',
        },
    });

    useEffect(() => {
        const profile = profileQuery.data;
        if (!profile?.user) return;

        form.reset({
            first_name: profile.user.first_name,
            last_name: profile.user.last_name,
            email: profile.user.email,
            phone: profile.user.phone ?? '',
            specialization: profile.specialization ?? '',
            availability_status: profile.availability_status,
        });
    }, [form, profileQuery.data]);

    const saveMutation = useMutation({
        mutationFn: (values: TechnicianSelfProfileFormValues) => {
            const payload: TechnicianSelfProfilePayload = {
                ...values,
                phone: values.phone || null,
                specialization: values.specialization || null,
            };

            return updateOwnTechnicianProfile(payload);
        },
        onMutate: () => setWasSaved(false),
        onSuccess: (profile) => {
            queryClient.setQueryData(['technicians', 'me'], profile);
            void queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
            setWasSaved(true);
        },
    });

    if (profileQuery.isLoading) return <PageSkeleton />;
    if (!profileQuery.data?.user) {
        return (
            <ErrorState
                title="Technician profile unavailable"
                description={
                    getApiErrorMessage(profileQuery.error, 'Your technician profile could not be loaded.') ??
                    'Your technician profile could not be loaded.'
                }
                onRetry={() => void profileQuery.refetch()}
            />
        );
    }

    const profile = profileQuery.data;

    return (
        <section className="max-w-4xl space-y-6">
            <PageHeader
                title="My technician profile"
                description="Keep your contact information, specialization, and current availability up to date."
            />
            {wasSaved && (
                <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40" role="status">
                    <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                        Your profile was updated successfully.
                    </AlertDescription>
                </Alert>
            )}
            <form className="space-y-6" noValidate onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <Card className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
                    <Detail label="Employee code" value={profile.employee_code} />
                    <Detail label="Skill level" value={`Level ${profile.skill_level}`} />
                    <p className="text-xs leading-5 text-muted-foreground md:col-span-2">
                        Employee code, skill level, and internal notes are managed by an administrator.
                    </p>
                </Card>
                <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
                    <FormField required label="First name" error={form.formState.errors.first_name?.message}>
                        <Input autoComplete="given-name" {...form.register('first_name')} />
                    </FormField>
                    <FormField required label="Last name" error={form.formState.errors.last_name?.message}>
                        <Input autoComplete="family-name" {...form.register('last_name')} />
                    </FormField>
                    <FormField required label="Email" error={form.formState.errors.email?.message}>
                        <Input type="email" autoComplete="email" {...form.register('email')} />
                    </FormField>
                    <FormField label="Phone" error={form.formState.errors.phone?.message}>
                        <Input type="tel" autoComplete="tel" {...form.register('phone')} />
                    </FormField>
                    <FormField label="Specialization" error={form.formState.errors.specialization?.message}>
                        <Input placeholder="e.g. Consumer electronics" {...form.register('specialization')} />
                    </FormField>
                    <FormField
                        required
                        label="Availability"
                        hint="This status helps SAV agents assign work to technicians who are ready."
                        error={form.formState.errors.availability_status?.message}
                    >
                        <Select {...form.register('availability_status')}>
                            {availabilityStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {humanize(status)}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                </Card>
                <ErrorMessage error={saveMutation.error} />
                <div className="flex justify-end">
                    <Button type="submit" disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? 'Saving...' : 'Save changes'}
                    </Button>
                </div>
            </form>
        </section>
    );
}

export function TechnicianFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditing = id !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const technicianQuery = useQuery({ queryKey: ['technicians', id], queryFn: () => getTechnician(id ?? ''), enabled: isEditing });
    const eligibleUsersQuery = useQuery({
        queryKey: ['users', 'technician-candidates'],
        queryFn: () => listUsers({ role: 'technician', technician: false, per_page: 100, sort: 'first_name', direction: 'asc' }),
        enabled: !isEditing,
    });
    const schema = useMemo(
        () =>
            z.object({
                user_id: z.number().int().positive('Select a technician user.'),
                employee_code: z
                    .string()
                    .min(1, 'Employee code is required.')
                    .max(50)
                    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, digits, hyphens, or underscores.'),
                specialization: z.string().max(150),
                skill_level: z.number().int().min(1).max(5),
                availability_status: z.enum(['available', 'busy', 'unavailable', 'leave']),
                notes: z.string().max(5000),
            }),
        [],
    );
    const form = useForm<TechnicianFormValues>({
        resolver: zodResolver(schema),
        defaultValues: { user_id: 0, employee_code: '', specialization: '', skill_level: 1, availability_status: 'available', notes: '' },
    });

    useEffect(() => {
        if (!technicianQuery.data) return;
        form.reset({
            user_id: technicianQuery.data.user_id,
            employee_code: technicianQuery.data.employee_code,
            specialization: technicianQuery.data.specialization ?? '',
            skill_level: technicianQuery.data.skill_level,
            availability_status: technicianQuery.data.availability_status,
            notes: technicianQuery.data.notes ?? '',
        });
    }, [form, technicianQuery.data]);

    const saveMutation = useMutation({
        mutationFn: (values: TechnicianFormValues) => {
            const payload: TechnicianPayload = { ...values, specialization: values.specialization || null, notes: values.notes || null };
            return isEditing
                ? updateTechnician(Number(id), {
                      employee_code: payload.employee_code,
                      specialization: payload.specialization,
                      skill_level: payload.skill_level,
                      availability_status: payload.availability_status,
                      notes: payload.notes,
                  })
                : createTechnician(payload);
        },
        onSuccess: (technician) => {
            void queryClient.invalidateQueries({ queryKey: ['technicians'] });
            void queryClient.invalidateQueries({ queryKey: ['users'] });
            navigate(`/admin/technicians/${technician.id}`);
        },
    });

    if (isEditing && technicianQuery.isLoading) return <PageSkeleton />;
    if (isEditing && !technicianQuery.data && technicianQuery.error) {
        return (
            <ErrorState
                title="Unable to load technician"
                description={
                    getApiErrorMessage(technicianQuery.error, 'The technician profile could not be loaded.') ??
                    'The technician profile could not be loaded.'
                }
                onRetry={() => void technicianQuery.refetch()}
            />
        );
    }

    return (
        <section className="max-w-3xl space-y-6">
            <PageHeader
                title={isEditing ? 'Edit technician profile' : 'Add technician profile'}
                description={
                    isEditing
                        ? 'Update skills, specialization, and availability.'
                        : 'The selected user must already have the technician role.'
                }
            />
            <form
                className="space-y-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
                onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            >
                {isEditing ? (
                    <div className="rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                        Assigned user:{' '}
                        <strong className="text-foreground">
                            {technicianQuery.data?.user?.first_name} {technicianQuery.data?.user?.last_name}
                        </strong>{' '}
                        ({technicianQuery.data?.user?.email})
                    </div>
                ) : (
                    <FormField required label="Technician user" error={form.formState.errors.user_id?.message}>
                        <Select
                            required
                            value={form.watch('user_id')}
                            onChange={(event) => form.setValue('user_id', Number(event.target.value), { shouldValidate: true })}
                        >
                            <option value={0}>Select a user</option>
                            {eligibleUsersQuery.data?.data.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.first_name} {user.last_name} — {user.email}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                )}
                {!isEditing && <ErrorMessage error={eligibleUsersQuery.error} />}
                <div className="grid gap-4 md:grid-cols-2">
                    <FormField required label="Employee code" error={form.formState.errors.employee_code?.message}>
                        <Input required {...form.register('employee_code')} />
                    </FormField>
                    <FormField label="Specialization" error={form.formState.errors.specialization?.message}>
                        <Input placeholder="e.g. Consumer electronics" {...form.register('specialization')} />
                    </FormField>
                    <FormField required label="Skill level" error={form.formState.errors.skill_level?.message}>
                        <Select
                            required
                            value={form.watch('skill_level')}
                            onChange={(event) => form.setValue('skill_level', Number(event.target.value), { shouldValidate: true })}
                        >
                            {[1, 2, 3, 4, 5].map((level) => (
                                <option key={level} value={level}>
                                    Level {level}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField required label="Availability" error={form.formState.errors.availability_status?.message}>
                        <Select required {...form.register('availability_status')}>
                            {availabilityStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                </div>
                <FormField label="Notes" error={form.formState.errors.notes?.message}>
                    <Textarea rows={5} {...form.register('notes')} />
                </FormField>
                <ErrorMessage error={saveMutation.error} />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link
                        className={buttonVariants({ variant: 'outline' })}
                        to={isEditing ? `/admin/technicians/${id}` : '/admin/technicians'}
                    >
                        Cancel
                    </Link>
                    <Button type="submit" disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? 'Saving…' : 'Save profile'}
                    </Button>
                </div>
            </form>
        </section>
    );
}

export function TechnicianDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const technicianQuery = useQuery({ queryKey: ['technicians', id], queryFn: () => getTechnician(id ?? ''), enabled: id !== undefined });
    const technician = technicianQuery.data;

    if (technicianQuery.isLoading) return <PageSkeleton />;
    if (!technician) {
        return (
            <ErrorState
                title="Technician unavailable"
                description={
                    getApiErrorMessage(technicianQuery.error, 'The requested technician profile could not be found.') ??
                    'The requested technician profile could not be found.'
                }
                onRetry={() => void technicianQuery.refetch()}
            />
        );
    }

    return (
        <section className="max-w-3xl space-y-6">
            <PageHeader
                title={`${technician.user?.first_name ?? 'Technician'} ${technician.user?.last_name ?? ''}`}
                description={`Employee code: ${technician.employee_code}`}
                actions={
                    <Can permission="users.update">
                        <Link className={buttonVariants()} to={`/admin/technicians/${technician.id}/edit`}>
                            Edit profile
                        </Link>
                    </Can>
                }
            />
            <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
                <Detail label="Email" value={technician.user?.email ?? '—'} />
                <Detail label="Availability" value={<StatusBadge value={technician.availability_status} />} />
                <Detail label="Specialization" value={technician.specialization ?? '—'} />
                <Detail label="Skill level" value={`Level ${technician.skill_level}`} />
                <Detail label="Last updated" value={formatDate(technician.updated_at)} />
                <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{technician.notes ?? 'No notes.'}</p>
                </div>
            </Card>
        </section>
    );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1 break-words text-sm text-foreground">{value}</div>
        </div>
    );
}
