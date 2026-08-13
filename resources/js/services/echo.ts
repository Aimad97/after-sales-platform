import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { apiClient } from '@/api/client';

declare global { interface Window { Pusher: typeof Pusher; } }

interface ChannelAuthorizationRequest {
    socketId: string;
    channelName: string;
}

interface ChannelAuthorizationResponse {
    auth: string;
    channel_data?: string;
}

type ChannelAuthorizationCallback = (error: Error | null, data: ChannelAuthorizationResponse | null) => void;

let echo: Echo<'reverb'> | null = null;

export function createEcho(): Echo<'reverb'> {
    window.Pusher = Pusher;
    const secure = import.meta.env.VITE_REVERB_SCHEME === 'https';
    const port = Number(import.meta.env.VITE_REVERB_PORT);

    return new Echo<'reverb'>({
        broadcaster: 'reverb', key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST, wsPort: port, wssPort: port,
        forceTLS: secure, enabledTransports: ['ws', 'wss'], disableStats: true,
        channelAuthorization: {
            customHandler: (
                { socketId, channelName }: ChannelAuthorizationRequest,
                callback: ChannelAuthorizationCallback,
            ) => {
                void apiClient.post<ChannelAuthorizationResponse>('/broadcasting/auth', {
                    socket_id: socketId,
                    channel_name: channelName,
                }).then(
                    (response) => callback(null, response.data),
                    (error: unknown) => callback(
                        error instanceof Error ? error : new Error('Unable to authorize the realtime channel.'),
                        null,
                    ),
                );
            },
        },
    });
}

export function getEcho(): Echo<'reverb'> {
    echo ??= createEcho();

    return echo;
}

export function disconnectEcho(): void {
    echo?.disconnect();
    echo = null;
}
