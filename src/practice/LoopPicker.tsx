import type { ChangeEvent } from 'react';

import type { Loop } from '../engine/types';

export interface LoopPickerProps {
  measureCount: number;
  loop: Loop | undefined;
  onChange: (loop: Loop | undefined) => void;
}

export function LoopPicker({ measureCount, loop, onChange }: LoopPickerProps) {
  const enabled = loop !== undefined;
  const startMeasure = loop?.startMeasure ?? 1;
  const endMeasure = loop?.endMeasure ?? measureCount;

  // Clamped so a typed value outside [1, measureCount] can't produce a loop with no
  // matching ScoreEvent — the browser's own min/max only affects the spinner buttons.
  function clampMeasure(value: number): number {
    return Math.min(Math.max(1, value), measureCount);
  }

  function handleToggle(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.checked ? { startMeasure, endMeasure } : undefined);
  }

  function handleStartChange(event: ChangeEvent<HTMLInputElement>) {
    const nextStart = clampMeasure(Number(event.target.value));
    onChange({ startMeasure: nextStart, endMeasure: Math.max(nextStart, endMeasure) });
  }

  function handleEndChange(event: ChangeEvent<HTMLInputElement>) {
    const nextEnd = clampMeasure(Number(event.target.value));
    onChange({ startMeasure: Math.min(startMeasure, nextEnd), endMeasure: nextEnd });
  }

  return (
    <div>
      <label htmlFor="loop-enabled-checkbox">
        <input
          id="loop-enabled-checkbox"
          type="checkbox"
          data-testid="loop-enabled-checkbox"
          checked={enabled}
          onChange={handleToggle}
        />{' '}
        Loop
      </label>{' '}
      <label htmlFor="loop-start-input">Start measure</label>{' '}
      <input
        id="loop-start-input"
        type="number"
        min={1}
        max={measureCount}
        data-testid="loop-start-input"
        value={startMeasure}
        disabled={!enabled}
        onChange={handleStartChange}
      />{' '}
      <label htmlFor="loop-end-input">End measure</label>{' '}
      <input
        id="loop-end-input"
        type="number"
        min={1}
        max={measureCount}
        data-testid="loop-end-input"
        value={endMeasure}
        disabled={!enabled}
        onChange={handleEndChange}
      />
    </div>
  );
}
