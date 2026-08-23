import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Play, Save } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { AttachmentPanel } from '@/components/AttachmentPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FormField } from '@/components/FormField';
import { PageHeader as SharedPageHeader } from '@/components/PageHeader';
import { PageSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { completeRepair, getRepair, listRepairs, recordDiagnosis, startRepair, updateRepair } from '@/features/repairs/api';
import type { Repair, RepairCompletionPayload, RepairDiagnosisPayload, RepairFilters, RepairUpdatePayload } from '@/features/repairs/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useTicketRealtime } from '@/hooks/useRealtime';
import { formatDate, humanize } from '@/utils/format';

const inputClassName =
    'mt-1 min-h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20';

const moneySchema = z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/, 'Enter a non-negative amount with up to two decimals.');
const diagnosisSchema = z.object({
    diagnosis: z.string().trim().min(3, 'Describe the diagnosis.').max(10_000),
    root_cause: z.string().trim().max(10_000),
    customer_notes: z.string().trim().max(10_000),
    labor_cost: moneySchema,
    parts_cost: moneySchema,
    next_status: z.enum(['awaiting_customer_approval', 'awaiting_part', 'repairing']),
});
const repairUpdateSchema = z.object({
    repair_action: z.string().trim().max(10_000),
    internal_notes: z.string().trim().max(10_000),
    customer_notes: z.string().trim().max(10_000),
    labor_cost: moneySchema,
    parts_cost: moneySchema,
});
const completionSchema = z.object({
    result: z.enum(['repaired', 'partially_repaired', 'unrepairable', 'replacement_required']),
    customer_notes: z.string().trim().max(10_000),
});

type DiagnosisValues = z.infer<typeof diagnosisSchema>;
type RepairUpdateValues = z.infer<typeof repairUpdateSchema>;
type CompletionValues = z.infer<typeof completionSchema>;

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <SharedPageHeader title={title} description={description} actions={action} />;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1.5 break-words text-sm text-foreground">{value}</div>
        </div>
    );
}

function formatAmount(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'MAD' }).format(amount) : '--';
}

function emptyToNull(value: string): string | null {
    const normalized = value.trim();
    return normalized === '' ? null : normalized;
}

function WorkflowField({
    label,
    error,
    hint,
    required = false,
    children,
}: {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: ReactElement;
}) {
    return (
        <FormField label={label} error={error} hint={hint} required={required}>
            {children}
        </FormField>
    );
}

