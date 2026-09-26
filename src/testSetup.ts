import { vi } from 'vitest';

// OSMD's render() throws in jsdom, which has no canvas 2D context to measure glyphs with,
// and leaves an unhandled rejection behind every test that renders <App />. Stubbed here
// for every jsdom test; the staff is proved in Chromium instead — see DECISIONS.md.
vi.mock('opensheetmusicdisplay', () => ({
  OpenSheetMusicDisplay: class {
    load = () => Promise.resolve({});
    render = () => {};
    // A cursor already at the end of a score with no notes in it: the seek reaches for
    // these, and there is nothing here for it to walk through.
    cursor = {
      hide: () => {},
      show: () => {},
      reset: () => {},
      next: () => {},
      iterator: { EndReached: true },
      cursorElement: { getBoundingClientRect: () => new DOMRect() },
    };
  },
}));
