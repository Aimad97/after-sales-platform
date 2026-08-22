const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

export function resolveApiBaseUrl(configuredUrl: string, browserOrigin: string): string {
    const apiUrl = new URL(configuredUrl, browserOrigin);
    const pageUrl = new URL(browserOrigin);

    // localhost and 127.0.0.1 are different cookie sites. During local
    // development, keep the configured API port but use the page hostname so
    // Laravel's SameSite=Lax session cookie is sent on subsequent requests.
    if (loopbackHosts.has(apiUrl.hostname) && loopbackHosts.has(pageUrl.hostname)) {
        apiUrl.hostname = pageUrl.hostname;
    }

    return apiUrl.toString().replace(/\/$/, '');
}

export const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL, window.location.origin);
export const apiOrigin = new URL(apiBaseUrl).origin;
