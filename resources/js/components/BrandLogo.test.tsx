import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApplicationBrand, BrandLoader, BrandLogo } from '@/components/BrandLogo';

describe('UltraPC branding', () => {
    it('renders the locally hosted official logo with useful alternative text', () => {
        render(<BrandLogo />);

        expect(screen.getByRole('img', { name: 'UltraPC.MA Hardware Solutions' })).toHaveAttribute('src', '/images/ultrapc-logo.png');
    });

    it('identifies the active application workspace', () => {
        render(<ApplicationBrand variant="client" />);

        expect(screen.getByText('UltraPC Care - Client portal')).toBeInTheDocument();
    });

    it('announces loading and renders the five brand-inspired motion bands', () => {
        render(<BrandLoader label="Loading ticket..." />);

        expect(screen.getByRole('status', { name: 'Loading ticket...' })).toBeInTheDocument();
        expect(screen.getByTestId('brand-motion').children).toHaveLength(5);
    });
});
