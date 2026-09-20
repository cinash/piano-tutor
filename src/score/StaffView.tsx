import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { useEffect, useRef, useState } from 'react';

import './StaffView.css';
import { cichaNocXml } from './cichaNoc';

export interface StaffViewProps {
  /**
   * Where to mark, in quarter-note beats from the start of the piece — the `startTime`
   * of the event the engine is waiting for, or where a running demo has reached, or
   * `undefined` once the piece is finished.
   */
  targetStartTime: number | undefined;
}

/** The notation, drawn from the raw MusicXML, with the cursor on the marked position. */
export function StaffView({ targetStartTime }: StaffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Null until the first render() has run, because that is what creates the cursor.
  const [renderedOsmd, setRenderedOsmd] = useState<OpenSheetMusicDisplay | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // autoResize defaults on and attaches a window resize listener that 2.1.3 never
    // removes, so a discarded instance would redraw into the container the cleanup
    // below emptied. Off, and the lifecycle is ours.
    const osmd = new OpenSheetMusicDisplay(container, { autoResize: false });
    let cancelled = false;

    void osmd.load(cichaNocXml).then(() => {
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
  }, []);

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
      cursor.iterator.CurrentSourceTimestamp.RealValue < targetInWholeNotes
    ) {
      cursor.next();
    }
    cursor.show();

    // OSMD's own followCursor centres the cursor in every scrollable ancestor, which
    // drags the whole page about on each note; 'nearest' scrolls the staff pane only as
    // far as it must, and not at all while the marker is already visible.
    cursor.cursorElement.scrollIntoView({ block: 'nearest' });
  }, [renderedOsmd, targetStartTime]);

  return <div ref={containerRef} className="staff-view" data-testid="staff" />;
}
