import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
    title: string;
    description?: string;
    action?: ReactNode;
    icon?: LucideIcon;
    compact?: boolean;
    className?: string;
}

export function EmptyState({ title, description, action, icon: Icon = Inbox, compact = false, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center px-5 text-center', compact ? 'py-8' : 'min-h-64 py-12', className)}>
            <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
                <Icon size={21} />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

interface ErrorStateProps {
    title?: string;
    description: string;
    onRetry?: () => void;
    className?: string;
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, className }: ErrorStateProps) {
    return (
        <div
            className={cn('rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/40', className)}
            role="alert"
        >
            <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" size={19} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-rose-900 dark:text-rose-100">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-rose-700 dark:text-rose-200">{description}</p>
                    {onRetry && (
                        <Button className="mt-4" variant="outline" size="sm" onClick={onRetry}>
                            <RefreshCw />
                            Try again
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card" role="status" aria-label="Loading table">
            <span className="sr-only">Loading data...</span>
            <div
                className="grid gap-4 border-b border-border bg-muted/60 p-4"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: columns }, (_, index) => (
                    <Skeleton key={index} className="h-4" />
                ))}
            </div>
            {Array.from({ length: rows }, (_, rowIndex) => (
                <div
                    key={rowIndex}
                    className="grid gap-4 border-b border-border p-4 last:border-0"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                    {Array.from({ length: columns }, (_, columnIndex) => (
                        <Skeleton key={columnIndex} className={cn('h-4', columnIndex === 0 ? 'w-4/5' : 'w-full')} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function PageSkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading page">
            <span className="sr-only">Loading page...</span>
            <div className="space-y-2">
                <Skeleton className="h-8 w-52" />
                <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-28 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-72 rounded-xl" />
        </div>
    );
}
