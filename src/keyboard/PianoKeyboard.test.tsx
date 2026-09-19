import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Note } from '../score/types';
import { PianoKeyboard } from './PianoKeyboard';

const note = (pitch: number): Note => ({ pitch, hand: 'right' });

describe('PianoKeyboard', () => {
  it('renders a key for every note in the range', () => {
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={64}
        heldNotes={new Set()}
        expectedNotes={[]}
      />,
    );

    expect(container.querySelectorAll('[data-note]')).toHaveLength(5);
  });

  it('marks held notes and leaves the rest unmarked', () => {
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={64}
        heldNotes={new Set([60, 64])}
        expectedNotes={[]}
      />,
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

  it('marks expected notes independently of held ones', () => {
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={64}
        heldNotes={new Set([62, 64])}
        expectedNotes={[note(60), note(64)]}
      />,
    );
    const state = (pitch: number) => {
      const key = container.querySelector(`[data-note="${pitch}"]`);
      return [key?.getAttribute('data-expected'), key?.getAttribute('data-held')];
    };

    expect(state(60)).toEqual(['true', 'false']); // expected only
    expect(state(62)).toEqual(['false', 'true']); // held only
    expect(state(64)).toEqual(['true', 'true']); // both
    expect(state(61)).toEqual(['false', 'false']); // neither
  });

  it('renders a key that is both expected and held as held', () => {
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={64}
        heldNotes={new Set([64])}
        expectedNotes={[note(64)]}
      />,
    );

    expect(container.querySelector('[data-note="64"]')?.className).toContain(
      'piano-key--held',
    );
    expect(container.querySelector('[data-note="64"]')?.className).not.toContain(
      'piano-key--expected',
    );
  });
});
