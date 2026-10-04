import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { useEffect, useRef, useState } from 'react';

import './StaffView.css';

/** Where the pane holds the cursor: more of the music ahead of it than behind, as flowkey does. */
const CURSOR_FRACTION_FROM_LEFT = 1 / 3;

/**
 * OSMD sums a whole part and a fraction, rounding twice where the parser rounds once, so a
 * triplet onset can read one unit in the last place below the target it is. Far below the
 * gap between any two onsets — see DECISIONS.md.
 */
const ONSET_TOLERANCE = 1e-9;

export interface StaffViewProps {
  /** The piece's MusicXML. Drawn once per mount: a new piece is a new key — see App.tsx. */
  xml: string;
  /**
   * Where to mark, in quarter-note beats from the start of the piece — the `startTime`
   * of the event the engine is waiting for, or where a running demo has reached, or
   * `undefined` once the piece is finished.
   */
  targetStartTime: number | undefined;
}

/** The notation, drawn from the raw MusicXML, with the cursor on the marked position. */
export function StaffView({ xml, targetStartTime }: StaffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Null until the first render() has run, because that is what creates the cursor.
  const [renderedOsmd, setRenderedOsmd] = useState<OpenSheetMusicDisplay | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // autoResize defaults on and attaches a window resize listener that 2.1.3 never
    // removes, so a discarded instance would redraw into the container the cleanup
    // below emptied. Off, and the lifecycle is ours. One horizontal system, so the pane
    // scrolls sideways rather than wrapping the piece onto lines that fall below it; no
    // credits, because on a single line OSMD centres the title over the whole piece's
    // width, out of view, and the band it takes above the staff pushes the staff down.
    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: false,
      renderSingleHorizontalStaffline: true,
      drawCredits: false,
    });
    let cancelled = false;

    void osmd.load(xml).then(() => {
      // load() is a promise, so this can resolve after unmount, into a detached div.
      if (cancelled) return;
      osmd.render();
      setRenderedOsmd(osmd);
    });

    // StrictMode runs the effect twice in development; without emptying the container
    // the second run appends a second copy of the score below the first.
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [xml]);

  useEffect(() => {
    if (!renderedOsmd) return;
    const { cursor } = renderedOsmd;

    // Hidden while it moves: update() is a no-op on a hidden cursor, so the scan below
    // redraws once at the end rather than once per step.
    cursor.hide();
    if (targetStartTime === undefined) return; // the piece is over; there is no next note

    // Every move is a reset and a re-scan rather than a tracked delta — see DECISIONS.md.
    const targetInWholeNotes = targetStartTime / 4; // OSMD's unit, not the score's
    cursor.reset();
    while (
      !cursor.iterator.EndReached &&
      cursor.iterator.CurrentSourceTimestamp.RealValue <
        targetInWholeNotes - ONSET_TOLERANCE
    ) {
      cursor.next();
    }
    cursor.show();

    // Only the pane's own scrollLeft, so the page never moves — OSMD's followCursor
    // scrolls every ancestor. The browser clamps the value at either end of the piece,
    // and the stylesheet decides whether it glides.
    const pane = containerRef.current;
    if (!pane) return;
    const offset =
      cursor.cursorElement.getBoundingClientRect().left -
      pane.getBoundingClientRect().left;
    pane.scrollLeft += offset - pane.clientWidth * CURSOR_FRACTION_FROM_LEFT;
  }, [renderedOsmd, targetStartTime]);

  return <div ref={containerRef} className="staff-view" data-testid="staff" />;
}
