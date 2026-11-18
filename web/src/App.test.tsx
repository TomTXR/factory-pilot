import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(cleanup);

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

  it('shows the version in the footer', async () => {
    render(<App loadHealth={async () => 'ok'} loadVersion={async () => '1.2.3'} />);
    expect(await screen.findByText('Version 1.2.3')).toBeInTheDocument();
  });

  it('shows Version unknown when the version is unavailable', async () => {
    render(<App loadHealth={async () => 'ok'} loadVersion={async () => null} />);
    expect(await screen.findByText('Version unknown')).toBeInTheDocument();
  });

  it('shows no version while it is loading', () => {
    render(<App loadHealth={async () => 'ok'} loadVersion={() => new Promise(() => {})} />);
    expect(screen.queryByTestId('app-version')).not.toBeInTheDocument();
  });
});
