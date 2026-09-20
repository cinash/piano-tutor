import type { Hand, Score } from './types';

/** Which hand is being practised; `'both'` is the piece as written. */
export type HandSelection = Hand | 'both';

/**
 * The score as one hand plays it: each event's notes narrowed to that hand, and events
 * left with nothing dropped rather than kept empty — an empty event has no expectation
 * the player can meet, which stalls the engine at index 0 (see DECISIONS.md).
 * `measureCount` is untouched: the piece is still twelve bars long one-handed.
 */
export function filterScoreByHand(score: Score, hands: HandSelection): Score {
  if (hands === 'both') return score;

  const events = score.events
    .map((event) => ({
      ...event,
      notes: event.notes.filter((note) => note.hand === hands),
    }))
    .filter((event) => event.notes.length > 0);

  return { ...score, events };
}
