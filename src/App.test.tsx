import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

async function renderConnectedApp() {
  const result = render(<App />);
  fireEvent.click(screen.getByTestId('use-virtual-keyboard'));
  await screen.findByText('Connected: computer keyboard');
  return result;
}

describe('App', () => {
  it('renders the on-screen keyboard, not connected to any source initially', () => {
    render(<App />);
    expect(screen.getByText('Not connected')).toBeDefined();
  });

  it('highlights the on-screen key when a computer-keyboard key is pressed', async () => {
    const { container } = await renderConnectedApp();

    fireEvent.keyDown(window, { code: 'KeyZ' });
    expect(container.querySelector('[data-note="48"]')?.getAttribute('data-held')).toBe(
      'true',
    );

    fireEvent.keyUp(window, { code: 'KeyZ' });
    expect(container.querySelector('[data-note="48"]')?.getAttribute('data-held')).toBe(
      'false',
    );
  });

  it('flags a wrong note in the falling-note queue without advancing it', async () => {
    await renderConnectedApp();

    fireEvent.keyDown(window, { code: 'KeyE' }); // E4 (64) — not expected yet

    const current = screen.getAllByTestId('falling-note-event')[0];
    expect(current.dataset.eventId).toBe('m1-b1-e1');
    expect(current.className).toContain('falling-note--wrong');
  });

  it('does not flag a sustained correct chord note as wrong once the engine advances past it', async () => {
    await renderConnectedApp();

    // m1 b1: RH G4 (KeyT) + LH C3+G3 chord (KeyZ, KeyB)
    fireEvent.keyDown(window, { code: 'KeyT' });
    fireEvent.keyDown(window, { code: 'KeyZ' });
    fireEvent.keyDown(window, { code: 'KeyB' });
    fireEvent.keyUp(window, { code: 'KeyT' });

    // LH stays held while the RH moves on to m1 b4's repeated G4, which completes
    // that event outright and advances straight through to m1 b5
    fireEvent.keyDown(window, { code: 'KeyT' });

    const current = screen.getAllByTestId('falling-note-event')[0];
    expect(current.dataset.eventId).toBe('m1-b5-e1');
    expect(current.className).not.toContain('falling-note--wrong');
  });
});
