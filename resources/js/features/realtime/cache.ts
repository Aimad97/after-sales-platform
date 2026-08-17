import type { QueryClient } from '@tanstack/react-query';
import type { AppNotification, UnreadNotificationCount } from '@/features/notifications/types';
import type { Repair } from '@/features/repairs/types';
import type { Ticket } from '@/features/tickets/types';
import type { PaginatedResponse } from '@/types/pagination';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
    return isRecord(value) && Array.isArray(value.data) && isRecord(value.meta);
}

function isTicketListQuery(queryKey: readonly unknown[]): boolean {
    return queryKey[0] === 'tickets' && isRecord(queryKey[1]);
}

function isRepairListQuery(queryKey: readonly unknown[]): boolean {
    return queryKey[0] === 'repairs' && isRecord(queryKey[1]);
}

function invalidateActiveOperationalQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({
        predicate: (query) => isTicketListQuery(query.queryKey) || isRepairListQuery(query.queryKey),
        refetchType: 'active',
    });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
    void queryClient.invalidateQueries({ queryKey: ['client-portal'], refetchType: 'active' });
}

export function applyTicketRealtimeUpdate(queryClient: QueryClient, ticket: Ticket): void {
    queryClient.setQueriesData<unknown>({ predicate: (query) => isTicketListQuery(query.queryKey) }, (existing: unknown) => {
        if (!isPaginatedResponse<Ticket>(existing)) return existing;

        return {
            ...existing,
            data: existing.data.map((current) => (current.uuid === ticket.uuid ? { ...current, ...ticket } : current)),
        };
    });
    queryClient.setQueriesData<Ticket>({ queryKey: ['tickets', ticket.uuid], exact: true }, (existing) =>
        existing ? { ...existing, ...ticket } : existing,
    );
    invalidateActiveOperationalQueries(queryClient);
}

export function applyRepairRealtimeUpdate(queryClient: QueryClient, repair: Repair, ticket: Ticket): void {
    queryClient.setQueriesData<unknown>({ predicate: (query) => isRepairListQuery(query.queryKey) }, (existing: unknown) => {
        if (!isPaginatedResponse<Repair>(existing)) return existing;

        return {
            ...existing,
            data: existing.data.map((current) => (current.id === repair.id ? { ...current, ...repair } : current)),
        };
    });
    queryClient.setQueriesData<Repair>({ queryKey: ['repairs', repair.id], exact: true }, (existing) =>
        existing ? { ...existing, ...repair } : existing,
    );
    applyTicketRealtimeUpdate(queryClient, ticket);
}

export function applyNotificationRealtimeUpdate(queryClient: QueryClient, notification: AppNotification): void {
    queryClient.setQueriesData<unknown>({ queryKey: ['notifications'] }, (existing: unknown) => {
        if (!isPaginatedResponse<AppNotification>(existing)) return existing;
        if (existing.data.some((current) => current.id === notification.id)) return existing;

        return {
            ...existing,
            data: [notification, ...existing.data].slice(0, existing.meta.per_page),
            meta: {
                ...existing.meta,
                total: existing.meta.total + 1,
                to: existing.meta.to === null ? null : existing.meta.to + 1,
            },
        };
    });
    queryClient.setQueriesData<UnreadNotificationCount>(
        { queryKey: ['notifications', 'unread-count'], exact: true },
        (existing: UnreadNotificationCount | undefined) => (existing ? { count: existing.count + 1 } : existing),
    );
}

export function recoverRealtimeCaches(queryClient: QueryClient): void {
    invalidateActiveOperationalQueries(queryClient);
    void queryClient.invalidateQueries({ queryKey: ['notifications'], refetchType: 'active' });
}
