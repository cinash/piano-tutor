import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReplayMidiSource } from './ReplayMidiSource';
import type { MidiEvent, MidiSource } from './types';

const fixture: MidiEvent[] = [
  { type: 'noteOn', note: 60, velocity: 100, time: 1000 },
  { type: 'noteOff', note: 60, time: 1200 },
  { type: 'noteOn', note: 62, velocity: 100, time: 1400 },
];

/** Collects every event a source emits, and returns the unsubscribe function too. */
function collectFrom(source: MidiSource) {
  const received: MidiEvent[] = [];
  const unsubscribe = source.onEvent((e) => received.push(e));
  return { received, unsubscribe };
}

describe('ReplayMidiSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules events at their recorded relative offsets by default', async () => {
    const source = new ReplayMidiSource(fixture);
    const { received } = collectFrom(source);

    await source.start();
    expect(received).toEqual([]);

    await vi.advanceTimersByTimeAsync(100);
    expect(received).toEqual([fixture[0]]);

    await vi.advanceTimersByTimeAsync(150);
    expect(received).toEqual([fixture[0], fixture[1]]);

    await vi.advanceTimersByTimeAsync(150);
    expect(received).toEqual(fixture);
  });

  it('dispatches every event synchronously when realtime is false', async () => {
    const source = new ReplayMidiSource(fixture, { realtime: false });
    const { received } = collectFrom(source);

    await source.start();

    expect(received).toEqual(fixture);
  });

  it('does not emit further events after stop', async () => {
    const source = new ReplayMidiSource(fixture);
    const { received } = collectFrom(source);

    await source.start();
    await vi.advanceTimersByTimeAsync(100);
    source.stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(received).toEqual([fixture[0]]);
  });

  it('stops notifying a handler once it unsubscribes', async () => {
    const source = new ReplayMidiSource(fixture);
    const { received, unsubscribe } = collectFrom(source);
    unsubscribe();

    await source.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(received).toEqual([]);
  });

  it('does nothing for an empty fixture', async () => {
    const source = new ReplayMidiSource([]);
    const { received } = collectFrom(source);

    await expect(source.start()).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(1000);

    expect(received).toEqual([]);
  });

  it('restarting cancels the previous run instead of doubling events', async () => {
    const source = new ReplayMidiSource(fixture);
    const { received } = collectFrom(source);

    await source.start();
    await vi.advanceTimersByTimeAsync(100);
    await source.start();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(received).toEqual([fixture[0], ...fixture]);
  });
});
