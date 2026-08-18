import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from '@/components/FormField';

describe('FormField', () => {
    it('associates the label, hint, validation state, and error with its control', () => {
        render(
            <FormField label="Email address" hint="Use the address on your account." error="Enter a valid email address." required>
                <input type="email" />
            </FormField>,
        );

        const input = screen.getByRole('textbox', { name: 'Email address' });
        const error = screen.getByRole('alert');
        const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? [];

        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-required', 'true');
        expect(describedBy).toContain(error.id);
        expect(describedBy).toContain(screen.getByText('Use the address on your account.').id);
    });

    it('preserves a caller-provided control id and description', () => {
        render(
            <>
                <p id="external-description">External description</p>
                <FormField label="Serial number">
                    <input id="serial-number" aria-describedby="external-description" />
                </FormField>
            </>,
        );

        const input = screen.getByRole('textbox', { name: 'Serial number' });
        expect(input).toHaveAttribute('id', 'serial-number');
        expect(input).toHaveAttribute('aria-describedby', 'external-description');
    });
});
