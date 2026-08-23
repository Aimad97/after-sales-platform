import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TechnicianRepairWorkflow } from '@/features/repairs/RepairPages';
import { completeRepair, recordDiagnosis, startRepair, updateRepair } from '@/features/repairs/api';
import type { Repair } from '@/features/repairs/types';
import { renderWithProviders } from '@/test/render';

vi.mock('@/features/repairs/api', () => ({
    completeRepair: vi.fn(),
    getRepair: vi.fn(),
    listRepairs: vi.fn(),
    recordDiagnosis: vi.fn(),
    startDiagnosis: vi.fn(),
    startRepair: vi.fn(),
    updateRepair: vi.fn(),
}));

const baseRepair: Repair = {
    id: 31,
    ticket_id: 88,
    technician_id: 4,
    diagnosis: null,
    root_cause: null,
    repair_action: null,
    internal_notes: null,
    customer_notes: null,
    labor_cost: '0.00',
    parts_cost: '0.00',
    total_cost: '0.00',
    started_at: null,
    completed_at: null,
    result: null,
    ticket: {
        uuid: '60b15387-ee5a-47ac-b177-4bad9c78b8d0',
        ticket_number: 'SAV-2026-0088',
        title: 'Intermittent shutdown',
        status: 'diagnosing',
        client: 'Omar Idrissi',
        product: 'UltraBook Pro',
    },
    technician: { id: 4, employee_code: 'TECH-004', name: 'Sara El Amrani' },
    history: [],
    created_at: '2026-08-17T09:00:00Z',
    updated_at: '2026-08-17T09:00:00Z',
};

const mockedRecordDiagnosis = vi.mocked(recordDiagnosis);
const mockedStartRepair = vi.mocked(startRepair);
const mockedUpdateRepair = vi.mocked(updateRepair);
const mockedCompleteRepair = vi.mocked(completeRepair);

