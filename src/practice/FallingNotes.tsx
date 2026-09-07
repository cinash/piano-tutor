import './FallingNotes.css';
import type { EngineState } from '../engine/types';
import type { Finger, Score } from '../score/types';

const QUEUE_LENGTH = 4;

/** One consistent colour per finger across the whole queue; the numeral is secondary. */
const FINGER_COLORS: Record<Finger, string> = {
  1: '#e11d48',
  2: '#f59e0b',
  3: '#16a34a',
  4: '#2563eb',
  5: '#9333ea',
};

export interface FallingNotesProps {
  score: Score;
  status: EngineState['status'];
  nextEventIndex: number;
  satisfiedNoteIds: ReadonlySet<number>;
  heldNotes: ReadonlySet<number>;
}

export function FallingNotes({
  score,
  status,
  nextEventIndex,
  satisfiedNoteIds,
  heldNotes,
}: FallingNotesProps) {
  if (status === 'complete') {
    return (
      <div className="falling-notes" data-testid="falling-notes" data-status="complete">
        Piece complete
      </div>
    );
  }

  const upcoming = score.events.slice(nextEventIndex, nextEventIndex + QUEUE_LENGTH);
  const currentPitches = new Set(upcoming[0].notes.map((note) => note.pitch));
  const nextPitches = new Set(upcoming[1]?.notes.map((note) => note.pitch));
  // Mirrors the current-vs-next check advance() itself makes (src/engine/advance.ts) —
  // the engine has no "wrong" status of its own, so the view derives one for display.
  const hasWrongNote = [...heldNotes].some(
    (pitch) => !currentPitches.has(pitch) && !nextPitches.has(pitch),
  );

  return (
    <div
      className="falling-notes"
      role="list"
      aria-label="Upcoming notes"
      data-testid="falling-notes"
      data-status="waiting"
    >
      {upcoming.map((event, index) => {
        const isCurrent = index === 0;
        return (
          <div
            key={event.id}
            role="listitem"
            data-testid="falling-note-event"
            data-event-id={event.id}
            className={`falling-note${isCurrent ? ' falling-note--current' : ''}${
              isCurrent && hasWrongNote ? ' falling-note--wrong' : ''
            }`}
          >
            {event.notes.map((note) => (
              <span
                key={note.pitch}
                className={`falling-note__finger${
                  isCurrent && satisfiedNoteIds.has(note.pitch)
                    ? ' falling-note__finger--satisfied'
                    : ''
                }`}
                style={
                  note.finger ? { background: FINGER_COLORS[note.finger] } : undefined
                }
              >
                {note.finger ?? ''}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
