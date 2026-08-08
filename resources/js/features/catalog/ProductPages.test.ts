import { describe, expect, it } from 'vitest';
import { productSchema } from '@/features/catalog/ProductPages';

const validProduct = {
    sku: 'WASH-100',
    name: 'Smart Washer',
    slug: '',
    description: '',
    category_id: 1,
    brand_id: 1,
    model: 'SW-100',
    default_warranty_months: 24,
    serial_number_required: true,
    active: true,
};

describe('product form validation', () => {
    it('accepts a valid catalog product', () => {
        expect(productSchema.safeParse(validProduct).success).toBe(true);
    });

    it('requires category, brand, SKU, and model', () => {
        const result = productSchema.safeParse({
            ...validProduct,
            sku: '',
            category_id: 0,
            brand_id: 0,
            model: '',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['sku', 'category_id', 'brand_id', 'model']));
        }
    });
});
