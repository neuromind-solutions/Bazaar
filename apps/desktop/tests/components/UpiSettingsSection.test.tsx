import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpiSettingsSection } from '@/src/components/UpiSettingsSection';
import { DEFAULT_SETTINGS } from '@/src/db/sqliteStorage';

describe('Component: UpiSettingsSection', () => {
  it('renders UPI configuration form fields', () => {
    render(
      <UpiSettingsSection
        settings={DEFAULT_SETTINGS}
        onUpdateSettings={vi.fn()}
      />
    );

    expect(screen.getByText(/Dynamic UPI Payment Module Settings/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/UPI Enabled/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/merchant@upi/i)).toBeInTheDocument();
  });

  it('updates form and calls onUpdateSettings when save clicked', () => {
    const onUpdateSettings = vi.fn();
    render(
      <UpiSettingsSection
        settings={DEFAULT_SETTINGS}
        onUpdateSettings={onUpdateSettings}
      />
    );

    const saveButton = screen.getByRole('button', { name: /Save UPI Settings/i });
    fireEvent.click(saveButton);

    expect(onUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        upiId: 'merchant@upi',
      })
    );
  });
});
