import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from '@/api/baseUrl';

describe('resolveApiBaseUrl', () => {
    it('resolves a relative API path against the exact browser origin', () => {
        expect(resolveApiBaseUrl('/api', 'http://sav.test:8000')).toBe('http://sav.test:8000/api');
    });

    it('uses the browser localhost hostname for a loopback API', () => {
        expect(resolveApiBaseUrl('http://127.0.0.1:8000/api', 'http://localhost:5173')).toBe('http://localhost:8000/api');
    });

    it('uses the browser 127.0.0.1 hostname for a loopback API', () => {
        expect(resolveApiBaseUrl('http://localhost:8000/api', 'http://127.0.0.1:5173')).toBe('http://127.0.0.1:8000/api');
    });

    it('does not rewrite a non-loopback API hostname', () => {
        expect(resolveApiBaseUrl('https://api.example.com/api', 'http://localhost:5173')).toBe('https://api.example.com/api');
    });
});
