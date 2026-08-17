import axios from 'axios';
import type { ApiErrorResponse } from '@/api/client';

interface ApiErrorAlertProps {
    error: unknown;
    fallback?: string;
    className?: string;
}

export function getApiErrorMessage(error: unknown, fallback = 'The request could not be completed.'): string | null {
    if (error === null || error === undefined) return null;

    if (axios.isAxiosError<ApiErrorResponse>(error)) {
        const response = error.response;
        const validationMessage = response?.data?.errors ? Object.values(response.data.errors).flat()[0] : undefined;

        if (validationMessage) return validationMessage;
        if (response?.data?.message) return response.data.message;
        if (response?.status === 419) return 'Your session expired. Refresh the page and try again.';
        if (response?.status === 422) return 'The submitted details could not be verified.';
        if (response?.status === 429) return 'Too many attempts. Please wait a moment and try again.';
        if (!response) return 'The server could not be reached. Check your connection and try again.';
    }

    return error instanceof Error && error.message ? error.message : fallback;
}

export function ApiErrorAlert({ error, fallback, className = '' }: ApiErrorAlertProps) {
    const message = getApiErrorMessage(error, fallback);
    if (!message) return null;

    return (
        <p className={`rounded-md bg-rose-50 p-3 text-sm text-rose-700 ${className}`.trim()} role="alert">
            {message}
        </p>
    );
}
