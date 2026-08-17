import { describe, expect, it } from 'vitest';
import {
    canSubmitSearch,
    categorizeSearchResults,
    flattenSearchResults,
    normalizeSearchQuery,
    type GlobalSearchGroups,
} from '@/features/global-search/types';

const emptyGroups = (): GlobalSearchGroups => ({
    clients: [],
    tickets: [],
    invoices: [],
    serial_numbers: [],
    products: [],
    technicians: [],
});

describe('global search helpers', () => {
    it('trims queries and enforces the two-character request threshold', () => {
        expect(normalizeSearchQuery('  TKT-123  ')).toBe('TKT-123');
        expect(canSubmitSearch(' a ')).toBe(false);
        expect(canSubmitSearch(' ab ')).toBe(true);
    });

    it('preserves category order while omitting empty groups', () => {
        const groups = emptyGroups();
        groups.tickets.push({ id: 'ticket-1', title: 'TKT-1', subtitle: null, url: '/admin/tickets/ticket-1' });
        groups.products.push({ id: 'product-1', title: 'Laptop', subtitle: 'SKU-1', url: '/admin/products/product-1' });

        expect(categorizeSearchResults(groups).map((group) => group.label)).toEqual(['Tickets', 'Products']);
        expect(flattenSearchResults(groups).map((result) => result.id)).toEqual(['ticket-1', 'product-1']);
    });
});
