/** An in-memory localStorage for the Hunt's record tests. Returns the backing map and a function that removes it. */
export function memoryStorage(): { data: Map<string, string>; done: () => void } {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k), clear: () => data.clear(), key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  } as Storage;
  return { data, done: () => { delete (globalThis as { localStorage?: Storage }).localStorage; } };
}
