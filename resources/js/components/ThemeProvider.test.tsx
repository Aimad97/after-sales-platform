import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider, type ThemePreference, useTheme } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

interface MatchMediaController {
    setMatches: (matches: boolean) => void;
}

function installMatchMedia(initialMatches: boolean): MatchMediaController {
    let matches = initialMatches;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQueryList = {
        get matches() {
            return matches;
        },
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject | null) => {
            if (typeof listener === 'function') listeners.add(listener as (event: MediaQueryListEvent) => void);
        },
        removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject | null) => {
            if (typeof listener === 'function') listeners.delete(listener as (event: MediaQueryListEvent) => void);
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
    } as MediaQueryList;

    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn(() => mediaQueryList),
    });

    return {
        setMatches(nextMatches: boolean) {
            matches = nextMatches;
            const event = Object.assign(new Event('change'), {
                matches,
                media: mediaQueryList.media,
            }) as MediaQueryListEvent;
            listeners.forEach((listener) => listener(event));
        },
    };
}

function ThemeProbe() {
    const { theme, resolvedTheme, setTheme } = useTheme();

    return (
        <div>
            <output aria-label="Theme preference">{theme}</output>
            <output aria-label="Resolved theme">{resolvedTheme}</output>
            {(['light', 'dark', 'system'] satisfies ThemePreference[]).map((preference) => (
                <button key={preference} type="button" onClick={() => setTheme(preference)}>
                    Set {preference}
                </button>
            ))}
        </div>
    );
}

describe('ThemeProvider', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = '';
        installMatchMedia(false);
    });

    it('restores a valid stored preference', () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

        render(
            <ThemeProvider>
                <ThemeProbe />
            </ThemeProvider>,
        );

        expect(screen.getByLabelText('Theme preference')).toHaveTextContent('dark');
        expect(screen.getByLabelText('Resolved theme')).toHaveTextContent('dark');
        expect(document.documentElement).toHaveClass('dark');
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('falls back to the system preference and responds to operating-system changes', () => {
        const media = installMatchMedia(true);

        render(
            <ThemeProvider>
                <ThemeProbe />
            </ThemeProvider>,
        );

        expect(screen.getByLabelText('Theme preference')).toHaveTextContent('system');
        expect(screen.getByLabelText('Resolved theme')).toHaveTextContent('dark');
        expect(document.documentElement).toHaveClass('dark');

        act(() => media.setMatches(false));

        expect(screen.getByLabelText('Resolved theme')).toHaveTextContent('light');
        expect(document.documentElement).not.toHaveClass('dark');
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('removes a stale dark class when the resolved preference is light', () => {
        document.documentElement.classList.add('dark');
        window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

        render(
            <ThemeProvider>
                <ThemeProbe />
            </ThemeProvider>,
        );

        expect(document.documentElement).not.toHaveClass('dark');
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('persists explicit and system preferences', async () => {
        const user = userEvent.setup();

        render(
            <ThemeProvider>
                <ThemeProbe />
            </ThemeProvider>,
        );

        await user.click(screen.getByRole('button', { name: 'Set dark' }));
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(document.documentElement).toHaveClass('dark');

        await user.click(screen.getByRole('button', { name: 'Set system' }));
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
        expect(document.documentElement).not.toHaveClass('dark');
    });

    it('exposes an accessible toggle that updates and persists the resolved theme', async () => {
        const user = userEvent.setup();

        render(
            <ThemeProvider>
                <ThemeToggle />
            </ThemeProvider>,
        );

        const toggle = screen.getByRole('button', { name: 'Dark mode' });
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        expect(toggle).toHaveAttribute('title', 'Switch to dark mode');

        await user.click(toggle);

        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        expect(toggle).toHaveAttribute('title', 'Switch to light mode');
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(document.documentElement).toHaveClass('dark');
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });
});
