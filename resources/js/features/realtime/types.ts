import type { AppNotification } from '@/features/notifications/types';
import type { Repair } from '@/features/repairs/types';
import type { Ticket, TicketStatus } from '@/features/tickets/types';

export interface TicketRealtimeEvent {
    ticket: Ticket;
    actor_id: number;
}

export interface TicketStatusChangedRealtimeEvent extends TicketRealtimeEvent {
    from_status: TicketStatus;
    to_status: TicketStatus;
}

export interface TechnicianAssignedRealtimeEvent extends TicketRealtimeEvent {
    technician_id: number;
}

export interface RepairUpdatedRealtimeEvent {
    repair: Repair;
    ticket: Ticket;
    actor_id: number;
}

export interface NotificationCreatedRealtimeEvent {
    notification: AppNotification;
}
