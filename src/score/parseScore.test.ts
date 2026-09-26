import { describe, expect, it } from 'vitest';

import cichaNocXml from '../../cicha-noc.musicxml?raw';
import { parseScore } from './parseScore';
import type { Hand } from './types';
import cichaNocSnapshot from './fixtures/cicha-noc.snapshot.json';
import graceNotesXml from './fixtures/grace-notes.musicxml?raw';
import tiedNotesXml from './fixtures/tied-notes.musicxml?raw';

const cichaNoc = parseScore(cichaNocXml);

/** Wraps bare <note> elements in a single 4/4 measure, the document structure parseScore expects. */
function scoreWithNotes(notesXml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="4.0">
      <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
      <part id="P1">
        <measure number="1">
          <attributes>
            <divisions>2</divisions>
            <time><beats>4</beats><beat-type>4</beat-type></time>
          </attributes>
          ${notesXml}
        </measure>
      </part>
    </score-partwise>`;
}

describe('parseScore', () => {
  it('parses cicha-noc.musicxml into the committed snapshot', () => {
    expect(cichaNoc).toEqual(cichaNocSnapshot);
  });

  it('reads the key signature, and no <key> as none', () => {
    const note = `<note>
      <pitch><step>F</step><octave>4</octave></pitch>
      <duration>8</duration><voice>1</voice><type>whole</type><staff>1</staff>
    </note>`;

    expect(cichaNoc.fifths).toBe(0);
    expect(
      parseScore(
        scoreWithNotes(`<attributes><key><fifths>-1</fifths></key></attributes>${note}`),
      ).fifths,
    ).toBe(-1);
    expect(parseScore(scoreWithNotes(note)).fifths).toBe(0);
  });

  it('groups a chord into a single event with multiple notes', () => {
    const score = parseScore(
      scoreWithNotes(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>8</duration><voice>1</voice><type>whole</type><staff>1</staff>
        </note>
        <note>
          <chord/>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>8</duration><voice>1</voice><type>whole</type><staff>1</staff>
        </note>
      `),
    );

    expect(score.events).toHaveLength(1);
    expect(score.events[0].notes.map((n) => n.pitch)).toEqual([60, 64]);
  });

  it('groups simultaneous notes across both hands into one event', () => {
    // m. 19 beat 1, the one bar of cicha-noc where the hands play together rather than
    // taking the melody in turn: C5 over C3, written on separate staves.
    const octave = cichaNoc.events.find((e) => e.measure === 19 && e.beat === 1);

    expect(octave?.notes).toEqual(
      expect.arrayContaining([
        { pitch: 72, hand: 'right', finger: 3 }, // C5
        { pitch: 48, hand: 'left', finger: 5 }, // C3
      ]),
    );
    expect(octave?.notes).toHaveLength(2);
  });

  it('puts every left-hand note of cicha-noc below every right-hand note', () => {
    const notes = cichaNoc.events.flatMap((e) => e.notes);
    const pitchesOf = (hand: Hand) =>
      notes.filter((n) => n.hand === hand).map((n) => n.pitch);

    expect(Math.max(...pitchesOf('left'))).toBeLessThan(Math.min(...pitchesOf('right')));
  });

  it('produces no event for a rest, while later notes keep the full timeline position', () => {
    const score = parseScore(
      scoreWithNotes(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff>
        </note>
        <note>
          <rest/>
          <duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff>
        </note>
        <note>
          <pitch><step>D</step><octave>4</octave></pitch>
          <duration>4</duration><voice>1</voice><type>half</type><staff>1</staff>
        </note>
      `),
    );

    expect(score.events).toHaveLength(2);
    expect(score.events.map((e) => e.notes[0].pitch)).toEqual([60, 62]);
    // The rest occupies beat 2, so the note after it starts at beat 3, not beat 2.
    expect(score.events[1].beat).toBe(3);
  });

  it('resolves a tie into a single event with combined duration, across a barline', () => {
    // cicha-noc.musicxml has no tie of its own, so this is its own fixture: m.1 beat 2
    // is a G4 quarter tied into m.2's G4 eighth.
    const score = parseScore(tiedNotesXml);

    const tied = score.events.find((e) => e.measure === 1 && e.beat === 2);
    expect(tied?.notes).toEqual([{ pitch: 67, hand: 'right', finger: 5 }]);
    expect(tied?.durationBeats).toBeCloseTo(1.5); // (2 + 1) divisions / 2 per quarter

    // No separate event was produced for the tied-into note in m.2.
    expect(score.events.some((e) => e.measure === 2 && e.notes[0]?.pitch === 67)).toBe(
      false,
    );

    // The next note in m.2 (F4) keeps its normal position, unaffected by the tie merge.
    const next = score.events.find((e) => e.measure === 2 && e.notes[0]?.pitch === 65);
    expect(next?.beat).toBe(1.5);
  });

  it('parses a dotted duration via <duration> rather than <type>/<dot>', () => {
    // A dotted quarter at divisions=2 has <duration>3</duration> regardless of the
    // <dot/> tag; the parser must trust that value rather than deriving it from
    // <type> and <dot> itself.
    const score = parseScore(
      scoreWithNotes(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>3</duration><voice>1</voice><type>quarter</type><dot/><staff>1</staff>
        </note>
      `),
    );

    expect(score.events[0].durationBeats).toBeCloseTo(1.5);
  });

  it('reads fingering when present and omits it when absent', () => {
    // cicha-noc.musicxml fingers every note, so only the present half comes from it.
    expect(cichaNoc.events[0].notes[0]).toEqual({
      pitch: 67,
      hand: 'right',
      finger: 3,
    });

    const score = parseScore(
      scoreWithNotes(`
        <note>
          <pitch><step>D</step><octave>4</octave></pitch>
          <duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff>
        </note>
      `),
    );

    expect(score.events[0].notes[0]).toEqual({ pitch: 62, hand: 'right' });
  });

  it('ignores a grace note: no event, and it does not shift the following note', () => {
    const score = parseScore(graceNotesXml);

    expect(score.events).toHaveLength(2);
    expect(score.events[0]).toMatchObject({
      beat: 1,
      notes: [{ pitch: 60, hand: 'right', finger: 1 }], // C4
    });
    // If the grace note were wrongly treated as sounding, it would merge into this
    // event (same startDivisions as E4), making notes [D4, E4] instead of just [E4].
    expect(score.events[1]).toMatchObject({
      beat: 2,
      notes: [{ pitch: 64, hand: 'right', finger: 3 }], // E4
    });
  });
});
