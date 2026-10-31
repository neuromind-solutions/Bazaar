import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirstTimeSetupModal } from '@/src/components/FirstTimeSetupModal';
import { DEFAULT_SETTINGS } from '@/src/db/sqliteStorage';

describe('Component: FirstTimeSetupModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <FirstTimeSetupModal
        isOpen={false}
        onSave={vi.fn()}
        initialSettings={DEFAULT_SETTINGS}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders shop configuration fields when isOpen is true', () => {
    render(
      <FirstTimeSetupModal
        isOpen={true}
        onSave={vi.fn()}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    expect(screen.getByText(/Welcome to Offline Grocery POS/i)).toBeInTheDocument();
    expect(screen.getByText(/Solo Owner/i)).toBeInTheDocument();
    expect(screen.getByText(/Team \/ Multi-Staff/i)).toBeInTheDocument();
  });

  it('allows switching operating mode between Solo and Multi-Staff', () => {
    render(
      <FirstTimeSetupModal
        isOpen={true}
        onSave={vi.fn()}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    const soloRadio = screen.getByDisplayValue('solo');
    const multiRadio = screen.getByDisplayValue('multi');

    expect(soloRadio).toBeInTheDocument();
    expect(multiRadio).toBeInTheDocument();

    fireEvent.click(multiRadio);
    expect(multiRadio).toBeChecked();
  });
});
