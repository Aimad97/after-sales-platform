import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export function ThemeToggle() {
    const { resolvedTheme, toggleTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    return (
        <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Dark mode"
            aria-pressed={isDark}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            onClick={toggleTheme}
        >
            {isDark ? <Moon aria-hidden="true" size={18} /> : <Sun aria-hidden="true" size={18} />}
        </button>
    );
}
