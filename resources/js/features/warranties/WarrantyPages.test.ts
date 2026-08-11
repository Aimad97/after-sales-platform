import { describe, expect, it } from 'vitest';
import { warrantyUpdateSchema } from '@/features/warranties/WarrantyPages';

describe('warrantyUpdateSchema', () => {
    it('requires a reason when a warranty is voided', () => {
        expect(warrantyUpdateSchema.safeParse({ status: 'void', void_reason: '', notes: '' }).success).toBe(false);
    });

    it('allows a replaced warranty without a void reason', () => {
        expect(warrantyUpdateSchema.safeParse({ status: 'replaced', void_reason: '', notes: 'Replacement unit issued.' }).success).toBe(true);
    });
});
