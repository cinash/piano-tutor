import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PianoKeyboard } from './PianoKeyboard';

describe('PianoKeyboard', () => {
  it('renders a key for every note in the range', () => {
    const { container } = render(
      <PianoKeyboard lowNote={60} highNote={64} heldNotes={new Set()} />,
    );

    expect(container.querySelectorAll('[data-note]')).toHaveLength(5);
  });

  it('marks held notes and leaves the rest unmarked', () => {
    const { container } = render(
      <PianoKeyboard lowNote={60} highNote={64} heldNotes={new Set([60, 64])} />,
    );

    expect(container.querySelector('[data-note="60"]')?.getAttribute('data-held')).toBe(
      'true',
    );
    expect(container.querySelector('[data-note="64"]')?.getAttribute('data-held')).toBe(
      'true',
    );
    expect(container.querySelector('[data-note="62"]')?.getAttribute('data-held')).toBe(
      'false',
    );
  });
});
