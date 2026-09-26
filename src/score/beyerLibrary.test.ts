import { describe, expect, it } from 'vitest';

import { parseScore } from './parseScore';

// Every piece in the Beyer library, read the way the app reads a score - except No. 38, a PDMX
// transcription fingered only where its transcriber fingered it (33 of its 88 notes are bare).
const library = Object.entries(
  import.meta.glob<string>('../../beyer_op101_musicxml/*.musicxml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).filter(([path]) => !path.endsWith('beyer_op101_no38.musicxml'));

describe('the Beyer library', () => {
  it('has pieces', () => {
    expect(library.length).toBeGreaterThan(0);
  });

  it.each(library)('%s parses, and every note it plays carries a finger', (_, xml) => {
    const notes = parseScore(xml).events.flatMap((event) => event.notes);

    expect(notes.length).toBeGreaterThan(0);
    expect(notes.filter((note) => note.finger === undefined)).toEqual([]);
  });
});
