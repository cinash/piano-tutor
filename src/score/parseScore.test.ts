import { describe, expect, it } from 'vitest';

import cichaNocXml from '../../cicha-noc.musicxml?raw';
import { parseScore } from './parseScore';
import cichaNocSnapshot from './fixtures/cicha-noc.snapshot.json';
import graceNotesXml from './fixtures/grace-notes.musicxml?raw';

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
    // Mirrors cicha-noc m. 1 beat 1: RH melody note + LH two-note chord, all starting together.
    const firstEvent = cichaNoc.events[0];

    expect(firstEvent.measure).toBe(1);
    expect(firstEvent.beat).toBe(1);
    expect(firstEvent.notes).toEqual(
      expect.arrayContaining([
        { pitch: 67, hand: 'right', finger: 5 }, // G4
        { pitch: 48, hand: 'left', finger: 5 }, // C3
        { pitch: 55, hand: 'left', finger: 1 }, // G3
      ]),
    );
    expect(firstEvent.notes).toHaveLength(3);
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
    // m.9 beat 4: G4 dotted quarter, tied into m.10's G4 eighth.
    const tied = cichaNoc.events.find((e) => e.measure === 9 && e.beat === 4);
    expect(tied?.notes).toEqual([{ pitch: 67, hand: 'right', finger: 5 }]);
    expect(tied?.durationBeats).toBeCloseTo(2); // (3 + 1) divisions / 2 divisions-per-quarter

    // No separate event was produced for the tied-into note in m.10.
    expect(
      cichaNoc.events.some((e) => e.measure === 10 && e.notes[0]?.pitch === 67),
    ).toBe(false);

    // The next note in m.10 (F4) keeps its normal position, unaffected by the tie merge.
    const next = cichaNoc.events.find(
      (e) => e.measure === 10 && e.notes[0]?.pitch === 65,
    );
    expect(next?.beat).toBe(2);
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
    // m.6 beat 6: D4 with no fingering.
    const withoutFingering = cichaNoc.events.find((e) => e.measure === 6 && e.beat === 6);
    expect(withoutFingering?.notes[0]).toEqual({ pitch: 62, hand: 'right' });

    // m.8 beat 6: the same D4, this time with fingering 2.
    const withFingering = cichaNoc.events.find((e) => e.measure === 8 && e.beat === 6);
    expect(withFingering?.notes[0]).toEqual({ pitch: 62, hand: 'right', finger: 2 });
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
