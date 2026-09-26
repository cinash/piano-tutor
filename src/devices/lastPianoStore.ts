const STORAGE_KEY = 'piano-tutor.last-piano.v1';

/** The name of the piano the player last picked, reconnected on its own — see DECISIONS.md. */
export function loadLastPiano(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function saveLastPiano(name: string): void {
  localStorage.setItem(STORAGE_KEY, name);
}

export function forgetLastPiano(): void {
  localStorage.removeItem(STORAGE_KEY);
}