export function TechnicianRepairWorkflow({ repair, onUpdated }: { repair: Repair; onUpdated: (repair: Repair) => void }) {
    const diagnosisForm = useForm<DiagnosisValues>({
        resolver: zodResolver(diagnosisSchema),
        defaultValues: {
            diagnosis: repair.diagnosis ?? '',
            root_cause: repair.root_cause ?? '',
            customer_notes: repair.customer_notes ?? '',
            labor_cost: repair.labor_cost,
            parts_cost: repair.parts_cost,
            next_status: 'awaiting_part',
        },
    });
    const updateForm = useForm<RepairUpdateValues>({
        resolver: zodResolver(repairUpdateSchema),
        defaultValues: {
            repair_action: repair.repair_action ?? '',
            internal_notes: repair.internal_notes ?? '',
            customer_notes: repair.customer_notes ?? '',
            labor_cost: repair.labor_cost,
            parts_cost: repair.parts_cost,
        },
    });
    const completionForm = useForm<CompletionValues>({
        resolver: zodResolver(completionSchema),
        defaultValues: { result: 'repaired', customer_notes: repair.customer_notes ?? '' },
    });
    const [pendingCompletion, setPendingCompletion] = useState<CompletionValues | null>(null);

    const diagnosisMutation = useMutation({
        mutationFn: (values: DiagnosisValues) =>
            recordDiagnosis(repair.id, {
                ...values,
                root_cause: emptyToNull(values.root_cause),
                customer_notes: emptyToNull(values.customer_notes),
            } satisfies RepairDiagnosisPayload),
        onSuccess: (updatedRepair) => {
            setPendingCompletion(null);
            onUpdated(updatedRepair);
        },
    });
    const startMutation = useMutation({
        mutationFn: () => startRepair(repair.id),
        onSuccess: (updatedRepair) => onUpdated(updatedRepair),
    });
    const updateMutation = useMutation({
        mutationFn: (values: RepairUpdateValues) =>
            updateRepair(repair.id, {
                repair_action: emptyToNull(values.repair_action),
                internal_notes: emptyToNull(values.internal_notes),
                customer_notes: emptyToNull(values.customer_notes),
                labor_cost: values.labor_cost,
                parts_cost: values.parts_cost,
            } satisfies RepairUpdatePayload),
        onSuccess: (updatedRepair) => {
            updateForm.reset({
                repair_action: updatedRepair.repair_action ?? '',
                internal_notes: updatedRepair.internal_notes ?? '',
                customer_notes: updatedRepair.customer_notes ?? '',
                labor_cost: updatedRepair.labor_cost,
                parts_cost: updatedRepair.parts_cost,
            });
            onUpdated(updatedRepair);
        },
    });
    const completionMutation = useMutation({
        mutationFn: (values: CompletionValues) =>
            completeRepair(repair.id, {
                result: values.result,
                customer_notes: emptyToNull(values.customer_notes),
            } satisfies RepairCompletionPayload),
        onSuccess: (updatedRepair) => onUpdated(updatedRepair),
    });

    const isComplete = repair.completed_at !== null;
    const canRecordDiagnosis = !isComplete && repair.ticket?.status === 'diagnosing';
    const canStartRepair = !isComplete && repair.started_at === null && repair.ticket?.status === 'awaiting_part';
    const canCompleteRepair = !isComplete && repair.started_at !== null;

    if (isComplete) return null;

    return (
        <section
            className="space-y-6 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 shadow-sm sm:p-6"
            aria-labelledby="repair-workflow-title"
        >
            <ConfirmDialog
                open={pendingCompletion !== null}
                title="Complete this repair?"
                description={`This records the final outcome${pendingCompletion ? ` as ${humanize(pendingCompletion.result)}` : ''} and completes the repair workflow.`}
                confirmLabel="Complete repair"
                isPending={completionMutation.isPending}
                onCancel={() => setPendingCompletion(null)}
                onConfirm={() => pendingCompletion && completionMutation.mutate(pendingCompletion)}
            />
            <div>
                <h2 id="repair-workflow-title" className="text-lg font-semibold text-foreground">
                    Technician workflow
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Record each step in sequence. The server enforces assignment and valid status transitions.
                </p>
            </div>

            {canRecordDiagnosis && (
                <form
                    className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm"
                    onSubmit={diagnosisForm.handleSubmit((values) => diagnosisMutation.mutate(values))}
                >
                    <h3 className="font-semibold text-foreground">Record diagnosis</h3>
                    <WorkflowField label="Diagnosis" error={diagnosisForm.formState.errors.diagnosis?.message} required>
                        <Textarea rows={4} {...diagnosisForm.register('diagnosis')} />
                    </WorkflowField>
                    <WorkflowField label="Root cause" error={diagnosisForm.formState.errors.root_cause?.message}>
                        <Textarea rows={3} {...diagnosisForm.register('root_cause')} />
                    </WorkflowField>
                    <WorkflowField
                        label="Customer-visible notes"
                        error={diagnosisForm.formState.errors.customer_notes?.message}
                        hint="These notes are visible in the client portal."
                    >
                        <Textarea rows={3} {...diagnosisForm.register('customer_notes')} />
                    </WorkflowField>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <WorkflowField
                            label="Quoted labor cost (MAD)"
                            error={diagnosisForm.formState.errors.labor_cost?.message}
                            hint="This amount is shown to the client for approval."
                            required
                        >
                            <Input inputMode="decimal" {...diagnosisForm.register('labor_cost')} />
                        </WorkflowField>
                        <WorkflowField
                            label="Quoted parts cost (MAD)"
                            error={diagnosisForm.formState.errors.parts_cost?.message}
                            hint="This amount is shown to the client for approval."
                            required
                        >
                            <Input inputMode="decimal" {...diagnosisForm.register('parts_cost')} />
                        </WorkflowField>
                    </div>
                    <WorkflowField label="Next ticket status" error={diagnosisForm.formState.errors.next_status?.message} required>
                        <Select {...diagnosisForm.register('next_status')}>
                            <option value="awaiting_part">Awaiting part</option>
                            <option value="awaiting_customer_approval">Awaiting customer approval</option>
                            <option value="repairing">{repair.started_at ? 'Resume repair work' : 'Start repair work'}</option>
                        </Select>
                    </WorkflowField>
                    <ErrorMessage error={diagnosisMutation.error} />
                    <Button type="submit" disabled={diagnosisMutation.isPending}>
                        <Save aria-hidden="true" />
                        {diagnosisMutation.isPending ? 'Saving diagnosis...' : 'Save diagnosis'}
                    </Button>
                </form>
            )}

            {canStartRepair && (
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <h3 className="font-semibold text-foreground">Parts ready</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Start repair work when the required parts and approval are available.
                    </p>
                    <ErrorMessage error={startMutation.error} />
                    <Button className="mt-3" type="button" disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                        <Play aria-hidden="true" />
                        {startMutation.isPending ? 'Starting...' : 'Start repair work'}
                    </Button>
                </div>
            )}

            <form
                className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm"
                onSubmit={updateForm.handleSubmit((values) => updateMutation.mutate(values))}
            >
                <h3 className="font-semibold text-foreground">Repair notes and costs</h3>
                <WorkflowField label="Repair action" error={updateForm.formState.errors.repair_action?.message}>
                    <Textarea rows={3} {...updateForm.register('repair_action')} />
                </WorkflowField>
                <WorkflowField
                    label="Internal technician notes"
                    error={updateForm.formState.errors.internal_notes?.message}
                    hint="Internal technician notes are never shown in the client portal."
                >
                    <Textarea rows={3} {...updateForm.register('internal_notes')} />
                </WorkflowField>
                <WorkflowField
                    label="Customer-visible notes"
                    error={updateForm.formState.errors.customer_notes?.message}
                    hint="These notes are visible in the client portal."
                >
                    <Textarea rows={3} {...updateForm.register('customer_notes')} />
                </WorkflowField>
                <div className="grid gap-4 sm:grid-cols-2">
                    <WorkflowField label="Labor cost (MAD)" error={updateForm.formState.errors.labor_cost?.message} required>
                        <Input inputMode="decimal" {...updateForm.register('labor_cost')} />
                    </WorkflowField>
                    <WorkflowField label="Parts cost (MAD)" error={updateForm.formState.errors.parts_cost?.message} required>
                        <Input inputMode="decimal" {...updateForm.register('parts_cost')} />
                    </WorkflowField>
                </div>
                <ErrorMessage error={updateMutation.error} />
                <Button type="submit" variant="outline" disabled={updateMutation.isPending}>
                    <Save aria-hidden="true" />
                    {updateMutation.isPending ? 'Saving...' : 'Save repair details'}
                </Button>
            </form>

            {canCompleteRepair && (
                <form
                    className="space-y-4 rounded-lg border border-emerald-300 bg-card p-4 shadow-sm dark:border-emerald-900"
                    onSubmit={completionForm.handleSubmit(setPendingCompletion)}
                >
                    <h3 className="font-semibold text-foreground">Complete repair</h3>
                    <WorkflowField label="Outcome" error={completionForm.formState.errors.result?.message} required>
                        <Select {...completionForm.register('result')}>
                            <option value="repaired">Repaired</option>
                            <option value="partially_repaired">Partially repaired</option>
                            <option value="unrepairable">Unrepairable</option>
                            <option value="replacement_required">Replacement required</option>
                        </Select>
                    </WorkflowField>
                    <WorkflowField
                        label="Final customer-visible notes"
                        error={completionForm.formState.errors.customer_notes?.message}
                        hint="The client can read these final notes."
                    >
                        <Textarea rows={3} {...completionForm.register('customer_notes')} />
                    </WorkflowField>
                    <ErrorMessage error={completionMutation.error} />
                    <Button type="submit" disabled={completionMutation.isPending}>
                        <CheckCircle2 aria-hidden="true" />
                        Review completion
                    </Button>
                </form>
            )}
        </section>
    );
}

