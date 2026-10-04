import { render, waitFor } from '@testing-library/react';
import type { MusicPartManagerIterator } from 'opensheetmusicdisplay';
import { expect, it, vi } from 'vitest';

import { StaffView } from './StaffView';
import { LEFT_WHOLE, repeatNote, scoreXml, twoHands } from './fixtures/uploads/scoreXml';
import { parseScore } from './parseScore';

const shown = vi.hoisted(() => ({ onset: Number.NaN }));

// OSMD's real sheet and iterator, which give the onsets the cursor compares; render() is
// left out, since jsdom cannot draw (src/testSetup.ts). show() records where the seek stopped.
vi.mock('opensheetmusicdisplay', async (importActual) => {
  const real = await importActual<typeof import('opensheetmusicdisplay')>();
  return {
    OpenSheetMusicDisplay: class {
      private readonly osmd: InstanceType<typeof real.OpenSheetMusicDisplay>;

      constructor(container: HTMLElement) {
        this.osmd = new real.OpenSheetMusicDisplay(container, { autoResize: false });
      }

      load = (xml: string) => this.osmd.load(xml);
      render = () => {};
      // OSMD's own reset() and next() do this, and then redraw.
      cursor = {
        iterator: undefined as unknown as MusicPartManagerIterator,
        hide: () => {},
        reset: () => {
          this.cursor.iterator = new real.MusicPartManagerIterator(this.osmd.Sheet);
        },
        next: () => this.cursor.iterator.moveToNextVisibleVoiceEntry(false),
        show: () => {
          shown.onset = this.cursor.iterator.CurrentSourceTimestamp.RealValue;
        },
        cursorElement: { getBoundingClientRect: () => new DOMRect() },
      };
    },
  };
});

// Four bars of eighth-note triplets: from the second bar on, OSMD reads some onsets one unit
// in the last place below the parser's, and without the tolerance the cursor steps past them.
it('lands the cursor on each onset of a triplet piece', async () => {
  const triplets = twoHands(repeatNote(12, 4), LEFT_WHOLE);
  const xml = scoreXml({ bars: [triplets, triplets, triplets, triplets] });
  const { events } = parseScore(xml);
  const { rerender } = render(<StaffView xml={xml} targetStartTime={0} />);
  await waitFor(() => expect(shown.onset).toBe(0));

  const landed = events.map(({ startTime }) => {
    rerender(<StaffView xml={xml} targetStartTime={startTime} />);
    return Math.round(shown.onset * 4 * 12); // twelfths of a beat, a triplet sixteenth
  });

  expect(landed).toEqual(events.map(({ startTime }) => Math.round(startTime * 12)));
});
