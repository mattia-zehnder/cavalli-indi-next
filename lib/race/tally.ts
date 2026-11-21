// The night's "albo d'oro": race number + wins per camparino.
// Kept in localStorage so an accidental refresh doesn't lose the evening.

export type Tally = { race: number; wins: Record<number, number>; history: number[] };

const STORAGE_KEY = "campari-night-v2";
const EMPTY: Tally = { race: 1, wins: {}, history: [] };

let current: Tally | null = null;
const listeners = new Set<() => void>();

function load(): Tally {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const t = JSON.parse(raw) as Tally;
      if (typeof t.race === "number" && t.wins && Array.isArray(t.history)) return t;
    }
  } catch {}
  return EMPTY;
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
