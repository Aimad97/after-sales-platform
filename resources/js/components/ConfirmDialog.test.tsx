import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const defaultProps = {
    open: true,
    title: 'Delete attachment',
    description: 'Delete this attachment? This cannot be undone.',
    confirmLabel: 'Delete file',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
    it('exposes its title and description and safely focuses Cancel', () => {
        render(<ConfirmDialog {...defaultProps} />);

        const dialog = screen.getByRole('dialog', {
            name: defaultProps.title,
            description: defaultProps.description,
        });

        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-busy', 'false');
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        expect(document.body).toHaveStyle({ overflow: 'hidden' });
    });

    it('traps forward and backward Tab navigation inside the dialog', async () => {
        const user = userEvent.setup();
        render(<ConfirmDialog {...defaultProps} />);

        const cancelButton = screen.getByRole('button', { name: 'Cancel' });
        const confirmButton = screen.getByRole('button', { name: defaultProps.confirmLabel });

        expect(cancelButton).toHaveFocus();
        await user.tab();
        expect(confirmButton).toHaveFocus();
        await user.tab();
        expect(cancelButton).toHaveFocus();
        await user.tab({ shift: true });
        expect(confirmButton).toHaveFocus();
    });

    it('cancels with Escape or a backdrop press and restores focus when closed', () => {
        const onCancel = vi.fn();
        const trigger = document.createElement('button');
        trigger.textContent = 'Open dialog';
        document.body.appendChild(trigger);
        trigger.focus();

        const { rerender } = render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
        const dialog = screen.getByRole('dialog');
        const backdrop = dialog.parentElement;

        fireEvent.keyDown(dialog, { key: 'Escape' });
        fireEvent.mouseDown(backdrop!);
        expect(onCancel).toHaveBeenCalledTimes(2);

        rerender(<ConfirmDialog {...defaultProps} open={false} onCancel={onCancel} />);
        expect(trigger).toHaveFocus();
        expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
        trigger.remove();
    });

    it('blocks dismissal and repeated actions while pending', () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();
        const { rerender } = render(<ConfirmDialog {...defaultProps} onCancel={onCancel} onConfirm={onConfirm} />);

        const confirmButton = screen.getByRole('button', { name: defaultProps.confirmLabel });
        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);
        expect(onConfirm).toHaveBeenCalledTimes(1);

        rerender(<ConfirmDialog {...defaultProps} isPending onCancel={onCancel} onConfirm={onConfirm} />);
        const dialog = screen.getByRole('dialog');
        fireEvent.keyDown(dialog, { key: 'Escape' });
        fireEvent.mouseDown(dialog.parentElement!);
        fireEvent.click(screen.getByRole('button', { name: 'Working…' }));

        expect(dialog).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
        expect(onCancel).not.toHaveBeenCalled();
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
