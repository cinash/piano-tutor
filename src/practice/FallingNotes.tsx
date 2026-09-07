import './FallingNotes.css';
import type { EngineState } from '../engine/types';
import type { Finger, ScoreEvent } from '../score/types';

const QUEUE_LENGTH = 4;

/** One consistent colour per finger across the whole queue; the numeral is secondary. */
const FINGER_COLORS: Record<Finger, string> = {
  1: '#8b5cf6',
  2: '#f97316',
  3: '#22c55e',
  4: '#2563eb',
  5: '#ec4899',
};

export interface FallingNotesProps {
  events: ScoreEvent[];
  status: EngineState['status'];
  nextEventIndex: number;
  satisfiedNoteIds: ReadonlySet<number>;
  wrongNotes: ReadonlySet<number>;
}

export function FallingNotes({
  events,
  status,
  nextEventIndex,
  satisfiedNoteIds,
  wrongNotes,
}: FallingNotesProps) {
  if (status === 'complete') {
    return (
      <div className="falling-notes" data-testid="falling-notes">
        Piece complete
      </div>
    );
  }

  const upcoming = events.slice(nextEventIndex, nextEventIndex + QUEUE_LENGTH);
  const hasWrongNote = wrongNotes.size > 0;

  return (
    <div
      className="falling-notes"
      role="list"
      aria-label="Upcoming notes"
      data-testid="falling-notes"
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
