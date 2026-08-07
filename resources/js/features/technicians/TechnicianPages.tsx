import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { listUsers } from '@/features/users/api';
import { archiveTechnician, createTechnician, getTechnician, listTechnicians, updateTechnician } from '@/features/technicians/api';
import type { TechnicianAvailabilityStatus, TechnicianFilters, TechnicianPayload, TechnicianProfile } from '@/features/technicians/types';
import { Can } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

const availabilityStatuses: TechnicianAvailabilityStatus[] = ['available', 'busy', 'unavailable', 'leave'];
const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
    return <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div>{action}</div>;
}

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p> : null;
}

export function TechniciansPage() {
    const [filters, setFilters] = useState<TechnicianFilters>({ per_page: 10, sort: 'created_at', direction: 'desc' });
    const [archiveTarget, setArchiveTarget] = useState<TechnicianProfile | null>(null);
    const queryClient = useQueryClient();
    const techniciansQuery = useQuery({ queryKey: ['technicians', filters], queryFn: () => listTechnicians(filters) });
    const archiveMutation = useMutation({ mutationFn: archiveTechnician, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['technicians'] }); setArchiveTarget(null); } });
    const updateFilters = (next: Partial<TechnicianFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    return <section className="space-y-6"><PageHeader title="Technicians" description="Track technical capacity, specialization, and current availability." action={<Can permission="users.create"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm" to="/admin/technicians/new">Add technician profile</Link></Can>} /><div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3"><input className={inputClassName} placeholder="Search technician or employee code…" value={filters.search ?? ''} onChange={(event) => updateFilters({ search: event.target.value || undefined })} /><select className={inputClassName} value={filters.availability_status ?? ''} onChange={(event) => updateFilters({ availability_status: event.target.value as TechnicianAvailabilityStatus | '' })}><option value="">All availability states</option>{availabilityStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><select className={inputClassName} value={filters.skill_level ?? ''} onChange={(event) => updateFilters({ skill_level: event.target.value === '' ? '' : Number(event.target.value) })}><option value="">All skill levels</option>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></div>{techniciansQuery.isLoading ? <p className="text-sm text-slate-600">Loading technicians…</p> : <><ErrorMessage error={techniciansQuery.error} /><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3 font-semibold">Technician</th><th className="px-4 py-3 font-semibold">Specialization</th><th className="px-4 py-3 font-semibold">Skill</th><th className="px-4 py-3 font-semibold">Availability</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{techniciansQuery.data?.data.map((technician) => <tr key={technician.id}><td className="px-4 py-3"><Link className="font-semibold text-slate-900 hover:text-blue-700" to={`/admin/technicians/${technician.id}`}>{technician.user?.first_name} {technician.user?.last_name}</Link><p className="mt-0.5 text-slate-500">{technician.employee_code}</p></td><td className="px-4 py-3 text-slate-600">{technician.specialization ?? '—'}</td><td className="px-4 py-3 text-slate-600">Level {technician.skill_level}</td><td className="px-4 py-3"><StatusBadge value={technician.availability_status} /></td><td className="px-4 py-3"><div className="flex justify-end gap-3"><Link className="font-medium text-blue-700" to={`/admin/technicians/${technician.id}`}>View</Link><Can permission="users.update"><Link className="font-medium text-blue-700" to={`/admin/technicians/${technician.id}/edit`}>Edit</Link></Can><Can permission="users.delete"><button className="font-medium text-rose-700" onClick={() => setArchiveTarget(technician)}>Archive</button></Can></div></td></tr>)}</tbody></table>{techniciansQuery.data?.data.length === 0 && <p className="p-6 text-center text-sm text-slate-600">No technicians match these filters.</p>}</div>{techniciansQuery.data && <Pagination meta={techniciansQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</>}<ConfirmDialog open={archiveTarget !== null} title="Archive technician profile" description={`Archive the technician profile for ${archiveTarget?.user?.first_name ?? ''} ${archiveTarget?.user?.last_name ?? ''}?`} confirmLabel="Archive profile" isPending={archiveMutation.isPending} onCancel={() => setArchiveTarget(null)} onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)} /></section>;
}

interface TechnicianFormValues {
    user_id: number;
    employee_code: string;
    specialization: string;
    skill_level: number;
    availability_status: TechnicianAvailabilityStatus;
    notes: string;
}

export function TechnicianFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditing = id !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const technicianQuery = useQuery({ queryKey: ['technicians', id], queryFn: () => getTechnician(id ?? ''), enabled: isEditing });
    const eligibleUsersQuery = useQuery({ queryKey: ['users', 'technician-candidates'], queryFn: () => listUsers({ role: 'technician', technician: false, per_page: 100, sort: 'first_name', direction: 'asc' }), enabled: !isEditing });
    const schema = useMemo(() => z.object({ user_id: z.number().int().positive('Select a technician user.'), employee_code: z.string().min(1, 'Employee code is required.').max(50).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, digits, hyphens, or underscores.'), specialization: z.string().max(150), skill_level: z.number().int().min(1).max(5), availability_status: z.enum(['available', 'busy', 'unavailable', 'leave']), notes: z.string().max(5000) }), []);
    const form = useForm<TechnicianFormValues>({ resolver: zodResolver(schema), defaultValues: { user_id: 0, employee_code: '', specialization: '', skill_level: 1, availability_status: 'available', notes: '' } });

    useEffect(() => {
        if (!technicianQuery.data) return;
        form.reset({ user_id: technicianQuery.data.user_id, employee_code: technicianQuery.data.employee_code, specialization: technicianQuery.data.specialization ?? '', skill_level: technicianQuery.data.skill_level, availability_status: technicianQuery.data.availability_status, notes: technicianQuery.data.notes ?? '' });
    }, [form, technicianQuery.data]);

    const saveMutation = useMutation({ mutationFn: (values: TechnicianFormValues) => { const payload: TechnicianPayload = { ...values, specialization: values.specialization || null, notes: values.notes || null }; return isEditing ? updateTechnician(Number(id), { employee_code: payload.employee_code, specialization: payload.specialization, skill_level: payload.skill_level, availability_status: payload.availability_status, notes: payload.notes }) : createTechnician(payload); }, onSuccess: (technician) => { void queryClient.invalidateQueries({ queryKey: ['technicians'] }); void queryClient.invalidateQueries({ queryKey: ['users'] }); navigate(`/admin/technicians/${technician.id}`); } });

    if (isEditing && technicianQuery.isLoading) return <p className="text-sm text-slate-600">Loading technician profile…</p>;

    return <section className="max-w-3xl space-y-6"><PageHeader title={isEditing ? 'Edit technician profile' : 'Add technician profile'} description={isEditing ? 'Update skills, specialization, and availability.' : 'The selected user must already have the technician role.'} /><form className="space-y-6 rounded-xl border border-slate-200 bg-white p-6" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>{isEditing ? <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-700">Assigned user: <strong>{technicianQuery.data?.user?.first_name} {technicianQuery.data?.user?.last_name}</strong> ({technicianQuery.data?.user?.email})</div> : <Field label="Technician user" error={form.formState.errors.user_id?.message}><select className={inputClassName} value={form.watch('user_id')} onChange={(event) => form.setValue('user_id', Number(event.target.value), { shouldValidate: true })}><option value={0}>Select a user</option>{eligibleUsersQuery.data?.data.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} — {user.email}</option>)}</select></Field>}<div className="grid gap-4 md:grid-cols-2"><Field label="Employee code" error={form.formState.errors.employee_code?.message}><input className={inputClassName} {...form.register('employee_code')} /></Field><Field label="Specialization" error={form.formState.errors.specialization?.message}><input className={inputClassName} placeholder="e.g. Consumer electronics" {...form.register('specialization')} /></Field><Field label="Skill level" error={form.formState.errors.skill_level?.message}><select className={inputClassName} value={form.watch('skill_level')} onChange={(event) => form.setValue('skill_level', Number(event.target.value), { shouldValidate: true })}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></Field><Field label="Availability" error={form.formState.errors.availability_status?.message}><select className={inputClassName} {...form.register('availability_status')}>{availabilityStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field></div><Field label="Notes" error={form.formState.errors.notes?.message}><textarea className={inputClassName} rows={5} {...form.register('notes')} /></Field><ErrorMessage error={saveMutation.error} /><div className="flex justify-end gap-3"><Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" to={isEditing ? `/admin/technicians/${id}` : '/admin/technicians'}>Cancel</Link><button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save profile'}</button></div></form></section>;
}

export function TechnicianDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const technicianQuery = useQuery({ queryKey: ['technicians', id], queryFn: () => getTechnician(id ?? ''), enabled: id !== undefined });
    const technician = technicianQuery.data;

    if (technicianQuery.isLoading) return <p className="text-sm text-slate-600">Loading technician profile…</p>;
    if (!technician) return <ErrorMessage error={technicianQuery.error ?? new Error('Technician profile not found.')} />;

    return <section className="max-w-3xl space-y-6"><PageHeader title={`${technician.user?.first_name ?? 'Technician'} ${technician.user?.last_name ?? ''}`} description={`Employee code: ${technician.employee_code}`} action={<Can permission="users.update"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to={`/admin/technicians/${technician.id}/edit`}>Edit profile</Link></Can>} /><div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2"><Detail label="Email" value={technician.user?.email ?? '—'} /><Detail label="Availability" value={<StatusBadge value={technician.availability_status} />} /><Detail label="Specialization" value={technician.specialization ?? '—'} /><Detail label="Skill level" value={`Level ${technician.skill_level}`} /><Detail label="Last updated" value={formatDate(technician.updated_at)} /><div className="md:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{technician.notes ?? 'No notes.'}</p></div></div></section>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <label className="block text-sm font-medium text-slate-800">{label}{children}{error && <span className="mt-1 block text-sm font-normal text-rose-700">{error}</span>}</label>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 text-sm text-slate-800">{value}</div></div>;
}