export function RepairsPage() {
    const [filters, setFilters] = useState<RepairFilters>({ state: 'current', per_page: 10 });
    const repairsQuery = useQuery({ queryKey: ['repairs', filters], queryFn: () => listRepairs(filters) });
    const updateFilters = (next: Partial<RepairFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Repair>[] = [
        {
            id: 'ticket',
            header: 'Ticket',
            cell: (repair) => (
                <div>
                    <Link className="font-semibold text-slate-900 hover:text-blue-700" to={`/admin/repairs/${repair.id}`}>
                        {repair.ticket?.ticket_number ?? `Repair #${repair.id}`}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">{repair.ticket?.title ?? 'Ticket details unavailable'}</p>
                </div>
            ),
        },
        { id: 'client', header: 'Client', cell: (repair) => <span className="text-slate-700">{repair.ticket?.client ?? '--'}</span> },
        { id: 'product', header: 'Product', cell: (repair) => <span className="text-slate-700">{repair.ticket?.product ?? '--'}</span> },
        {
            id: 'technician',
            header: 'Technician',
            cell: (repair) => (
                <span className="text-slate-700">{repair.technician?.name ?? repair.technician?.employee_code ?? 'Unassigned'}</span>
            ),
        },
        {
            id: 'status',
            header: 'Ticket status',
            cell: (repair) =>
                repair.ticket?.status ? <StatusBadge value={repair.ticket.status} /> : <span className="text-slate-500">--</span>,
        },
        {
            id: 'result',
            header: 'Result',
            cell: (repair) => (repair.result ? <StatusBadge value={repair.result} /> : <span className="text-slate-500">In progress</span>),
        },
        { id: 'updated', header: 'Updated', cell: (repair) => <span className="text-slate-600">{formatDate(repair.updated_at)}</span> },
    ];

    return (
        <section className="space-y-6">
            <PageHeader title="Repairs" description="Review active and completed repair records, including their authorized files." />
            <div className="max-w-xs rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-medium text-slate-800">
                    Repair state
                    <select
                        className={inputClassName}
                        value={filters.state ?? ''}
                        onChange={(event) => updateFilters({ state: event.target.value as RepairFilters['state'] })}
                    >
                        <option value="">All repairs</option>
                        <option value="current">Current repairs</option>
                        <option value="completed">Completed repairs</option>
                    </select>
                </label>
            </div>
            {repairsQuery.isLoading ? (
                <p className="text-sm text-slate-600">Loading repairs...</p>
            ) : (
                <>
                    <ErrorMessage error={repairsQuery.error} />
                    <DataTable
                        rows={repairsQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(repair) => repair.id}
                        emptyMessage="No repair records match this filter."
                    />
                    {repairsQuery.data && (
                        <Pagination
                            meta={repairsQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}
        </section>
    );
}

export function RepairDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const repairId = Number(id);
    const repairQuery = useQuery({
        queryKey: ['repairs', repairId],
        queryFn: () => getRepair(repairId),
        enabled: Number.isInteger(repairId) && repairId > 0,
    });
    const queryClient = useQueryClient();
    const { can } = usePermissions();
    const repair = repairQuery.data;
    useTicketRealtime(repair?.ticket_id ?? null);

    if (repairQuery.isLoading) return <PageSkeleton />;
    if (!repair) return <ErrorMessage error={repairQuery.error ?? new Error('Repair not found.')} />;

    const refresh = (updatedRepair: Repair) => {
        queryClient.setQueryData(['repairs', repairId], updatedRepair);
        void queryClient.invalidateQueries({ queryKey: ['repairs'] });
        void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    };

    return (
        <section className="max-w-6xl space-y-6">
            <PageHeader
                title={repair.ticket?.ticket_number ?? `Repair #${repair.id}`}
                description={repair.ticket?.title ?? 'Repair record'}
                action={
                    <Link
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        to="/admin/repairs"
                    >
                        Back to repairs
                    </Link>
                }
            />
            <AttachmentPanel
                resourceType="repairs"
                resourceKey={repair.id}
                title="Repair attachments"
                canUpload={can('repairs.update')}
                canDelete={can('repairs.update')}
            />
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-4">
                <Detail label="Ticket status" value={repair.ticket?.status ? <StatusBadge value={repair.ticket.status} /> : '--'} />
                <Detail label="Client" value={repair.ticket?.client ?? '--'} />
                <Detail label="Product" value={repair.ticket?.product ?? '--'} />
                <Detail label="Technician" value={repair.technician?.name ?? repair.technician?.employee_code ?? 'Unassigned'} />
                <Detail label="Started" value={formatDate(repair.started_at)} />
                <Detail label="Completed" value={formatDate(repair.completed_at)} />
                <Detail label="Result" value={repair.result ? <StatusBadge value={repair.result} /> : 'In progress'} />
                <Detail label="Total cost" value={<strong>{formatAmount(repair.total_cost)}</strong>} />
                <div className="md:col-span-2 lg:col-span-4">
                    <Detail
                        label="Diagnosis"
                        value={<p className="whitespace-pre-wrap">{repair.diagnosis ?? 'No diagnosis has been recorded.'}</p>}
                    />
                </div>
                <div className="md:col-span-2">
                    <Detail label="Root cause" value={<p className="whitespace-pre-wrap">{repair.root_cause ?? '--'}</p>} />
                </div>
                <div className="md:col-span-2">
                    <Detail label="Repair action" value={<p className="whitespace-pre-wrap">{repair.repair_action ?? '--'}</p>} />
                </div>
                <div className="md:col-span-2">
                    <Detail label="Customer notes" value={<p className="whitespace-pre-wrap">{repair.customer_notes ?? '--'}</p>} />
                </div>
            </section>
            {can('repairs.update') && <TechnicianRepairWorkflow repair={repair} onUpdated={refresh} />}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">Repair history</h3>
                <div className="mt-5 space-y-4 border-l-2 border-slate-200 pl-5">
                    {(repair.history ?? []).map((entry) => (
                        <article className="relative" key={entry.id}>
                            <span className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" />
                            <p className="font-medium text-slate-900">{humanize(entry.event)}</p>
                            <p className="mt-1 text-sm text-slate-600">
                                {formatDate(entry.occurred_at)}
                                {entry.changed_by ? ` by ${entry.changed_by}` : ''}
                            </p>
                        </article>
                    ))}
                    {(repair.history ?? []).length === 0 && (
                        <p className="text-sm text-slate-600">No repair activity has been recorded yet.</p>
                    )}
                </div>
            </section>
        </section>
    );
}
