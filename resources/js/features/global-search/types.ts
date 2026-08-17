export const MIN_SEARCH_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 300;

export const searchCategories = ['clients', 'tickets', 'invoices', 'serial_numbers', 'products', 'technicians'] as const;

export type SearchCategory = (typeof searchCategories)[number];

export interface GlobalSearchResult {
    id: string;
    title: string;
    subtitle: string | null;
    url: string;
}

export type GlobalSearchGroups = Record<SearchCategory, GlobalSearchResult[]>;

export interface GlobalSearchData {
    query: string;
    groups: GlobalSearchGroups;
    total: number;
    limit_per_category: number;
}

export interface CategorizedSearchResults {
    category: SearchCategory;
    label: string;
    results: GlobalSearchResult[];
}

const categoryLabels: Record<SearchCategory, string> = {
    clients: 'Clients',
    tickets: 'Tickets',
    invoices: 'Invoices',
    serial_numbers: 'Serial numbers',
    products: 'Products',
    technicians: 'Technicians',
};

export function normalizeSearchQuery(query: string): string {
    return query.trim();
}

export function canSubmitSearch(query: string): boolean {
    return normalizeSearchQuery(query).length >= MIN_SEARCH_LENGTH;
}

export function categorizeSearchResults(groups: GlobalSearchGroups): CategorizedSearchResults[] {
    return searchCategories
        .filter((category) => groups[category].length > 0)
        .map((category) => ({ category, label: categoryLabels[category], results: groups[category] }));
}

export function flattenSearchResults(groups: GlobalSearchGroups): GlobalSearchResult[] {
    return searchCategories.flatMap((category) => groups[category]);
}
