import type { MidiEvent } from './types';

/** Triggers a browser download of the recorded events, ready to drop into fixtures/. */
export function downloadRecording(events: readonly MidiEvent[]): void {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `recording-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
