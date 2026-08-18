import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils/cn';

interface AccessibleControlProps {
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean | 'false' | 'true';
    'aria-required'?: boolean | 'false' | 'true';
}

interface FormFieldProps {
    label: ReactNode;
    children: ReactElement;
    error?: string;
    hint?: string;
    required?: boolean;
    className?: string;
}

export function FormField({ label, children, error, hint, required = false, className }: FormFieldProps) {
    const generatedId = useId();
    const accessibleControl = children as ReactElement<AccessibleControlProps>;
    const controlId = accessibleControl.props.id ?? `field-${generatedId}`;
    const hintId = hint ? `${controlId}-hint` : undefined;
    const errorId = error ? `${controlId}-error` : undefined;
    const describedBy = [accessibleControl.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;

    const control = cloneElement(accessibleControl, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : accessibleControl.props['aria-invalid'],
        'aria-required': required ? true : accessibleControl.props['aria-required'],
    });

    return (
        <div className={cn('space-y-2', className)}>
            <Label htmlFor={controlId}>
                {label}
                {required && (
                    <span className="ml-1 text-destructive" aria-hidden="true">
                        *
                    </span>
                )}
            </Label>
            {control}
            {hint && (
                <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
