import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOwnTechnicianProfile, updateOwnTechnicianProfile } from '@/features/technicians/api';
import { TechnicianFormPage, TechnicianSelfProfilePage } from '@/features/technicians/TechnicianPages';
import type { TechnicianProfile } from '@/features/technicians/types';
import { listUsers } from '@/features/users/api';
import type { ManagedUser } from '@/features/users/types';
import { renderWithProviders } from '@/test/render';

vi.mock('@/features/users/api', () => ({
    listUsers: vi.fn(),
}));

vi.mock('@/features/technicians/api', () => ({
    archiveTechnician: vi.fn(),
    createTechnician: vi.fn(),
    getOwnTechnicianProfile: vi.fn(),
    getTechnician: vi.fn(),
    listTechnicians: vi.fn(),
    updateOwnTechnicianProfile: vi.fn(),
    updateTechnician: vi.fn(),
}));

const mockedGetOwnProfile = vi.mocked(getOwnTechnicianProfile);
const mockedUpdateOwnProfile = vi.mocked(updateOwnTechnicianProfile);
const mockedListUsers = vi.mocked(listUsers);

const profile: TechnicianProfile = {
    id: 7,
    user_id: 17,
    employee_code: 'TECH-007',
    specialization: 'Computers',
    skill_level: 4,
    availability_status: 'available',
    notes: 'Internal note',
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-23T10:00:00.000Z',
    user: {
        id: 17,
        uuid: '7ac2a724-19f5-4e02-854e-52d7fbfa0cdc',
        first_name: 'Samir',
        last_name: 'Haddad',
        email: 'samir@example.test',
        phone: '+212600000000',
        status: 'active',
        roles: ['technician'],
    },
};

describe('TechnicianSelfProfilePage', () => {
    beforeEach(() => {
        mockedGetOwnProfile.mockReset();
        mockedUpdateOwnProfile.mockReset();
        mockedGetOwnProfile.mockResolvedValue(profile);
        mockedUpdateOwnProfile.mockImplementation(async (payload) => ({
            ...profile,
            specialization: payload.specialization,
            availability_status: payload.availability_status,
            user: { ...profile.user!, ...payload },
        }));
    });

    it('shows administrator-controlled fields as read-only information', async () => {
        renderWithProviders(<TechnicianSelfProfilePage />);

        expect(await screen.findByRole('heading', { name: 'My technician profile' })).toBeInTheDocument();
        expect(screen.getByText('TECH-007')).toBeInTheDocument();
        expect(screen.getByText('Level 4')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Employee code' })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Internal notes' })).not.toBeInTheDocument();
    });

    it('updates the authenticated technician contact details and availability', async () => {
        const interaction = userEvent.setup();
        renderWithProviders(<TechnicianSelfProfilePage />);

        const firstName = await screen.findByRole('textbox', { name: 'First name' });
        await interaction.clear(firstName);
        await interaction.type(firstName, 'Sami');
        await interaction.clear(screen.getByRole('textbox', { name: 'Phone' }));
        await interaction.clear(screen.getByRole('textbox', { name: 'Specialization' }));
        await interaction.type(screen.getByRole('textbox', { name: 'Specialization' }), 'Laptop repairs');
        await interaction.selectOptions(screen.getByRole('combobox', { name: 'Availability' }), 'busy');
        await interaction.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() =>
            expect(mockedUpdateOwnProfile).toHaveBeenCalledWith({
                first_name: 'Sami',
                last_name: 'Haddad',
                email: 'samir@example.test',
                phone: null,
                specialization: 'Laptop repairs',
                availability_status: 'busy',
            }),
        );
        expect(await screen.findByRole('status')).toHaveTextContent('Your profile was updated successfully.');
    });
});

const candidate: ManagedUser = {
    id: 18,
    uuid: '44dc4630-f558-4144-a297-e26fc23867a4',
    first_name: 'Youssef',
    last_name: 'Amrani',
    email: 'youssef@example.test',
    phone: null,
    locale: 'fr',
    timezone: 'Africa/Casablanca',
    client_id: null,
    status: 'active',
    last_login_at: null,
    roles: ['technician'],
    permissions: [],
    technician: null,
};

function candidateResponse(users: ManagedUser[]) {
    return {
        data: users,
        links: {},
        meta: {
            current_page: 1,
            from: users.length === 0 ? null : 1,
            last_page: 1,
            per_page: 100,
            to: users.length === 0 ? null : users.length,
            total: users.length,
        },
    };
}

describe('TechnicianFormPage', () => {
    beforeEach(() => mockedListUsers.mockReset());

    it('loads technician-role users without profiles into the candidate selector', async () => {
        mockedListUsers.mockResolvedValue(candidateResponse([candidate]));

        renderWithProviders(<TechnicianFormPage />, { route: '/admin/technicians/new' });

        expect(await screen.findByRole('option', { name: /Youssef Amrani.*youssef@example\.test/ })).toBeInTheDocument();
        expect(mockedListUsers).toHaveBeenCalledWith({
            role: 'technician',
            technician: false,
            per_page: 100,
            sort: 'first_name',
            direction: 'asc',
        });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows guidance and disables creation when every technician user already has a profile', async () => {
        mockedListUsers.mockResolvedValue(candidateResponse([]));

        renderWithProviders(<TechnicianFormPage />, { route: '/admin/technicians/new' });

        expect(await screen.findByRole('alert')).toHaveTextContent('No eligible technician users are available.');
        expect(screen.getByRole('link', { name: 'Create a technician user' })).toHaveAttribute('href', '/admin/users/new');
        expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled();
    });
});
