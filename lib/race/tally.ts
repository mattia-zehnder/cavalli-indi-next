// The night's record: race number, wins per runner and every finishing order
// (for the "form" column of the racecard). Kept in localStorage so an
// accidental refresh doesn't lose the evening.

export type Tally = {
  race: number;
  wins: Record<number, number>;
  history: number[]; // winners' ids, most recent first
  results: number[][]; // finishing orders (ids), most recent first
};

const STORAGE_KEY = "campari-night-v2";
const EMPTY: Tally = { race: 1, wins: {}, history: [], results: [] };

let current: Tally | null = null;
const listeners = new Set<() => void>();

function load(): Tally {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const t = JSON.parse(raw) as Partial<Tally>;
      if (typeof t.race === "number" && t.wins && Array.isArray(t.history)) {
        return { ...EMPTY, ...t, results: Array.isArray(t.results) ? t.results : [] } as Tally;
      }
    }
  } catch {}
  return EMPTY;
}

/** Finishing positions of a runner in the last races, oldest first (e.g. [3, 1, 2]). */
export function formOf(t: Tally, id: number, last = 5): number[] {
  return t.results
    .slice(0, last)
    .map((order) => order.indexOf(id) + 1)
    .filter((p) => p > 0)
    .reverse();
}

export const tallyStore = {
  get(): Tally {
    if (!current) current = load();
    return current;
  },
  getServer(): Tally {
    return EMPTY;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  update(fn: (t: Tally) => Tally) {
    current = fn(tallyStore.get());
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {}
    listeners.forEach((l) => l());
  },
  reset() {
    tallyStore.update(() => EMPTY);
  },
};
