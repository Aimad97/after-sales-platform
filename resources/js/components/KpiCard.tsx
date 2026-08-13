import type { ReactNode } from 'react';

export function KpiCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
    return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>{hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}</article>;
}
