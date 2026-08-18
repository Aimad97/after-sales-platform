import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    eyebrow?: ReactNode;
    actions?: ReactNode;
    className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
    return (
        <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
            <div className="min-w-0 max-w-3xl">
                {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                {description && <p className="mt-1.5 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}
            </div>
            {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
        </header>
    );
}

export function SectionHeader({ title, description, actions }: Omit<PageHeaderProps, 'eyebrow' | 'className'>) {
    return (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}
