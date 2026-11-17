import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the title and the empty state', async () => {
    render(<App loadHealth={async () => 'ok'} />);
    expect(screen.getByRole('heading', { name: 'Home Maintenance Log' })).toBeInTheDocument();
    expect(screen.getByText('No properties yet.')).toBeInTheDocument();
    expect(await screen.findByText('API: ok')).toBeInTheDocument();
  });

  it('shows unreachable when the API cannot be reached', async () => {
    render(<App loadHealth={async () => 'unreachable'} />);
    expect(await screen.findByText('API: unreachable')).toBeInTheDocument();
  });
});
