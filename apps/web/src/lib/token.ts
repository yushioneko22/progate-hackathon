const KEY = 'kawarun_token';

export const token = {
  get: (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem(KEY) : null,
  set: (t: string): void => localStorage.setItem(KEY, t),
  remove: (): void => localStorage.removeItem(KEY),
};
