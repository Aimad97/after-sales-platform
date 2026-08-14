import { describe, expect, it } from 'vitest';
import { portalTicketSchema } from '@/features/client-portal/ClientPortalPages';
import { notificationActionUrl, type AppNotification } from '@/features/notifications/types';

describe('client portal input and navigation safety', () => {
    it('requires a registered purchased-product identifier and meaningful problem detail', () => {
        expect(portalTicketSchema.safeParse({
            purchased_product_uuid: 'not-a-uuid',
            title: 'No',
            problem_description: 'Too short',
        }).success).toBe(false);
    });

    it('maps ticket notifications to client routes without trusting an admin action URL', () => {
        const notification: AppNotification = {
            id: 'notification-1',
            type: 'ticket_status_changed',
            title: 'Status updated',
            message: 'Your ticket changed status.',
            action_url: '/admin/tickets/should-not-be-used',
            context: { ticket_uuid: 'ticket-uuid' },
            read_at: null,
            created_at: null,
        };

        expect(notificationActionUrl(notification, true)).toBe('/client/tickets/ticket-uuid');
        expect(notificationActionUrl(notification, false)).toBe('/admin/tickets/should-not-be-used');
    });
});