describe('TechnicianRepairWorkflow', () => {
    beforeEach(() => {
        mockedRecordDiagnosis.mockReset();
        mockedStartRepair.mockReset();
        mockedUpdateRepair.mockReset();
        mockedCompleteRepair.mockReset();
    });

    it('records a diagnosis with a controlled next status', async () => {
        const user = userEvent.setup();
        const diagnosedRepair: Repair = {
            ...baseRepair,
            diagnosis: 'Power board failure confirmed.',
            root_cause: 'Power surge.',
            ticket: { ...baseRepair.ticket!, status: 'awaiting_part' },
        };
        mockedRecordDiagnosis.mockResolvedValue(diagnosedRepair);
        const onUpdated = vi.fn();
        renderWithProviders(<TechnicianRepairWorkflow repair={baseRepair} onUpdated={onUpdated} />);

        await user.type(screen.getByRole('textbox', { name: 'Diagnosis' }), 'Power board failure confirmed.');
        await user.type(screen.getByRole('textbox', { name: 'Root cause' }), 'Power surge.');
        await user.selectOptions(screen.getByRole('combobox', { name: 'Next ticket status' }), 'awaiting_part');
        await user.click(screen.getByRole('button', { name: 'Save diagnosis' }));

        await waitFor(() =>
            expect(mockedRecordDiagnosis).toHaveBeenCalledWith(baseRepair.id, {
                diagnosis: 'Power board failure confirmed.',
                root_cause: 'Power surge.',
                customer_notes: null,
                labor_cost: '0.00',
                parts_cost: '0.00',
                next_status: 'awaiting_part',
            }),
        );
        expect(onUpdated).toHaveBeenCalledWith(diagnosedRepair);
    });

    it('submits the diagnosis and customer quote together before requesting approval', async () => {
        const user = userEvent.setup();
        const quotedRepair: Repair = {
            ...baseRepair,
            diagnosis: 'The paper-feed rollers need replacement.',
            labor_cost: '120.00',
            parts_cost: '280.00',
            total_cost: '400.00',
            ticket: { ...baseRepair.ticket!, status: 'awaiting_customer_approval' },
        };
        mockedRecordDiagnosis.mockResolvedValue(quotedRepair);
        renderWithProviders(<TechnicianRepairWorkflow repair={baseRepair} onUpdated={vi.fn()} />);

        await user.type(screen.getByRole('textbox', { name: 'Diagnosis' }), 'The paper-feed rollers need replacement.');
        await user.clear(screen.getByRole('textbox', { name: 'Quoted labor cost (MAD)' }));
        await user.type(screen.getByRole('textbox', { name: 'Quoted labor cost (MAD)' }), '120.00');
        await user.clear(screen.getByRole('textbox', { name: 'Quoted parts cost (MAD)' }));
        await user.type(screen.getByRole('textbox', { name: 'Quoted parts cost (MAD)' }), '280.00');
        await user.selectOptions(screen.getByRole('combobox', { name: 'Next ticket status' }), 'awaiting_customer_approval');
        await user.click(screen.getByRole('button', { name: 'Save diagnosis' }));

        await waitFor(() =>
            expect(mockedRecordDiagnosis).toHaveBeenCalledWith(
                baseRepair.id,
                expect.objectContaining({
                    diagnosis: 'The paper-feed rollers need replacement.',
                    labor_cost: '120.00',
                    parts_cost: '280.00',
                    next_status: 'awaiting_customer_approval',
                }),
            ),
        );
    });

    it('starts work only from the awaiting-part step', async () => {
        const user = userEvent.setup();
        const awaitingPartRepair: Repair = {
            ...baseRepair,
            diagnosis: 'Power board failure confirmed.',
            ticket: { ...baseRepair.ticket!, status: 'awaiting_part' },
        };
        const startedRepair: Repair = {
            ...awaitingPartRepair,
            started_at: '2026-08-17T10:00:00Z',
            ticket: { ...baseRepair.ticket!, status: 'repairing' },
        };
        mockedStartRepair.mockResolvedValue(startedRepair);
        const onUpdated = vi.fn();
        renderWithProviders(<TechnicianRepairWorkflow repair={awaitingPartRepair} onUpdated={onUpdated} />);

        await user.click(screen.getByRole('button', { name: 'Start repair work' }));

        await waitFor(() => expect(mockedStartRepair).toHaveBeenCalledWith(baseRepair.id));
        expect(onUpdated).toHaveBeenCalledWith(startedRepair);
    });

    it('saves technician details and completes an active repair', async () => {
        const user = userEvent.setup();
        const activeRepair: Repair = {
            ...baseRepair,
            diagnosis: 'Power board failure confirmed.',
            started_at: '2026-08-17T10:00:00Z',
            ticket: { ...baseRepair.ticket!, status: 'repairing' },
        };
        const updatedRepair: Repair = {
            ...activeRepair,
            repair_action: 'Replaced power board.',
            internal_notes: 'Burn-in test passed.',
            labor_cost: '80.00',
            parts_cost: '120.00',
            total_cost: '200.00',
        };
        const completedRepair: Repair = {
            ...updatedRepair,
            completed_at: '2026-08-17T13:00:00Z',
            result: 'repaired',
            customer_notes: 'Ready for collection.',
            ticket: { ...baseRepair.ticket!, status: 'testing' },
        };
        mockedUpdateRepair.mockResolvedValue(updatedRepair);
        mockedCompleteRepair.mockResolvedValue(completedRepair);
        const onUpdated = vi.fn();
        renderWithProviders(<TechnicianRepairWorkflow repair={activeRepair} onUpdated={onUpdated} />);

        await user.type(screen.getByRole('textbox', { name: 'Repair action' }), 'Replaced power board.');
        await user.type(screen.getByRole('textbox', { name: 'Internal technician notes' }), 'Burn-in test passed.');
        await user.clear(screen.getByRole('textbox', { name: 'Labor cost (MAD)' }));
        await user.type(screen.getByRole('textbox', { name: 'Labor cost (MAD)' }), '80.00');
        await user.clear(screen.getByRole('textbox', { name: 'Parts cost (MAD)' }));
        await user.type(screen.getByRole('textbox', { name: 'Parts cost (MAD)' }), '120.00');
        await user.click(screen.getByRole('button', { name: 'Save repair details' }));

        await waitFor(() =>
            expect(mockedUpdateRepair).toHaveBeenCalledWith(
                baseRepair.id,
                expect.objectContaining({
                    repair_action: 'Replaced power board.',
                    internal_notes: 'Burn-in test passed.',
                    labor_cost: '80.00',
                    parts_cost: '120.00',
                }),
            ),
        );

        await user.type(screen.getByRole('textbox', { name: 'Final customer-visible notes' }), 'Ready for collection.');
        await user.click(screen.getByRole('button', { name: 'Review completion' }));
        await user.click(await screen.findByRole('button', { name: 'Complete repair' }));

        await waitFor(() =>
            expect(mockedCompleteRepair).toHaveBeenCalledWith(baseRepair.id, {
                result: 'repaired',
                customer_notes: 'Ready for collection.',
            }),
        );
    });
});
