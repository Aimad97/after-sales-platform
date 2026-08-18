import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const buttonVariants = cva(
    'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground shadow-sm hover:brightness-95',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/75',
                outline: 'border border-input bg-card text-card-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
                ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
                link: 'min-h-0 text-primary underline-offset-4 hover:underline',
                destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:brightness-95',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 min-h-9 rounded-md px-3 text-xs',
                lg: 'h-11 rounded-lg px-6',
                icon: 'size-10 min-h-10 p-0',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));

Button.displayName = 'Button';
