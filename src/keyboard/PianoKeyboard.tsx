import './PianoKeyboard.css';
import type { Note } from '../score/types';
import type { FingerKey } from './handPosition';
import { computeKeyboardLayout } from './keyboardLayout';
import { noteName } from './noteName';

export interface PianoKeyboardProps {
  lowNote: number;
  highNote: number;
  heldNotes: ReadonlySet<number>;
  expectedNotes: readonly Note[];
  handPositions: readonly FingerKey[];
}

export function PianoKeyboard({
  lowNote,
  highNote,
  heldNotes,
  expectedNotes,
  handPositions,
}: PianoKeyboardProps) {
  const layout = computeKeyboardLayout(lowNote, highNote);

  return (
    <>
      <div className="piano-keyboard" role="group" aria-label="On-screen keyboard">
        {layout.map((key) => {
          const held = heldNotes.has(key.note);
          const expected = expectedNotes.find((note) => note.pitch === key.note);
          // The right hand's first where both hands would share a key — see DECISIONS.md.
          const position = handPositions.find(
            (fingerKey) => fingerKey.pitch === key.note,
          );
          const finger = expected?.finger ?? position?.finger;
          // Held wins, then expected, then the hand's position — see DECISIONS.md.
          // Decided here rather than left to the order the rules happen to sit in the
          // stylesheet.
          const stateClass = held
            ? ' piano-key--held'
            : expected
              ? ` piano-key--expected-${expected.hand}`
              : position
                ? ` piano-key--position-${position.hand}`
                : '';
          return (
            <div
              key={key.note}
              data-note={key.note}
              data-held={held}
              data-expected={Boolean(expected)}
              data-hand={expected?.hand}
              data-position-hand={position?.hand}
              data-finger={finger}
              className={`piano-key piano-key--${key.color}${stateClass}`}
              style={{ left: `${key.leftPercent}%`, width: `${key.widthPercent}%` }}
            >
              {finger && <span className="piano-key__finger">{finger}</span>}
              {/* White keys only — see DECISIONS.md. */}
              {key.color === 'white' && noteName(key.note)}
            </div>
          );
        })}
      </div>
      <p className="hand-legend">
        <span className="hand-legend__swatch hand-legend__swatch--left" /> Left hand{' '}
        <span className="hand-legend__swatch hand-legend__swatch--right" /> Right hand
      </p>
    </>
  );
}
