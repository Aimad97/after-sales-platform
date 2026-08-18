import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

export function KpiCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
    return (
        <Card className="p-5 transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground tabular-nums">{value}</p>
            {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
        </Card>
    );
}
