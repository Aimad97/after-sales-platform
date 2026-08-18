import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from 'react';

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
    const dialogRef = useRef<HTMLElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
    const actionRequestedRef = useRef(false);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!open) return;

        actionRequestedRef.current = false;
        previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        cancelButtonRef.current?.focus();

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            actionRequestedRef.current = false;

            const previouslyFocusedElement = previouslyFocusedElementRef.current;
            if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus();
        };
    }, [open]);

    useEffect(() => {
        if (!isPending) actionRequestedRef.current = false;
    }, [isPending]);

    if (!open) return null;

    const cancel = () => {
        if (!isPending) onCancel();
    };

    const confirm = () => {
        if (isPending || actionRequestedRef.current) return;

        actionRequestedRef.current = true;
        onConfirm();
    };

    const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        if (event.currentTarget === event.target) cancel();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancel();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusableElements = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ) ?? [],
        ).filter((element) => !element.hasAttribute('hidden'));

        if (focusableElements.length === 0) {
            event.preventDefault();
            dialogRef.current?.focus();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey && (activeElement === firstElement || !dialogRef.current?.contains(activeElement))) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && (activeElement === lastElement || !dialogRef.current?.contains(activeElement))) {
            event.preventDefault();
            firstElement.focus();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={handleBackdropMouseDown}
        >
            <section
                ref={dialogRef}
                className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                aria-busy={isPending}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <h2 id={titleId} className="text-lg font-bold text-foreground">
                    {title}
                </h2>
                <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        ref={cancelButtonRef}
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                        disabled={isPending}
                        onClick={cancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm transition-[filter] hover:brightness-95 disabled:opacity-50"
                        disabled={isPending}
                        onClick={confirm}
                    >
                        {isPending ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </section>
        </div>
    );
}
