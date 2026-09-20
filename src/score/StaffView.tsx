import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { useEffect, useRef } from 'react';

import './StaffView.css';
import { cichaNocXml } from './cichaNoc';

/** The notation, drawn once from the raw MusicXML. Nothing here follows the player. */
export function StaffView() {
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (!cancelled) osmd.render();
    });

    // StrictMode runs the effect twice in development; without emptying the container
    // the second run appends a second copy of the score below the first.
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, []);

  return <div ref={containerRef} className="staff-view" data-testid="staff" />;
}
