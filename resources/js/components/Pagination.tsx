import type { PaginationMeta } from '@/types/pagination';
import { Button } from '@/components/ui/button';

interface PaginationProps {
    meta: PaginationMeta;
    onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
    if (meta.last_page <= 1) return null;

    return (
        <nav
            className="mt-5 flex flex-col gap-3 border-t border-border pt-4 text-sm sm:flex-row sm:items-center sm:justify-between"
            aria-label="Pagination"
        >
            <p className="text-center text-muted-foreground sm:text-left" aria-live="polite">
                Showing {meta.from ?? 0}&ndash;{meta.to ?? 0} of {meta.total}
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button variant="outline" size="sm" disabled={meta.current_page === 1} onClick={() => onPageChange(meta.current_page - 1)}>
                    Previous
                </Button>
                <span className="px-1 text-center text-xs text-muted-foreground sm:px-2 sm:text-sm">
                    Page {meta.current_page} of {meta.last_page}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.current_page === meta.last_page}
                    onClick={() => onPageChange(meta.current_page + 1)}
                >
                    Next
                </Button>
            </div>
        </nav>
    );
}
