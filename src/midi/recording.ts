import { downloadJson } from '../downloadJson';
import type { MidiEvent } from './types';

/** Triggers a browser download of the recorded events, ready to drop into fixtures/. */
export function downloadRecording(events: readonly MidiEvent[]): void {
  downloadJson(events, `recording-${Date.now()}.json`);
}
