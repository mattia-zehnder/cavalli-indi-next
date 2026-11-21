// Runtime of a race. Lives outside React: the 3D scene reads it every frame,
// the HUD subscribes to throttled snapshots, audio listens to its events.

import { INNER_Z, KEEP_LANES, OUTER_Z, laneZ, worldX } from "./config";
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
  countdown: number | null; // seconds left in the stalls (4..1), 0 right after the start
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

const COUNTDOWN = 5; // runners go into the stalls (bugle call), then the gates open
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
  /** lateral position (world z) of each runner: they leave their stall and look for the rail */
  lateral: Float32Array;
  finishOrder: number[] = [];
  crossed: boolean[];
  private prevX: Float32Array;
  private speed: Float32Array;

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
    this.lateral = Float32Array.from({ length: n }, (_, i) => laneZ(i, n));
    this.prevX = new Float32Array(n).fill(worldX(0));
    this.speed = new Float32Array(n);
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
    for (let i = 0; i < this.n; i++) this.lateral[i] = laneZ(i, this.n);
    this.prevX.fill(worldX(0));
    this.speed.fill(0);
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

      const raceDt = this.freeze > 0 ? 0 : dt * this.timeScale;
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

      if (raceDt > 0) this.updateFormation(raceDt);

      while (
        this.lineIdx < this.plan.commentary.length &&
        this.plan.commentary[this.lineIdx].t <= this.t
      ) {
        this.line = this.plan.commentary[this.lineIdx++];
        this.lineId++;
        this.emit({ type: "line", line: this.line });
        urgent = true;
      }

      // Galloping strides (hoofbeats + crowd), building up towards the line
      if (this.phase === "running" && this.freeze <= 0) {
        const lead = Math.max(...this.progress);
        const tension = this.finishOrder.length ? 1 : smooth(0.3, 0.98, lead);
        this.beatPhase += dt * this.timeScale * (2.1 + 0.35 * tension);
        if (this.beatPhase >= 1) {
          this.beatPhase -= 1;
          const settling = this.finishOrder.length ? Math.max(0, 1 - (this.t - this.plan.finishTimes[this.finishOrder[0]]) / 1.5) : 1;
          this.emit({ type: "beat", strength: (0.25 + 0.75 * tension) * settling });
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

  /**
   * Runners look for the inside rail, never cut across someone running
   * alongside, and swing out to pass a slower runner ahead.
   */
  private updateFormation(dt: number) {
    const n = this.n;
    if (KEEP_LANES) {
      for (let i = 0; i < n; i++) this.lateral[i] = laneZ(i, n);
      return;
    }
    const SP = 1.0; // lateral spacing between two runners side by side
    const L = 1.15; // longitudinal clearance (a bottle length + a bit)
    const x = Array.from({ length: n }, (_, i) => worldX(Math.min(this.progress[i], 1.12)));
    for (let i = 0; i < n; i++) {
      const v = (x[i] - this.prevX[i]) / dt;
      this.speed[i] += (v - this.speed[i]) * Math.min(1, dt * 4);
      this.prevX[i] = x[i];
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[b] - x[a]);
    const target = new Array<number>(n).fill(NaN);
    for (const i of order) {
      // can't move inside across a runner that's alongside
      let cand = INNER_Z;
      for (let j = 0; j < n; j++) {
        if (j === i || Math.abs(x[j] - x[i]) >= L) continue;
        if (this.lateral[j] < this.lateral[i] - 0.01) cand = Math.max(cand, this.lateral[j] + SP);
      }
      // go around anyone alongside, or ahead that we're catching
      for (let pass = 0; pass < n; pass++) {
        let moved = false;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const dx = x[j] - x[i];
          const closing = Math.max(0, this.speed[i] - this.speed[j]);
          const blocking = Math.abs(dx) < L || (dx > 0 && dx < L + closing * 1.3);
          if (!blocking) continue;
          const zj = Number.isNaN(target[j]) ? this.lateral[j] : target[j];
          if (Math.abs(cand - zj) < SP) {
            cand = zj + SP;
            moved = true;
          }
        }
        if (!moved) break;
      }
      target[i] = Math.min(cand, OUTER_Z);
    }
    const maxStep = 1.5 * dt;
    for (let i = 0; i < n; i++) {
      const d = (target[i] - this.lateral[i]) * Math.min(1, dt * 2.2);
      this.lateral[i] += Math.max(-maxStep, Math.min(maxStep, d));
    }
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
