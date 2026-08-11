import { describe, expect, it } from 'vitest';
import { invoiceSchema } from '@/features/invoices/InvoicePages';

const validInvoice = {
    invoice_number: '',
    client_id: 1,
    invoice_date: '2026-01-15',
    tax_rate: 20,
    status: 'draft' as const,
    notes: '',
    items: [{ product_id: 1, serial_number: '', quantity: 2, unit_price: 100, warranty_months: 24, warranty_start_date: '' }],
};

describe('invoiceSchema', () => {
    it('accepts a complete invoice without client-calculated totals', () => {
        expect(invoiceSchema.safeParse(validInvoice).success).toBe(true);
    });

    it('rejects an invoice item with an invalid quantity', () => {
        const result = invoiceSchema.safeParse({ ...validInvoice, items: [{ ...validInvoice.items[0], quantity: 0 }] });

        expect(result.success).toBe(false);
    });
});
