import { createContext, type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export const THEME_STORAGE_KEY = 'ultrapc-theme';

const SYSTEM_DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
    theme: ThemePreference;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: ThemePreference) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredTheme(): ThemePreference {
    try {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

        return isThemePreference(storedTheme) ? storedTheme : 'system';
    } catch {
        return 'system';
    }
}

function readSystemDarkMode(): boolean {
    return window.matchMedia(SYSTEM_DARK_MODE_QUERY).matches;
}

function persistTheme(theme: ThemePreference): void {
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // A blocked storage API must not prevent the user from changing themes.
    }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);
    const [systemDarkMode, setSystemDarkMode] = useState(readSystemDarkMode);
    const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDarkMode ? 'dark' : 'light') : theme;

    useEffect(() => {
        const mediaQuery = window.matchMedia(SYSTEM_DARK_MODE_QUERY);
        const handleChange = (event: MediaQueryListEvent) => setSystemDarkMode(event.matches);

        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== THEME_STORAGE_KEY) return;

            setThemeState(isThemePreference(event.newValue) ? event.newValue : 'system');
        };

        window.addEventListener('storage', handleStorage);

        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useLayoutEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', resolvedTheme === 'dark');
        root.style.colorScheme = resolvedTheme;
    }, [resolvedTheme]);

    const setTheme = useCallback((nextTheme: ThemePreference) => {
        persistTheme(nextTheme);
        setThemeState(nextTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }, [resolvedTheme, setTheme]);

    const value = useMemo(() => ({ theme, resolvedTheme, setTheme, toggleTheme }), [resolvedTheme, setTheme, theme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) throw new Error('useTheme must be used within a ThemeProvider.');

    return context;
}
