import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Finger, Hand, Note } from '../score/types';
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
        handPositions={[]}
        nextHandPositions={[]}
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
        handPositions={[]}
        nextHandPositions={[]}
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
        handPositions={[]}
        nextHandPositions={[]}
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
        handPositions={[]}
        nextHandPositions={[]}
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
        handPositions={[]}
        nextHandPositions={[]}
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
        handPositions={[]}
        nextHandPositions={[]}
      />,
    );
    const key = (pitch: number) => container.querySelector(`[data-note="${pitch}"]`);

    expect(key(67)?.getAttribute('data-finger')).toBe('3');
    expect(key(67)?.textContent).toBe('3G4');
    expect(key(67)?.className).toContain('piano-key--expected-right');
    expect(key(65)?.hasAttribute('data-finger')).toBe(false);
  });

  it('tints and numbers the five keys of a hand position, black keys included', () => {
    // F major under the right hand: F4 G4 A4 B-flat4 C5 on 1-5.
    const position = [65, 67, 69, 70, 72].map((pitch, i) => ({
      pitch,
      hand: 'right' as const,
      finger: (i + 1) as Finger,
    }));
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={72}
        heldNotes={new Set([67])}
        expectedNotes={[{ pitch: 69, hand: 'right', finger: 3 }]}
        handPositions={position}
        nextHandPositions={[]}
      />,
    );
    const key = (pitch: number) => container.querySelector(`[data-note="${pitch}"]`);
    const marks = (pitch: number) => [
      key(pitch)?.getAttribute('data-position-hand'),
      key(pitch)?.getAttribute('data-finger'),
    ];

    expect(marks(65)).toEqual(['right', '1']);
    expect(marks(70)).toEqual(['right', '4']); // a black key in the position
    expect(key(70)?.className).toContain('piano-key--position-right');
    expect(marks(66)).toEqual([null, null]); // a black key between, which no finger rests on
    expect(marks(68)).toEqual([null, null]);
    // The expected key keeps its strong colour and its number, a held one its number.
    expect(key(69)?.className).toContain('piano-key--expected-right');
    expect(marks(69)).toEqual(['right', '3']);
    expect(key(67)?.className).toContain('piano-key--held');
    expect(marks(67)).toEqual(['right', '2']);
  });

  it('outlines the next position, numbering a key in both with both fingers', () => {
    const right = (pitches: number[]) =>
      pitches.map((pitch, i) => ({
        pitch,
        hand: 'right' as const,
        finger: (i + 1) as Finger,
      }));
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={77}
        heldNotes={new Set()}
        expectedNotes={[]}
        handPositions={right([64, 65, 67, 69, 71])} // E4-B4
        nextHandPositions={right([71, 72, 74, 76, 77])} // B4-F5
      />,
    );
    const key = (pitch: number) => container.querySelector(`[data-note="${pitch}"]`);
    const marks = (pitch: number) => [
      key(pitch)?.getAttribute('data-finger'),
      key(pitch)?.getAttribute('data-next-hand'),
      key(pitch)?.getAttribute('data-next-finger'),
    ];

    expect(marks(74)).toEqual([null, 'right', '3']);
    expect(key(74)?.className).toContain('piano-key--next-right');
    expect(marks(71)).toEqual(['5', 'right', '1']); // B4: 5 now, 1 next
    expect(key(71)?.textContent).toBe('15B4'); // the faint next number above
    expect(marks(64)).toEqual(['1', null, null]);
  });

  it('names every white key and leaves the black keys bare', () => {
    const { container } = render(
      <PianoKeyboard
        lowNote={60}
        highNote={72}
        heldNotes={new Set()}
        expectedNotes={[]}
        handPositions={[]}
        nextHandPositions={[]}
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
        handPositions={[]}
        nextHandPositions={[]}
      />,
    );

    expect(getByText(/Left hand/)).toBeTruthy();
    expect(getByText(/Right hand/)).toBeTruthy();
  });
});
