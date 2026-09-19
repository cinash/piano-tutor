import './PianoKeyboard.css';
import type { Note } from '../score/types';
import { computeKeyboardLayout } from './keyboardLayout';

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
    <div className="piano-keyboard" role="group" aria-label="On-screen keyboard">
      {layout.map((key) => {
        const held = heldNotes.has(key.note);
        const expected = expectedNotes.some((note) => note.pitch === key.note);
        // A key that is both renders as held — see DECISIONS.md. Decided here rather
        // than left to the order the two rules happen to sit in the stylesheet.
        const stateClass = held
          ? ' piano-key--held'
          : expected
            ? ' piano-key--expected'
            : '';
        return (
          <div
            key={key.note}
            data-note={key.note}
            data-held={held}
            data-expected={expected}
            className={`piano-key piano-key--${key.color}${stateClass}`}
            style={{ left: `${key.leftPercent}%`, width: `${key.widthPercent}%` }}
          />
        );
      })}
    </div>
  );
}
