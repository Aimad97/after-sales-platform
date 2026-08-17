import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiErrorAlert, getApiErrorMessage } from '@/components/ApiErrorAlert';

describe('ApiErrorAlert', () => {
    it('does not render an error before a request fails', () => {
        render(<ApiErrorAlert error={null} />);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('prioritizes actionable Laravel validation messages', () => {
        const error = {
            isAxiosError: true,
            response: {
                status: 422,
                data: {
                    message: 'The given data was invalid.',
                    errors: { email: ['These credentials do not match our records.'] },
                },
            },
        };

        render(<ApiErrorAlert error={error} />);

        expect(screen.getByRole('alert')).toHaveTextContent('These credentials do not match our records.');
    });

    it('provides a useful network failure message', () => {
        const error = { isAxiosError: true, response: undefined };

        expect(getApiErrorMessage(error)).toBe('The server could not be reached. Check your connection and try again.');
    });
});
