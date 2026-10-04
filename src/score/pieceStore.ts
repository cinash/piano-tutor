import { PIECES, type Piece } from './pieces';

const STORAGE_KEY = 'piano-tutor.piece.v1';

/** The piece chosen last, or the first one when none is stored or it is not in `pieces`. */
export function loadPiece(pieces: readonly Piece[]): Piece {
  const id = localStorage.getItem(STORAGE_KEY);
  return pieces.find((piece) => piece.id === id) ?? PIECES[0];
}

export function savePiece(piece: Piece): void {
  localStorage.setItem(STORAGE_KEY, piece.id);
}
