import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-sm font-semibold leading-none text-foreground peer-disabled:opacity-60', className)} {...props} />
));
Label.displayName = 'Label';
