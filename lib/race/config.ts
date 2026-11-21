import { asset } from "../asset";

// Shared constants for the race: who runs, how big the track is, how long a race lasts.

export type Contender = {
  id: number; // stable id, used for the "albo d'oro" (wins tally)
  number: number; // saddle number shown everywhere (what people bet on)
  name: string;
  hex: string; // lane / badge colour
};

// Lane 1 is the far lane (top of the screen), lane 5 the nearest one.
export const CONTENDERS: Contender[] = [
  { id: 2, number: 1, name: "Negroski", hex: "#ff3b30" },
  { id: 3, number: 2, name: "Camparotto", hex: "#22c55e" },
  { id: 4, number: 3, name: "Negroni", hex: "#ff9f0a" },
  { id: 5, number: 4, name: "Sbagliato", hex: "#ff4fd8" },
  { id: 6, number: 5, name: "Camparino", hex: "#a855f7" },
];

// World units. 1 unit = 10 metres of "race".
export const TRACK_LEN = 80;
export const START_X = -TRACK_LEN / 2;
export const FINISH_X = TRACK_LEN / 2;
export const RACE_METERS = 800;
export const LANE_GAP = 2.3;
export const BOTTLE_SCALE = 0.9; // model is 2 units tall → 1.8
export const BOTTLE_HEIGHT = 2 * BOTTLE_SCALE;

export const laneZ = (lane: number, lanes: number) =>
  (lane - (lanes - 1) / 2) * LANE_GAP;

export const trackHalfWidth = (lanes: number) =>
  ((lanes - 1) * LANE_GAP) / 2 + 1.6;

export const worldX = (progress: number) => START_X + progress * TRACK_LEN;

// Podium lives past the finish line.
export const PODIUM_X = FINISH_X + 14;

export const MODEL_URL = asset("/campari_soda_opt.glb");
