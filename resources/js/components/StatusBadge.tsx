import { humanize } from '@/utils/format';

const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-slate-200 text-slate-700',
    invited: 'bg-sky-100 text-sky-800',
    suspended: 'bg-rose-100 text-rose-800',
    archived: 'bg-slate-200 text-slate-700',
    available: 'bg-emerald-100 text-emerald-800',
    busy: 'bg-amber-100 text-amber-800',
    unavailable: 'bg-slate-200 text-slate-700',
    leave: 'bg-violet-100 text-violet-800',
    individual: 'bg-sky-100 text-sky-800',
    company: 'bg-violet-100 text-violet-800',
    expired: 'bg-rose-100 text-rose-800',
    draft: 'bg-amber-100 text-amber-800',
    issued: 'bg-sky-100 text-sky-800',
    void: 'bg-slate-200 text-slate-700',
};

export function StatusBadge({ value }: { value: string }) {
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[value] ?? 'bg-slate-100 text-slate-700'}`}>{humanize(value)}</span>;
}
