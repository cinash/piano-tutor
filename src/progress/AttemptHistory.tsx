import type { Loop } from '../engine/types';
import { pieceTitle } from '../score/pieces';
import type { AttemptRecord } from './types';

export interface AttemptHistoryProps {
  records: AttemptRecord[];
}

function formatLoop(loop: Loop | undefined): string {
  return loop ? `measures ${loop.startMeasure}–${loop.endMeasure}` : 'whole piece';
}

/** Accuracy is derived here rather than stored — see DECISIONS.md. */
function formatAccuracy(record: AttemptRecord): string {
  if (record.notesPlayed === 0) return '—';
  return `${Math.round((1 - record.wrongNoteCount / record.notesPlayed) * 100)}%`;
}

export function AttemptHistory({ records }: AttemptHistoryProps) {
  if (records.length === 0) {
    return <p data-testid="attempt-history-empty">No attempts yet — play something.</p>;
  }

  return (
    <table data-testid="attempt-history">
      <caption>Attempts</caption>
      <thead>
        <tr>
          <th scope="col">When</th>
          <th scope="col">Piece</th>
          <th scope="col">Range</th>
          <th scope="col">Notes</th>
          <th scope="col">Wrong</th>
          <th scope="col">Accuracy</th>
          <th scope="col">Reached end</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record) => (
          <tr key={record.startedAt} data-testid="attempt-history-row">
            <td>{new Date(record.startedAt).toLocaleString()}</td>
            <td>{pieceTitle(record.piece)}</td>
            <td>{formatLoop(record.loop)}</td>
            <td>{record.notesPlayed}</td>
            <td>{record.wrongNoteCount}</td>
            <td>{formatAccuracy(record)}</td>
            <td>{record.reachedEnd ? 'yes' : 'no'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
