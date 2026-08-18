import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
    <select
        ref={ref}
        className={cn(
            'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
            className,
        )}
        {...props}
    />
));
Select.displayName = 'Select';
