import type { EngineState } from '../engine/types';
import type { Score } from '../score/types';

/** Where in the piece the player is — `status` guards the index, see DECISIONS.md. */
export function formatPosition(score: Score, engine: EngineState): string {
  if (engine.status === 'complete') return 'Complete';
  return `Measure ${score.events[engine.nextEventIndex].measure} of ${score.measureCount}`;
}
