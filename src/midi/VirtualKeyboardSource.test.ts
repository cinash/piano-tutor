import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MidiEvent } from './types';
import { VirtualKeyboardSource } from './VirtualKeyboardSource';

function keydown(code: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }));
}

function keyup(code: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

describe('VirtualKeyboardSource', () => {
  let source: VirtualKeyboardSource;
  let received: MidiEvent[];

  beforeEach(async () => {
    source = new VirtualKeyboardSource();
    received = [];
    source.onEvent((e) => received.push(e));
    await source.start();
  });

  afterEach(() => {
    source.stop();
  });

  it('emits noteOn for a mapped key and noteOff on release', () => {
    keydown('KeyZ');
    keyup('KeyZ');

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ type: 'noteOn', note: 48, velocity: 100 });
    expect(received[1]).toMatchObject({ type: 'noteOff', note: 48 });
  });

  it('maps the second row an octave above the first, overlapping at the top note', () => {
    keydown('KeyQ');
    expect(received[0]).toMatchObject({ type: 'noteOn', note: 60 });
    keyup('KeyQ');

    keydown('Comma');
    expect(received[2]).toMatchObject({ type: 'noteOn', note: 60 });
  });

  it('ignores OS key-repeat events while a key is held', () => {
    keydown('KeyZ');
    keydown('KeyZ', true);
    keydown('KeyZ', true);

    expect(received).toHaveLength(1);
  });

  it('ignores unmapped keys', () => {
    keydown('Escape');
    keyup('Escape');

    expect(received).toHaveLength(0);
  });

  it('ignores a keyup for a key that was never held', () => {
    keyup('KeyZ');

    expect(received).toHaveLength(0);
  });

  it('stops listening after stop()', () => {
    source.stop();
    keydown('KeyZ');

    expect(received).toHaveLength(0);
  });

  it('ignores a keydown targeting a number input, rather than playing a note', () => {
    const input = document.createElement('input');
    input.type = 'number';
    document.body.appendChild(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true }));
    input.remove();

    expect(received).toHaveLength(0);
  });

  it('still plays a note for a keydown targeting a checkbox (not a typing field)', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.appendChild(checkbox);

    checkbox.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true }));
    checkbox.remove();

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: 'noteOn', note: 48 });
  });

  it('lets a key be pressed again after it was released', () => {
    keydown('KeyZ');
    keyup('KeyZ');
    keydown('KeyZ');

    expect(received).toHaveLength(3);
    expect(received[2]).toMatchObject({ type: 'noteOn', note: 48 });
  });
});
