import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { globalSearch } from '@/features/global-search/api';
import {
    canSubmitSearch,
    categorizeSearchResults,
    flattenSearchResults,
    MIN_SEARCH_LENGTH,
    normalizeSearchQuery,
    SEARCH_DEBOUNCE_MS,
} from '@/features/global-search/types';

function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedValue(value), delay);

        return () => window.clearTimeout(timeout);
    }, [delay, value]);

    return debouncedValue;
}

export function GlobalSearchPalette() {
    const navigate = useNavigate();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLElement>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const normalizedQuery = normalizeSearchQuery(query);
    const debouncedQuery = useDebouncedValue(normalizedQuery, SEARCH_DEBOUNCE_MS);
    const searchQuery = useQuery({
        queryKey: ['global-search', debouncedQuery],
        queryFn: ({ signal }) => globalSearch(debouncedQuery, signal),
        enabled: isOpen && canSubmitSearch(debouncedQuery),
        staleTime: 30_000,
    });
    const groups = useMemo(() => (searchQuery.data ? categorizeSearchResults(searchQuery.data.groups) : []), [searchQuery.data]);
    const results = useMemo(() => (searchQuery.data ? flattenSearchResults(searchQuery.data.groups) : []), [searchQuery.data]);
    const activeIndex = results.length === 0 ? 0 : Math.min(selectedIndex, results.length - 1);
    const isWaitingForDebounce = canSubmitSearch(normalizedQuery) && normalizedQuery !== debouncedQuery;

    const close = useCallback(() => {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(0);
    }, []);

    const selectResult = useCallback(
        (url: string) => {
            close();
            navigate(url);
        },
        [close, navigate],
    );

    useEffect(() => {
        const onGlobalKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setIsOpen(true);
            }
        };

        window.addEventListener('keydown', onGlobalKeyDown);
        return () => window.removeEventListener('keydown', onGlobalKeyDown);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        inputRef.current?.focus();

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            const previouslyFocusedElement = previouslyFocusedElementRef.current;
            if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus();
        };
    }, [isOpen]);

    const onPaletteKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }

        if (event.key === 'Tab') {
            const focusableElements = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                ) ?? [],
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (firstElement && lastElement) {
                if (event.shiftKey && document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                } else if (!event.shiftKey && document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
            return;
        }

        if (results.length === 0 || isWaitingForDebounce) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((index) => (index + 1) % results.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((index) => (index - 1 + results.length) % results.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            selectResult(results[activeIndex].url);
        }
    };

    return (
        <>
            <Button
                ref={triggerRef}
                variant="outline"
                className="px-2.5 sm:px-3"
                aria-label="Open global search"
                onClick={() => setIsOpen(true)}
            >
                <Search size={18} />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground xl:inline">
                    Ctrl K
                </kbd>
            </Button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 p-3 pt-[8vh] backdrop-blur-sm sm:p-4 sm:pt-[10vh]"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.currentTarget === event.target) close();
                    }}
                >
                    <section
                        ref={dialogRef}
                        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Global search"
                        onKeyDown={onPaletteKeyDown}
                    >
                        <div className="flex items-center gap-3 border-b border-border px-4">
                            <Search className="shrink-0 text-muted-foreground" size={20} />
                            <input
                                ref={inputRef}
                                className="min-w-0 flex-1 border-0 bg-transparent py-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0"
                                value={query}
                                placeholder="Search clients, tickets, invoices, serials..."
                                aria-label="Search query"
                                role="combobox"
                                aria-autocomplete="list"
                                aria-expanded="true"
                                aria-controls="global-search-results"
                                aria-activedescendant={
                                    !isWaitingForDebounce && results.length > 0 ? `global-search-result-${activeIndex}` : undefined
                                }
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setSelectedIndex(0);
                                }}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 min-h-9 text-muted-foreground"
                                aria-label="Close search"
                                onClick={close}
                            >
                                <X size={19} />
                            </Button>
                        </div>

                        <div id="global-search-results" className="max-h-[65vh] overflow-y-auto p-2" role="listbox">
                            {!canSubmitSearch(normalizedQuery) && (
                                <p className="p-8 text-center text-sm text-muted-foreground">
                                    Enter at least {MIN_SEARCH_LENGTH} characters to search.
                                </p>
                            )}
                            {canSubmitSearch(normalizedQuery) && (isWaitingForDebounce || searchQuery.isFetching) && (
                                <div className="space-y-2 p-4" role="status">
                                    <span className="sr-only">Searching...</span>
                                    {[0, 1, 2].map((item) => (
                                        <span key={item} className="block h-12 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
                                    ))}
                                </div>
                            )}
                            {!isWaitingForDebounce && searchQuery.error && (
                                <p
                                    className="m-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                                    role="alert"
                                >
                                    Search is temporarily unavailable. Please try again.
                                </p>
                            )}
                            {!isWaitingForDebounce && !searchQuery.isFetching && !searchQuery.error && searchQuery.data?.total === 0 && (
                                <p className="p-8 text-center text-sm text-muted-foreground">
                                    No authorized results found for “{searchQuery.data.query}”.
                                </p>
                            )}

                            {!isWaitingForDebounce &&
                                !searchQuery.isFetching &&
                                groups.map((group) => {
                                    const precedingCount = groups
                                        .slice(0, groups.indexOf(group))
                                        .reduce((total, item) => total + item.results.length, 0);

                                    return (
                                        <section key={group.category} className="py-1" role="group" aria-label={group.label}>
                                            <h2 className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                                {group.label}
                                            </h2>
                                            {group.results.map((result, index) => {
                                                const absoluteIndex = precedingCount + index;
                                                return (
                                                    <button
                                                        id={`global-search-result-${absoluteIndex}`}
                                                        key={`${group.category}-${result.id}`}
                                                        className={`block min-h-12 w-full rounded-lg px-3 py-2.5 text-left transition-colors ${activeIndex === absoluteIndex ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted'}`}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={activeIndex === absoluteIndex}
                                                        onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                                                        onClick={() => selectResult(result.url)}
                                                    >
                                                        <span className="block font-semibold">{result.title}</span>
                                                        {result.subtitle && (
                                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                                {result.subtitle}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </section>
                                    );
                                })}
                        </div>

                        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
                            <span>
                                <kbd className="font-semibold">↑↓</kbd> navigate
                            </span>
                            <span>
                                <kbd className="font-semibold">Enter</kbd> open
                            </span>
                            <span>
                                <kbd className="font-semibold">Esc</kbd> close
                            </span>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
}
