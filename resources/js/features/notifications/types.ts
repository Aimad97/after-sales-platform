export type NotificationType =
    | 'ticket_created'
    | 'technician_assigned'
    | 'ticket_status_changed'
    | 'diagnosis_completed'
    | 'awaiting_customer_approval'
    | 'repair_completed'
    | 'ready_for_pickup'
    | 'warranty_nearing_expiration';

export interface AppNotification {
    id: string;
    type: NotificationType | string;
    title: string;
    message: string;
    action_url: string | null;
    context: Record<string, unknown>;
    read_at: string | null;
    created_at: string | null;
}

export interface NotificationFilters {
    unread?: boolean;
    per_page?: number;
    page?: number;
}

export interface UnreadNotificationCount {
    count: number;
}

export function notificationActionUrl(notification: AppNotification, isClient: boolean): string | null {
    if (!isClient) return notification.action_url;

    const ticketUuid = notification.context.ticket_uuid;
    if (typeof ticketUuid === 'string') return `/client/tickets/${ticketUuid}`;

    const warrantyUuid = notification.context.warranty_uuid;
    if (typeof warrantyUuid === 'string') return `/client/products/${warrantyUuid}`;

    return notification.action_url?.startsWith('/client/') ? notification.action_url : null;
}
