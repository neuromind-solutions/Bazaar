import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthorizeActionModal } from '@/src/components/AuthorizeActionModal';
import { DEFAULT_SETTINGS } from '@/src/db/sqliteStorage';

describe('Component: AuthorizeActionModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AuthorizeActionModal
        isOpen={false}
        actionName="Void Invoice"
        settings={DEFAULT_SETTINGS}
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with action name when isOpen is true', () => {
    render(
      <AuthorizeActionModal
        isOpen={true}
        actionName="Void Invoice #100"
        settings={DEFAULT_SETTINGS}
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Manager Authorization Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Void Invoice #100/i)).toBeInTheDocument();
  });

  it('authorizes successfully when entering master PIN 1234', () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <AuthorizeActionModal
        isOpen={true}
        actionName="Apply High Discount"
        settings={DEFAULT_SETTINGS}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    );

    const pinInput = screen.getByPlaceholderText('••••');
    fireEvent.change(pinInput, { target: { value: '1234' } });

    const submitBtn = screen.getByRole('button', { name: /Authorize Action/i });
    fireEvent.click(submitBtn);

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows error message when entering invalid PIN', () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <AuthorizeActionModal
        isOpen={true}
        actionName="Apply High Discount"
        settings={DEFAULT_SETTINGS}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    );

    const pinInput = screen.getByPlaceholderText('••••');
    fireEvent.change(pinInput, { target: { value: '9999' } });

    const submitBtn = screen.getByRole('button', { name: /Authorize Action/i });
    fireEvent.click(submitBtn);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid PIN or insufficient role permissions/i)).toBeInTheDocument();
  });
});
