import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Hand, Note } from '../score/types';
import { PianoKeyboard } from './PianoKeyboard';

const note = (pitch: number, hand: Hand = 'right'): Note => ({ pitch, hand });

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
        expectedNotes={[note(64, 'left')]}
      />,
    );

    expect(container.querySelector('[data-note="64"]')?.className).toContain(
      'piano-key--held',
    );
    expect(container.querySelector('[data-note="64"]')?.className).not.toContain(
      'piano-key--expected',
    );
    // The attribute still reports the lookup; only the colour follows held.
    expect(container.querySelector('[data-note="64"]')?.getAttribute('data-hand')).toBe(
      'left',
    );
  });

  it('names the hand that plays each expected key', () => {
    const { container } = render(
      <PianoKeyboard
        lowNote={48}
        highNote={67}
        heldNotes={new Set()}
        expectedNotes={[note(48, 'left'), note(55, 'left'), note(67, 'right')]}
      />,
    );
    const hand = (pitch: number) =>
      container.querySelector(`[data-note="${pitch}"]`)?.getAttribute('data-hand');

    expect(hand(48)).toBe('left');
    expect(hand(55)).toBe('left');
    expect(hand(67)).toBe('right');
    expect(hand(60)).toBeNull(); // not expected at all
  });

  it('numbers each expected key with the finger that plays it', () => {
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={67}
        heldNotes={new Set()}
        expectedNotes={[{ pitch: 67, hand: 'right', finger: 3 }]}
      />,
    );
    const key = (pitch: number) => container.querySelector(`[data-note="${pitch}"]`);

    expect(key(67)?.getAttribute('data-finger')).toBe('3');
    expect(key(67)?.textContent).toBe('3G4');
    expect(key(67)?.className).toContain('piano-key--expected-right');
    expect(key(65)?.hasAttribute('data-finger')).toBe(false);
  });

  it('names every white key and leaves the black keys bare', () => {
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={72}
        heldNotes={new Set()}
        expectedNotes={[]}
      />,
    );
    const labels = (color: 'white' | 'black') =>
      Array.from(container.querySelectorAll(`.piano-key--${color}`)).map(
        (key) => key.textContent,
      );

    expect(labels('white')).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect(labels('black')).toEqual(['', '', '', '', '']);
  });

  it('labels the two hand colours beside the keyboard', () => {
    const { getByText } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={64}
        heldNotes={new Set()}
        expectedNotes={[]}
      />,
    );

    expect(getByText(/Left hand/)).toBeTruthy();
    expect(getByText(/Right hand/)).toBeTruthy();
  });
});
