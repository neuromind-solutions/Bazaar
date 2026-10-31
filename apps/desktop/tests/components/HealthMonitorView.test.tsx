import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HealthMonitorView } from '@/src/components/HealthMonitorView';

describe('Component: HealthMonitorView', () => {
  it('renders health diagnostics headers and metrics', () => {
    render(<HealthMonitorView />);

    expect(screen.getByText(/System Health & Local SQLite Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero cloud dependence/i)).toBeInTheDocument();
    expect(screen.getByText(/HEALTHY/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run SQLite Vacuum & Reindex/i })).toBeInTheDocument();
  });

  it('triggers storage vacuum optimization when button clicked', async () => {
    render(<HealthMonitorView />);

    const button = screen.getByRole('button', { name: /Run SQLite Vacuum & Reindex/i });
    fireEvent.click(button);

    // Wait for optimized message
    await waitFor(() => {
      expect(screen.getByText(/Storage engine optimized!/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
