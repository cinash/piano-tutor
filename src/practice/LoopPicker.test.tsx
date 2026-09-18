import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoopPicker } from './LoopPicker';

const MEASURE_COUNT = 3;

describe('LoopPicker', () => {
  it('enables the loop via the checkbox, defaulting to the full piece', () => {
    const onChange = vi.fn();
    render(
      <LoopPicker measureCount={MEASURE_COUNT} loop={undefined} onChange={onChange} />,
    );

    fireEvent.click(screen.getByTestId('loop-enabled-checkbox'));

    expect(onChange).toHaveBeenCalledWith({ startMeasure: 1, endMeasure: MEASURE_COUNT });
  });

  it('disables the loop via the checkbox', () => {
    const onChange = vi.fn();
    render(
      <LoopPicker
        measureCount={MEASURE_COUNT}
        loop={{ startMeasure: 1, endMeasure: 2 }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId('loop-enabled-checkbox'));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('clamps a typed start measure above measureCount, rather than passing it through', () => {
    const onChange = vi.fn();
    render(
      <LoopPicker
        measureCount={MEASURE_COUNT}
        loop={{ startMeasure: 1, endMeasure: MEASURE_COUNT }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('loop-start-input'), { target: { value: '99' } });

    expect(onChange).toHaveBeenCalledWith({
      startMeasure: MEASURE_COUNT,
      endMeasure: MEASURE_COUNT,
    });
  });

  it('clamps an empty (invalid) end measure up to 1, rather than passing 0 through', () => {
    const onChange = vi.fn();
    render(
      <LoopPicker
        measureCount={MEASURE_COUNT}
        loop={{ startMeasure: 2, endMeasure: 2 }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('loop-end-input'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({ startMeasure: 1, endMeasure: 1 });
  });
});
