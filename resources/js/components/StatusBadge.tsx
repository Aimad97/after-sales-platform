import { Badge, type BadgeProps } from '@/components/ui/badge';
import { humanize } from '@/utils/format';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const variants: Record<string, BadgeVariant> = {
    active: 'success',
    inactive: 'neutral',
    invited: 'info',
    suspended: 'danger',
    archived: 'neutral',
    available: 'success',
    busy: 'warning',
    unavailable: 'neutral',
    leave: 'info',
    individual: 'info',
    company: 'info',
    expired: 'danger',
    draft: 'warning',
    issued: 'info',
    void: 'neutral',
    replaced: 'info',
    low: 'neutral',
    normal: 'info',
    high: 'warning',
    urgent: 'danger',
    opened: 'info',
    received: 'info',
    awaiting_diagnosis: 'warning',
    diagnosing: 'info',
    awaiting_customer_approval: 'warning',
    awaiting_part: 'warning',
    repairing: 'info',
    testing: 'info',
    repaired: 'success',
    partially_repaired: 'warning',
    unrepairable: 'danger',
    replacement_required: 'warning',
    ready_for_pickup: 'success',
    delivered: 'success',
    closed: 'neutral',
    cancelled: 'danger',
    pending: 'warning',
    queued: 'warning',
    processing: 'info',
    completed: 'success',
    approved: 'success',
    rejected: 'danger',
    failed: 'danger',
};

export function StatusBadge({ value }: { value: string }) {
    return (
        <Badge variant={variants[value] ?? 'neutral'}>
            <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
            {humanize(value)}
        </Badge>
    );
}
