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

    // Completing m1 b1's chord (RH G4 + LH C3+G3) advances straight to m1 b4, which
    // wants G4 again — not C3 or G3, so a naive "is this held pitch still current or
    // next" check on the accumulated held notes would wrongly flag the LH pair the
    // instant this chord completes, even though nothing wrong was played. Assert here
    // and not a beat later: m2 b1 repeats m1 b1's exact chord, so checking past m1 b5
    // would pass under that naive check too, for the wrong reason.
    fireEvent.keyDown(window, { code: 'KeyT' });
    fireEvent.keyDown(window, { code: 'KeyZ' });
    fireEvent.keyDown(window, { code: 'KeyB' });

    const current = screen.getAllByTestId('falling-note-event')[0];
    expect(current.dataset.eventId).toBe('m1-b4-e1');
    expect(current.className).not.toContain('falling-note--wrong');
  });
});
