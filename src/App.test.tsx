import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the on-screen keyboard, not connected to any source initially', () => {
    render(<App />);
    expect(screen.getByText('Not connected')).toBeDefined();
  });

  it('highlights the on-screen key when a computer-keyboard key is pressed', async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByTestId('use-virtual-keyboard'));
    await screen.findByText('Connected: computer keyboard');

    fireEvent.keyDown(window, { code: 'KeyZ' });
    expect(container.querySelector('[data-note="48"]')?.getAttribute('data-held')).toBe(
      'true',
    );

    fireEvent.keyUp(window, { code: 'KeyZ' });
    expect(container.querySelector('[data-note="48"]')?.getAttribute('data-held')).toBe(
      'false',
    );
  });
});
