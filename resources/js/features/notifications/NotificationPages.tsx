import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, Check, CheckCheck, LoaderCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiErrorAlert as ErrorMessage, getApiErrorMessage } from '@/components/ApiErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '@/features/notifications/api';
import { notificationActionUrl, type AppNotification, type NotificationFilters } from '@/features/notifications/types';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

function NotificationRow({
    notification,
    onRead,
    isClient,
    isMarkingRead,
}: {
    notification: AppNotification;
    onRead: (notification: AppNotification) => void;
    isClient: boolean;
    isMarkingRead: boolean;
}) {
    const titleId = useId();
    const isUnread = notification.read_at === null;
    const detail = (
        <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 id={titleId} className="font-semibold leading-6 text-foreground">
                    {notification.title}
                </h2>
                <Badge variant={isUnread ? 'info' : 'outline'}>{isUnread ? 'Unread' : 'Read'}</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(notification.created_at)}</p>
        </div>
    );
    const actionUrl = notificationActionUrl(notification, isClient);

    return (
        <article
            className={cn(
                'rounded-xl border bg-card p-4 shadow-sm transition-colors sm:p-5',
                isUnread ? 'border-primary/30 bg-accent/35' : 'border-border',
            )}
            aria-labelledby={titleId}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {actionUrl ? (
                    <Link
                        className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        to={actionUrl}
                        onClick={() => onRead(notification)}
                    >
                        {detail}
                    </Link>
                ) : (
                    <div className="min-w-0 flex-1">{detail}</div>
                )}
                {isUnread && (
                    <Button
                        className="w-full sm:w-auto"
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isMarkingRead}
                        aria-describedby={titleId}
                        aria-busy={isMarkingRead}
                        onClick={() => onRead(notification)}
                    >
                        {isMarkingRead ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                        Mark read
                    </Button>
                )}
            </div>
        </article>
    );
}

function NotificationsSkeleton() {
    return (
        <div className="space-y-3" role="status" aria-label="Loading notifications">
            <span className="sr-only">Loading notifications...</span>
            {Array.from({ length: 4 }, (_, index) => (
                <Card key={index}>
                    <CardContent className="space-y-3 py-5">
                        <div className="flex items-center justify-between gap-4">
                            <Skeleton className="h-5 w-2/5" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-28" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export function NotificationsPage() {
    const queryClient = useQueryClient();
    const [filters, setFilters] = useState<NotificationFilters>({ per_page: 20 });
    const { user } = useAuth();
    const isClient = user?.roles.includes('client') ?? false;
    const notificationsQuery = useQuery({
        queryKey: ['notifications', 'list', filters],
        queryFn: () => listNotifications(filters),
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
    const markRead = (notification: AppNotification) => {
        if (notification.read_at === null) {
            markReadMutation.mutate(notification.id);
        }
    };
    const mutationError = markAllMutation.error ?? markReadMutation.error;

    return (
        <section className="mx-auto max-w-5xl space-y-6">
            <PageHeader
                title="Notifications"
                description="Review ticket, repair, and warranty updates relevant to your account."
                actions={
                    <Button
                        className="w-full sm:w-auto"
                        type="button"
                        variant="outline"
                        disabled={markAllMutation.isPending}
                        aria-busy={markAllMutation.isPending}
                        onClick={() => markAllMutation.mutate()}
                    >
                        {markAllMutation.isPending ? (
                            <LoaderCircle className="animate-spin" aria-hidden="true" />
                        ) : (
                            <CheckCheck aria-hidden="true" />
                        )}
                        Mark all as read
                    </Button>
                }
            />

            <Card>
                <CardContent className="p-2 sm:p-3">
                    <div className="grid grid-cols-2 gap-2 sm:flex" role="group" aria-label="Notification filters">
                        <Button
                            type="button"
                            variant={filters.unread === true ? 'default' : 'ghost'}
                            size="sm"
                            aria-pressed={filters.unread === true}
                            onClick={() => setFilters({ per_page: 20, unread: true })}
                        >
                            Unread
                        </Button>
                        <Button
                            type="button"
                            variant={filters.unread === undefined ? 'default' : 'ghost'}
                            size="sm"
                            aria-pressed={filters.unread === undefined}
                            onClick={() => setFilters({ per_page: 20 })}
                        >
                            All
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <ErrorMessage error={mutationError} fallback="The notification could not be updated." />

            {notificationsQuery.isLoading ? (
                <NotificationsSkeleton />
            ) : notificationsQuery.error ? (
                <ErrorState
                    title="Unable to load notifications"
                    description={
                        getApiErrorMessage(notificationsQuery.error, 'Notifications are temporarily unavailable. Please try again.') ??
                        'Notifications are temporarily unavailable. Please try again.'
                    }
                    onRetry={() => void notificationsQuery.refetch()}
                />
            ) : (notificationsQuery.data?.data.length ?? 0) === 0 ? (
                <Card>
                    <EmptyState
                        icon={BellOff}
                        title="No notifications match this view."
                        description={
                            filters.unread
                                ? 'You are all caught up. New unread updates will appear here.'
                                : 'Ticket, repair, and warranty updates will appear here when they arrive.'
                        }
                    />
                </Card>
            ) : (
                <div className="space-y-3">
                    {notificationsQuery.data?.data.map((notification) => (
                        <NotificationRow
                            key={notification.id}
                            notification={notification}
                            onRead={markRead}
                            isClient={isClient}
                            isMarkingRead={markReadMutation.isPending && markReadMutation.variables === notification.id}
                        />
                    ))}
                </div>
            )}

            {notificationsQuery.data && (
                <Pagination meta={notificationsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
            )}
        </section>
    );
}
