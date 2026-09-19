import type { ChangeEvent } from 'react';

import type { KeyboardPreset } from '../config';

export interface KeyboardRangePickerProps {
  presets: readonly KeyboardPreset[];
  selected: KeyboardPreset;
  onChange: (preset: KeyboardPreset) => void;
}

export function KeyboardRangePicker({
  presets,
  selected,
  onChange,
}: KeyboardRangePickerProps) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const preset = presets.find((candidate) => candidate.label === event.target.value);
    if (preset) onChange(preset);
  }

  return (
    <div>
      <label htmlFor="keyboard-range-select">Keyboard range</label>{' '}
      <select
        id="keyboard-range-select"
        data-testid="keyboard-range-select"
        value={selected.label}
        onChange={handleChange}
      >
        {presets.map((preset) => (
          <option key={preset.label} value={preset.label}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}
