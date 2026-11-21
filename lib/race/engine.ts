// Runtime of a race. Lives outside React: the 3D scene reads it every frame,
// the HUD subscribes to throttled snapshots, audio listens to its events.

import {
  generateRacePlan,
  progressAt,
  type CommentaryLine,
  type RacePlan,
} from "./plan";

export type Phase = "paddock" | "countdown" | "running" | "finished";

export type RaceEvent =
  | { type: "countdown"; n: number }
  | { type: "go" }
  | { type: "line"; line: CommentaryLine }
  | { type: "cross"; horse: number; place: number }
  | { type: "photo" }
  | { type: "beat"; strength: number }
  | { type: "end"; winner: number };

export type Snapshot = {
  phase: Phase;
  countdown: number | null; // 4 (= PRONTI?), 3, 2, 1, 0 (= VIA)
  t: number;
  progress: number[];
  ranking: number[]; // runner indices, current order
  finishOrder: number[];
  finishTimes: number[];
  line: CommentaryLine | null;
  lineId: number;
  photo: boolean; // photo-finish freeze in progress
  slowMo: boolean;
  raceId: number;
};

const COUNTDOWN = 5; // ~2 s of "PRONTI?" (bugle call), then 3-2-1
const PHOTO_FREEZE = 1.7;
const NOTIFY_EVERY = 1 / 12;

export class RaceEngine {
  readonly n: number;
  phase: Phase = "paddock";
  plan: RacePlan;
  raceId = 0;
  /** race clock in seconds (negative during the countdown) */
  t = 0;
  /** wall-clock seconds since the current phase started */
  phaseTime = 0;
  timeScale = 1;
  freeze = 0;
  progress: Float32Array;
  finishOrder: number[] = [];
  crossed: boolean[];

  private lineIdx = 0;
  private line: CommentaryLine | null = null;
  private lineId = 0;
  private lastCount = 99;
  private beatPhase = 0;
  private sinceNotify = 0;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: RaceEvent) => void>();
  private snap: Snapshot;

  constructor(n: number) {
    this.n = n;
    this.plan = generateRacePlan(n);
    this.progress = new Float32Array(n);
    this.crossed = new Array(n).fill(false);
    this.snap = this.makeSnapshot();
  }

  // ---- control -----------------------------------------------------------

  /** Back to the paddock with a brand new race (optionally a specific one). */
  newRace(seed?: number) {
    this.plan = generateRacePlan(this.n, seed);
    this.raceId++;
    this.phase = "paddock";
    this.t = 0;
    this.phaseTime = 0;
    this.timeScale = 1;
    this.freeze = 0;
    this.progress.fill(0);
    this.finishOrder = [];
    this.crossed.fill(false);
    this.lineIdx = 0;
    this.line = null;
    this.lastCount = 99;
    this.notify();
  }

  start() {
    if (this.phase !== "paddock") return;
    this.phase = "countdown";
    this.phaseTime = 0;
    this.t = -COUNTDOWN;
    this.lastCount = 99;
    this.notify();
  }

  // ---- loop --------------------------------------------------------------

  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.1);
    this.phaseTime += dt;
    let urgent = false;

    if (this.phase === "countdown") {
      this.t += dt;
      const n = Math.ceil(-this.t);
      if (n !== this.lastCount && n > 0 && n <= 3) {
        this.lastCount = n;
        this.emit({ type: "countdown", n });
        urgent = true;
      }
      if (this.t >= 0) {
        this.t = 0;
        this.phase = "running";
        this.phaseTime = 0;
        this.lastCount = 0;
        this.emit({ type: "go" });
        urgent = true;
      }
    } else if (this.phase === "running" || this.phase === "finished") {
      if (this.freeze > 0) {
        this.freeze -= dt;
        if (this.freeze <= 0) urgent = true;
      } else {
        const sm = this.plan.slowMo;
        const target =
          this.phase === "running" && sm && this.t > sm.from && this.t < sm.to ? sm.scale : 1;
        this.timeScale += (target - this.timeScale) * (1 - Math.exp(-dt * 7));
        this.t += dt * this.timeScale;
      }

      for (let i = 0; i < this.n; i++) {
        this.progress[i] = progressAt(this.plan, i, this.t);
        if (!this.crossed[i] && this.t >= this.plan.finishTimes[i]) {
          this.crossed[i] = true;
          this.finishOrder.push(i);
          const place = this.finishOrder.length;
          this.emit({ type: "cross", horse: i, place });
          if (place === 1 && this.plan.photoFinish) {
            this.freeze = PHOTO_FREEZE;
            this.emit({ type: "photo" });
          }
          urgent = true;
        }
      }

      while (
        this.lineIdx < this.plan.commentary.length &&
        this.plan.commentary[this.lineIdx].t <= this.t
      ) {
        this.line = this.plan.commentary[this.lineIdx++];
        this.lineId++;
        this.emit({ type: "line", line: this.line });
        urgent = true;
      }

      // Heartbeat drum that speeds up towards the line
      if (this.phase === "running" && this.finishOrder.length === 0 && this.freeze <= 0) {
        const lead = Math.max(...this.progress);
        const tension = smooth(0.45, 0.98, lead);
        const bpm = 72 + 108 * tension;
        this.beatPhase += (dt * bpm) / 60;
        if (this.beatPhase >= 1) {
          this.beatPhase -= 1;
          this.emit({ type: "beat", strength: 0.35 + 0.65 * tension });
        }
      }

      const last = Math.max(...this.plan.finishTimes);
      if (this.phase === "running" && this.t > last + 1.1 && this.freeze <= 0) {
        this.phase = "finished";
        this.phaseTime = 0;
        this.emit({ type: "end", winner: this.finishOrder[0] });
        urgent = true;
      }
    }

    this.sinceNotify += dt;
    if (urgent || this.sinceNotify >= NOTIFY_EVERY) this.notify();
  }

  // ---- derived -----------------------------------------------------------

  ranking(): number[] {
    const idx = Array.from({ length: this.n }, (_, i) => i);
    return idx.sort((a, b) => {
      const fa = this.finishOrder.indexOf(a);
      const fb = this.finishOrder.indexOf(b);
      if (fa !== -1 || fb !== -1) {
        if (fa === -1) return 1;
        if (fb === -1) return -1;
        return fa - fb;
      }
      return this.progress[b] - this.progress[a];
    });
  }

  placeOf(i: number) {
    return this.finishOrder.indexOf(i);
  }

  // ---- subscriptions -----------------------------------------------------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snap;

  onEvent(fn: (e: RaceEvent) => void) {
    this.eventListeners.add(fn);
    return () => {
      this.eventListeners.delete(fn);
    };
  }

  private emit(e: RaceEvent) {
    this.eventListeners.forEach((fn) => fn(e));
  }

  private notify() {
    this.sinceNotify = 0;
    this.snap = this.makeSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  private makeSnapshot(): Snapshot {
    const countdown =
      this.phase === "countdown"
        ? Math.max(1, Math.min(4, Math.ceil(-this.t)))
        : this.phase === "running" && this.phaseTime < 1.1
          ? 0
          : null;
    return {
      phase: this.phase,
      countdown,
      t: this.t,
      progress: Array.from(this.progress),
      ranking: this.ranking(),
      finishOrder: [...this.finishOrder],
      finishTimes: [...this.plan.finishTimes],
      line: this.line,
      lineId: this.lineId,
      photo: this.freeze > 0,
      slowMo: this.timeScale < 0.8,
      raceId: this.raceId,
    };
  }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
