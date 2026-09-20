import { vi } from 'vitest';

/**
 * OSMD measures glyphs through a canvas 2D context to lay a score out, and jsdom has no
 * such context, so `render()` throws there — mounting the real thing under Vitest leaves
 * an unhandled rejection behind every test that renders `<App />`. Stub it once, here,
 * and let jsdom assert only that the staff's container is on the page; that the notation
 * is actually drawn is proved in a real browser by `e2e/staff.spec.ts`.
 */
vi.mock('opensheetmusicdisplay', () => ({
  OpenSheetMusicDisplay: class {
    load = () => Promise.resolve({});
    render = () => {};
  },
}));
