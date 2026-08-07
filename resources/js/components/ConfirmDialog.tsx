interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    isPending?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, isPending = false, onConfirm, onCancel }: ConfirmDialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="presentation">
            <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
                <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm text-slate-600">{description}</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" disabled={isPending} onClick={onCancel}>Cancel</button>
                    <button className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={isPending} onClick={onConfirm}>{isPending ? 'Working…' : confirmLabel}</button>
                </div>
            </section>
        </div>
    );
}
