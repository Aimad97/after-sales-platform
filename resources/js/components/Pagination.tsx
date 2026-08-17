import type { PaginationMeta } from '@/types/pagination';

interface PaginationProps {
    meta: PaginationMeta;
    onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
    if (meta.last_page <= 1) return null;

    return (
        <nav className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm" aria-label="Pagination">
            <p className="text-slate-600">
                Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
            </p>
            <div className="flex gap-2">
                <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={meta.current_page === 1}
                    onClick={() => onPageChange(meta.current_page - 1)}
                >
                    Previous
                </button>
                <span className="px-2 py-1.5 text-slate-600">
                    Page {meta.current_page} of {meta.last_page}
                </span>
                <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={meta.current_page === meta.last_page}
                    onClick={() => onPageChange(meta.current_page + 1)}
                >
                    Next
                </button>
            </div>
        </nav>
    );
}
