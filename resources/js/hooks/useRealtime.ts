import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    applyNotificationRealtimeUpdate,
    applyRepairRealtimeUpdate,
    applyTicketRealtimeUpdate,
    recoverRealtimeCaches,
} from '@/features/realtime/cache';
import type { NotificationCreatedRealtimeEvent, RepairUpdatedRealtimeEvent, TicketRealtimeEvent } from '@/features/realtime/types';
import { useAuth } from '@/hooks/useAuth';
import { disconnectEcho, getEcho } from '@/services/echo';

function subscribeToTicketEvents(ticketId: number, onTicket: (event: TicketRealtimeEvent) => void) {
    const echo = getEcho();

    return echo
        .private(`ticket.${ticketId}`)
        .listen('.ticket.created', onTicket)
        .listen('.ticket.updated', onTicket)
        .listen('.ticket.status-changed', onTicket)
        .listen('.technician.assigned', onTicket);
}

export function useRealtime(): void {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            disconnectEcho();

            return;
        }

        const echo = getEcho();
        let connectedOnce = false;
        const onTicket = (event: TicketRealtimeEvent): void => applyTicketRealtimeUpdate(queryClient, event.ticket);
        const onRepair = (event: RepairUpdatedRealtimeEvent): void => applyRepairRealtimeUpdate(queryClient, event.repair, event.ticket);
        const onNotification = (event: NotificationCreatedRealtimeEvent): void => {
            applyNotificationRealtimeUpdate(queryClient, event.notification);
        };
        echo.private(`user.${user.id}`)
            .listen('.ticket.created', onTicket)
            .listen('.ticket.updated', onTicket)
            .listen('.ticket.status-changed', onTicket)
            .listen('.technician.assigned', onTicket)
            .listen('.repair.updated', onRepair)
            .listen('.notification.created', onNotification);
        const stopConnectionListener = echo.connector.onConnectionChange((status) => {
            if (status !== 'connected') return;

            if (connectedOnce) recoverRealtimeCaches(queryClient);
            connectedOnce = true;
        });

        return () => {
            stopConnectionListener();
            echo.leave(`user.${user.id}`);
        };
    }, [queryClient, user]);
}

export function useTicketRealtime(ticketId: number | null): void {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    useEffect(() => {
        if (!user || ticketId === null) return;

        const onTicket = (event: TicketRealtimeEvent): void => applyTicketRealtimeUpdate(queryClient, event.ticket);
        subscribeToTicketEvents(ticketId, onTicket);

        return () => {
            getEcho().leave(`ticket.${ticketId}`);
        };
    }, [queryClient, ticketId, user]);
}
