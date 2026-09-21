const STORAGE_KEY = 'piano-tutor.queue-folded.v1';

/** Anything that isn't the stored flag reads as unfolded — see DECISIONS.md. */
export function loadQueueFolded(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function saveQueueFolded(folded: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(folded));
}
