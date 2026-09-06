import './PianoKeyboard.css';
import { computeKeyboardLayout } from './keyboardLayout';

export interface PianoKeyboardProps {
  lowNote: number;
  highNote: number;
  heldNotes: ReadonlySet<number>;
}

export function PianoKeyboard({ lowNote, highNote, heldNotes }: PianoKeyboardProps) {
  const layout = computeKeyboardLayout(lowNote, highNote);

  return (
    <div className="piano-keyboard" role="group" aria-label="On-screen keyboard">
      {layout.map((key) => {
        const held = heldNotes.has(key.note);
        return (
          <div
            key={key.note}
            data-note={key.note}
            data-held={held}
            className={`piano-key piano-key--${key.color}${held ? ' piano-key--held' : ''}`}
            style={{ left: `${key.leftPercent}%`, width: `${key.widthPercent}%` }}
          />
        );
      })}
    </div>
  );
}
