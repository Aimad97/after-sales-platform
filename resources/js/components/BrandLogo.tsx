import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const logoPath = '/images/ultrapc-logo.png';
const stripeColors = ['#ef3b24', '#f5a623', '#68a747', '#258ac1', '#748995'] as const;

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
    frameClassName?: string;
}

export function BrandLogo({
    alt = 'UltraPC.MA Hardware Solutions',
    className,
    frameClassName,
    loading = 'eager',
    ...props
}: BrandLogoProps) {
    return (
        <span className={cn('inline-flex', frameClassName)}>
            <img
                className={cn('block h-auto w-full object-contain', className)}
                src={logoPath}
                width={270}
                height={57}
                alt={alt}
                loading={loading}
                decoding="async"
                {...props}
            />
        </span>
    );
}

export function ApplicationBrand({ variant, compact = false }: { variant: 'admin' | 'client'; compact?: boolean }) {
    return (
        <span className="flex min-w-0 flex-col items-start">
            <BrandLogo frameClassName={compact ? 'w-[8.75rem]' : 'w-[11.75rem]'} />
            <span className={cn('mt-1 block truncate text-muted-foreground', compact ? 'text-[10px]' : 'text-[11px]')}>
                UltraPC Care - {variant === 'admin' ? 'Service workspace' : 'Client portal'}
            </span>
        </span>
    );
}

export function BrandMotion({ className }: { className?: string }) {
    return (
        <span className={cn('flex w-28 flex-col gap-1', className)} aria-hidden="true" data-testid="brand-motion">
            {stripeColors.map((color, index) => (
                <span
                    key={color}
                    className="ultrapc-loader-stripe block h-1.5 rounded-r-full"
                    style={{
                        width: `${100 - index * 6}%`,
                        backgroundColor: color,
                        animationDelay: `${index * 85}ms`,
                    }}
                />
            ))}
        </span>
    );
}

interface BrandLoaderProps {
    label?: string;
    showLogo?: boolean;
    compact?: boolean;
    className?: string;
}

export function BrandLoader({ label = 'Loading UltraPC Care...', showLogo = true, compact = false, className }: BrandLoaderProps) {
    return (
        <div
            className={cn('flex flex-col items-center text-center', compact ? 'gap-2' : 'gap-4', className)}
            role="status"
            aria-label={label}
        >
            {showLogo && <BrandLogo frameClassName={compact ? 'w-36' : 'w-52'} />}
            <BrandMotion className={compact ? 'w-20 gap-0.5 [&>span]:h-1' : undefined} />
            <span className={cn('font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>{label}</span>
        </div>
    );
}
