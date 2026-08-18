import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    getUnreadNotificationCount,
    listNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '@/features/notifications/api';
import { notificationActionUrl, type AppNotification } from '@/features/notifications/types';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/format';

function NotificationItem({
    notification,
    onRead,
    onNavigate,
    isClient,
}: {
    notification: AppNotification;
    onRead: (notification: AppNotification) => void;
    onNavigate: () => void;
    isClient: boolean;
}) {
    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-foreground">{notification.title}</p>
                {notification.read_at === null && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(notification.created_at)}</p>
        </>
    );

    const actionUrl = notificationActionUrl(notification, isClient);
    if (actionUrl) {
        return (
            <Link
                className="block p-4 transition-colors hover:bg-muted"
                to={actionUrl}
                onClick={() => {
                    onRead(notification);
                    onNavigate();
                }}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            className="block min-h-11 w-full p-4 text-left transition-colors hover:bg-muted"
            type="button"
            onClick={() => onRead(notification)}
        >
            {content}
        </button>
    );
}

export function NotificationBell() {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLElement>(null);
    const { user } = useAuth();
    const isClient = user?.roles.includes('client') ?? false;
    const countQuery = useQuery({
        queryKey: ['notifications', 'unread-count'],
        queryFn: getUnreadNotificationCount,
        refetchInterval: 30_000,
    });
    const notificationsQuery = useQuery({
        queryKey: ['notifications', 'recent'],
        queryFn: () => listNotifications({ per_page: 8 }),
        enabled: isOpen,
    });
    const markReadMutation = useMutation({
        mutationFn: markNotificationAsRead,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
    const markAllMutation = useMutation({
        mutationFn: markAllNotificationsAsRead,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
    const unreadCount = countQuery.data?.count ?? 0;
    const ariaLabel = unreadCount > 0 ? 'Notifications, ' + unreadCount + ' unread' : 'Notifications';

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (!popoverRef.current?.contains(target) && !triggerRef.current?.contains(target)) setIsOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setIsOpen(false);
            triggerRef.current?.focus();
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const markRead = (notification: AppNotification) => {
        if (notification.read_at === null) {
            markReadMutation.mutate(notification.id);
        }
    };

    return (
        <div className="relative">
            <Button
                ref={triggerRef}
                variant="outline"
                size="icon"
                className="relative"
                aria-label={ariaLabel}
                aria-controls="notifications-popover"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                onClick={() => setIsOpen((open) => !open)}
            >
                <Bell size={19} />
                {unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-5 text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </Button>

            {isOpen && (
                <section
                    ref={popoverRef}
                    id="notifications-popover"
                    className="fixed left-2 right-2 top-16 z-40 mt-2 w-auto overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:w-96"
                    role="dialog"
                    aria-label="Recent notifications"
                >
                    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div>
                            <h2 className="font-bold text-foreground">Notifications</h2>
                            <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
                        </div>
                        <button
                            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary transition-colors hover:bg-accent disabled:opacity-50"
                            type="button"
                            disabled={unreadCount === 0 || markAllMutation.isPending}
                            onClick={() => markAllMutation.mutate()}
                        >
                            <CheckCheck size={16} />
                            Mark all read
                        </button>
                    </header>
                    <div className="max-h-96 divide-y divide-border overflow-y-auto">
                        {notificationsQuery.isLoading && (
                            <div className="space-y-3 p-4" role="status">
                                <span className="sr-only">Loading notifications...</span>
                                {[0, 1, 2].map((item) => (
                                    <Skeleton key={item} className="h-16" />
                                ))}
                            </div>
                        )}
                        {notificationsQuery.error && (
                            <p
                                className="m-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                                role="alert"
                            >
                                Unable to load notifications.
                            </p>
                        )}
                        {!notificationsQuery.isLoading &&
                            !notificationsQuery.error &&
                            (notificationsQuery.data?.data.length ?? 0) === 0 && (
                                <p className="p-6 text-center text-sm text-muted-foreground">You are all caught up.</p>
                            )}
                        {notificationsQuery.data?.data.map((notification) => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onRead={markRead}
                                onNavigate={() => setIsOpen(false)}
                                isClient={isClient}
                            />
                        ))}
                    </div>
                    <Link
                        className="block border-t border-border px-4 py-3 text-center text-sm font-semibold text-primary transition-colors hover:bg-accent"
                        to={isClient ? '/client/notifications' : '/admin/notifications'}
                        onClick={() => setIsOpen(false)}
                    >
                        View all notifications
                    </Link>
                </section>
            )}
        </div>
    );
}
