import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global { interface Window { Pusher: typeof Pusher; } }

export function createEcho(): Echo<'reverb'> {
    window.Pusher = Pusher;
    const secure = import.meta.env.VITE_REVERB_SCHEME === 'https';
    const port = Number(import.meta.env.VITE_REVERB_PORT);

    return new Echo<'reverb'>({
        broadcaster: 'reverb', key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST, wsPort: port, wssPort: port,
        forceTLS: secure, enabledTransports: ['ws', 'wss'], withCredentials: true,
    });
}
