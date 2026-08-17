import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const inputRef = useRef<HTMLInputElement>(null);
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
    const groups = useMemo(
        () => searchQuery.data ? categorizeSearchResults(searchQuery.data.groups) : [],
        [searchQuery.data],
    );
    const results = useMemo(
        () => searchQuery.data ? flattenSearchResults(searchQuery.data.groups) : [],
        [searchQuery.data],
    );
    const isWaitingForDebounce = canSubmitSearch(normalizedQuery) && normalizedQuery !== debouncedQuery;

    const close = useCallback(() => {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(0);
    }, []);

    const selectResult = useCallback((url: string) => {
        close();
        navigate(url);
    }, [close, navigate]);

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
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [normalizedQuery]);

    useEffect(() => {
        if (selectedIndex >= results.length && results.length > 0) {
            setSelectedIndex(results.length - 1);
        }
    }, [results.length, selectedIndex]);

    const onPaletteKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
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
            selectResult(results[selectedIndex].url);
        }
    };

    return (
        <>
            <button
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                type="button"
                aria-label="Open global search"
                onClick={() => setIsOpen(true)}
            >
                <Search size={18} />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 lg:inline">Ctrl K</kbd>
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-4 pt-[10vh] backdrop-blur-sm"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.currentTarget === event.target) close();
                    }}
                >
                    <section
                        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Global search"
                        onKeyDown={onPaletteKeyDown}
                    >
                        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
                            <Search className="shrink-0 text-slate-400" size={20} />
                            <input
                                ref={inputRef}
                                className="min-w-0 flex-1 border-0 bg-transparent py-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
                                value={query}
                                placeholder="Search clients, tickets, invoices, serials..."
                                aria-label="Search query"
                                aria-controls="global-search-results"
                                aria-activedescendant={results.length > 0 ? `global-search-result-${selectedIndex}` : undefined}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" type="button" aria-label="Close search" onClick={close}><X size={19} /></button>
                        </div>

                        <div id="global-search-results" className="max-h-[65vh] overflow-y-auto p-2" role="listbox">
                            {!canSubmitSearch(normalizedQuery) && <p className="p-6 text-center text-sm text-slate-500">Enter at least {MIN_SEARCH_LENGTH} characters to search.</p>}
                            {canSubmitSearch(normalizedQuery) && (isWaitingForDebounce || searchQuery.isFetching) && <p className="p-6 text-center text-sm text-slate-500" role="status">Searching...</p>}
                            {!isWaitingForDebounce && searchQuery.error && <p className="m-2 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">Search is temporarily unavailable. Please try again.</p>}
                            {!isWaitingForDebounce && !searchQuery.isFetching && !searchQuery.error && searchQuery.data?.total === 0 && <p className="p-6 text-center text-sm text-slate-500">No authorized results found for “{searchQuery.data.query}”.</p>}

                            {!isWaitingForDebounce && !searchQuery.isFetching && groups.map((group) => {
                                const precedingCount = groups
                                    .slice(0, groups.indexOf(group))
                                    .reduce((total, item) => total + item.results.length, 0);

                                return (
                                    <section key={group.category} className="py-1" aria-label={group.label}>
                                        <h2 className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{group.label}</h2>
                                        {group.results.map((result, index) => {
                                            const absoluteIndex = precedingCount + index;
                                            return (
                                                <button
                                                    id={`global-search-result-${absoluteIndex}`}
                                                    key={`${group.category}-${result.id}`}
                                                    className={`block w-full rounded-lg px-3 py-2.5 text-left ${selectedIndex === absoluteIndex ? 'bg-blue-50 text-blue-950' : 'text-slate-900 hover:bg-slate-50'}`}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={selectedIndex === absoluteIndex}
                                                    onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                                                    onClick={() => selectResult(result.url)}
                                                >
                                                    <span className="block font-semibold">{result.title}</span>
                                                    {result.subtitle && <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span>}
                                                </button>
                                            );
                                        })}
                                    </section>
                                );
                            })}
                        </div>

                        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                            <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
                            <span><kbd className="font-semibold">Enter</kbd> open</span>
                            <span><kbd className="font-semibold">Esc</kbd> close</span>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
}
