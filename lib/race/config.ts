// Shared constants for the race: who runs, how big the track is, how long a race lasts.

export type Contender = {
  id: number; // stable id, used for the wins tally / form
  number: number; // saddle number shown everywhere (what people bet on)
  name: string;
  hex: string; // saddle-cloth colour
};

// Stall 1 is the far (inside) stall, stall 5 the nearest one.
export const CONTENDERS: Contender[] = [
  { id: 2, number: 1, name: "Negroski", hex: "#d42a3a" },
  { id: 3, number: 2, name: "Camparotto", hex: "#1f9a57" },
  { id: 4, number: 3, name: "Negroni", hex: "#e39a2d" },
  { id: 5, number: 4, name: "Sbagliato", hex: "#d4479c" },
  { id: 6, number: 5, name: "Camparino", hex: "#7650c4" },
];

// World units. 1 unit = 10 metres of "race".
export const TRACK_LEN = 80;
export const START_X = -TRACK_LEN / 2;
export const FINISH_X = TRACK_LEN / 2;
export const RACE_METERS = 800;
export const LANE_GAP = 2.3; // stall width
export const BOTTLE_SCALE = 0.9; // model is 2 units tall → 1.8
export const BOTTLE_HEIGHT = 2 * BOTTLE_SCALE;
/** One "length" (lunghezza) in race metres: a bottle is ~0.75 units long. */
export const LENGTH_M = 7.5;

/** Stall position across the track. */
export const laneZ = (lane: number, lanes: number) =>
  (lane - (lanes - 1) / 2) * LANE_GAP;

export const trackHalfWidth = (lanes: number) =>
  ((lanes - 1) * LANE_GAP) / 2 + 1.6;

/**
 * true: every runner stays in its own lane for the whole race (easy to follow on the TV).
 * false: like real horses, they leave the stalls and move towards the inside rail,
 * swinging out to overtake.
 */
export const KEEP_LANES = false;

/** Closest a runner gets to the inside (far) rail and to the outside one. */
export const INNER_Z = -trackHalfWidth(5) + 0.6;
export const OUTER_Z = trackHalfWidth(5) - 0.6;

export const worldX = (progress: number) => START_X + progress * TRACK_LEN;

// Winners' enclosure lives past the finish line.
export const ENCLOSURE_X = FINISH_X + 14;

export const MODEL_URL = "/campari_soda_opt.glb";

const RACE_NAMES = [
  "Premio Indipendenza",
  "Premio Città di Broni",
  "Gran Premio Campari",
  "Premio Bitter",
  "Premio dell'Aperitivo",
  "Premio Oltrepò",
  "Premio Milano 1932",
  "Premio Seltz",
  "Premio Spritz",
  "Gran Premio della Notte",
  "Premio della Staffa",
  "Premio Bancone d'Oro",
];

export const raceName = (raceNumber: number) =>
  RACE_NAMES[(Math.max(1, raceNumber) - 1) % RACE_NAMES.length];

/** Official margin between two finishers, Italian racing style. */
export function marginLabel(gapSeconds: number, winTime: number) {
  const metres = gapSeconds * (RACE_METERS / winTime);
  const l = metres / LENGTH_M;
  if (l < 0.05) return "naso";
  if (l < 0.12) return "corta testa";
  if (l < 0.22) return "testa";
  if (l < 0.36) return "incollatura";
  if (l < 0.62) return "½ lunghezza";
  if (l < 0.87) return "¾ lunghezza";
  const q = Math.round(l * 4) / 4;
  const whole = Math.floor(q);
  const frac = q - whole;
  const f =
    frac === 0.25 ? " ¼" : frac === 0.5 ? " ½" : frac === 0.75 ? " ¾" : "";
  return `${whole}${f} ${whole === 1 && !f ? "lunghezza" : "lunghezze"}`;
}

/** Short running gap behind the leader, e.g. "1½ L". */
export function lengthsShort(metres: number) {
  const l = metres / LENGTH_M;
  if (l < 0.25) return "testa";
  const h = Math.round(l * 2) / 2;
  const whole = Math.floor(h);
  return `${whole > 0 ? whole : ""}${h - whole ? "½" : ""} L`;
}
