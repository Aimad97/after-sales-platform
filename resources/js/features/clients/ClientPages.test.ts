import { describe, expect, it } from 'vitest';
import { clientSchema } from '@/features/clients/ClientPages';

const individualClient = {
    type: 'individual' as const,
    company_name: '',
    first_name: 'Sara',
    last_name: 'El Mansouri',
    email: 'sara@example.test',
    phone: '+212600000000',
    address: '',
    city: 'Casablanca',
    tax_identifier: '',
    notes: '',
};

describe('client form validation', () => {
    it('accepts a complete individual client', () => {
        expect(clientSchema.safeParse(individualClient).success).toBe(true);
    });

    it('requires company identity fields for a company client', () => {
        const result = clientSchema.safeParse({ ...individualClient, type: 'company' });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['company_name', 'tax_identifier']));
        }
    });
});
