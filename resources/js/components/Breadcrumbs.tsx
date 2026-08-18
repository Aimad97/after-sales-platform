import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export type WorkspaceVariant = 'admin' | 'client';

interface BreadcrumbsProps {
    variant: WorkspaceVariant;
    labels?: Readonly<Record<string, string>>;
    className?: string;
}

interface BreadcrumbItem {
    label: string;
    to: string;
}

const segmentLabels: Readonly<Record<string, string>> = {
    users: 'Users',
    technicians: 'Technicians',
    clients: 'Clients',
    invoices: 'Invoices',
    warranties: 'Warranties',
    products: 'Products',
    categories: 'Categories',
    brands: 'Brands',
    tickets: 'Tickets',
    repairs: 'Repairs',
    reports: 'Reports',
    notifications: 'Notifications',
    'audit-logs': 'Audit logs',
    profile: 'My profile',
};

const singularLabels: Readonly<Record<string, string>> = {
    users: 'user',
    technicians: 'technician',
    clients: 'client',
    invoices: 'invoice',
    warranties: 'warranty',
    products: 'product',
    categories: 'category',
    brands: 'brand',
    tickets: 'ticket',
    repairs: 'repair',
    reports: 'report',
    notifications: 'notification',
    'audit-logs': 'audit log',
};

function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

function titleCase(value: string): string {
    return value
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function nearestResource(segments: readonly string[], index: number): string | undefined {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const candidate = segments[cursor];
        if (candidate && singularLabels[candidate]) return candidate;
    }

    return undefined;
}

function labelForSegment(
    segment: string,
    index: number,
    segments: readonly string[],
    customLabels: Readonly<Record<string, string>>,
): string {
    const decodedSegment = decodeSegment(segment);
    const customLabel = customLabels[segment] ?? customLabels[decodedSegment];
    if (customLabel) return customLabel;

    const resource = nearestResource(segments, index);
    const singularResource = resource ? singularLabels[resource] : undefined;

    if (segment === 'new') return singularResource ? `New ${singularResource}` : 'New record';
    if (segment === 'edit') return singularResource ? `Edit ${singularResource}` : 'Edit record';
    if (segmentLabels[segment]) return segmentLabels[segment];
    if (singularResource) return `${titleCase(singularResource)} details`;

    return titleCase(decodedSegment);
}

export function buildBreadcrumbItems(
    pathname: string,
    variant: WorkspaceVariant,
    customLabels: Readonly<Record<string, string>> = {},
): BreadcrumbItem[] {
    const workspaceRoot = `/${variant}`;
    const pathSegments = pathname.split('/').filter(Boolean);
    const workspaceIndex = pathSegments.indexOf(variant);
    const relativeSegments = workspaceIndex >= 0 ? pathSegments.slice(workspaceIndex + 1) : [];
    const items: BreadcrumbItem[] = [
        {
            label: variant === 'admin' ? 'Dashboard' : 'Overview',
            to: workspaceRoot,
        },
    ];

    relativeSegments.forEach((segment, index) => {
        items.push({
            label: labelForSegment(segment, index, relativeSegments, customLabels),
            to: `${workspaceRoot}/${relativeSegments.slice(0, index + 1).join('/')}`,
        });
    });

    return items;
}

export function Breadcrumbs({ variant, labels = {}, className = '' }: BreadcrumbsProps) {
    const location = useLocation();
    const items = buildBreadcrumbItems(location.pathname, variant, labels);

    return (
        <nav className={`min-w-0 overflow-x-auto ${className}`.trim()} aria-label="Breadcrumb">
            <ol className="flex min-w-max items-center gap-1.5 text-sm text-muted-foreground">
                {items.map((item, index) => {
                    const isCurrent = index === items.length - 1;

                    return (
                        <li key={item.to} className="flex items-center gap-1.5">
                            {index > 0 && <ChevronRight className="size-4 shrink-0" aria-hidden="true" />}
                            {isCurrent ? (
                                <span className="inline-flex items-center gap-1.5 font-medium text-foreground" aria-current="page">
                                    {index === 0 && <Home className="size-4" aria-hidden="true" />}
                                    {item.label}
                                </span>
                            ) : (
                                <Link
                                    className="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                    to={item.to}
                                >
                                    {index === 0 && <Home className="size-4" aria-hidden="true" />}
                                    {item.label}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
