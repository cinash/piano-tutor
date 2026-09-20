import './PianoKeyboard.css';
import type { Note } from '../score/types';
import { computeKeyboardLayout } from './keyboardLayout';
import { noteName } from './noteName';

export interface PianoKeyboardProps {
  lowNote: number;
  highNote: number;
  heldNotes: ReadonlySet<number>;
  expectedNotes: readonly Note[];
}

export function PianoKeyboard({
  lowNote,
  highNote,
  heldNotes,
  expectedNotes,
}: PianoKeyboardProps) {
  const layout = computeKeyboardLayout(lowNote, highNote);

  return (
    <>
      <div className="piano-keyboard" role="group" aria-label="On-screen keyboard">
        {layout.map((key) => {
          const held = heldNotes.has(key.note);
          const expected = expectedNotes.find((note) => note.pitch === key.note);
          // A key that is both renders as held — see DECISIONS.md. Decided here rather
          // than left to the order the two rules happen to sit in the stylesheet.
          const stateClass = held
            ? ' piano-key--held'
            : expected
              ? ` piano-key--expected-${expected.hand}`
              : '';
          return (
            <div
              key={key.note}
              data-note={key.note}
              data-held={held}
              data-expected={Boolean(expected)}
              data-hand={expected?.hand}
              className={`piano-key piano-key--${key.color}${stateClass}`}
              style={{ left: `${key.leftPercent}%`, width: `${key.widthPercent}%` }}
            >
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
