// Race "director": builds a whole race in advance so it can be dramatic.
//
// Fairness: the finishing order is a uniformly random permutation and every
// runner's pace shape is drawn from the same distribution. We then generate a
// batch of candidate races and keep the most exciting one. The excitement score
// never looks at *who* is who (only at the shape of the race), so every
// camparino still has exactly the same chance to win.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 2 ** 32);
}

/** A commentary line. `{0}`, `{1}` are replaced by the runners in `horses`. */
export type CommentaryLine = {
  t: number; // race time (s)
  text: string;
  horses: number[];
  priority: number;
  kind:
    | "start"
    | "lead"
    | "surge"
    | "hiccup"
    | "slow-start"
    | "half"
    | "last"
    | "stretch"
    | "duel"
    | "photo"
    | "win";
};

export type RacePlan = {
  seed: number;
  finishTimes: number[]; // race seconds, per runner
  order: number[]; // runner indices in finishing order
  samples: Float32Array[]; // progress 0..1 per runner, evenly spaced up to its finish time
  sampleDt: number[]; // spacing of `samples` per runner
  endSpeed: number[]; // progress per second when crossing the line (for the run-out)
  reactions: number[]; // start reaction time per runner
  hiccups: (number | null)[]; // race time of a stumble, per runner
  photoFinish: boolean; // 1st and 2nd separated by a whisker
  slowMo: { from: number; to: number; scale: number } | null;
  commentary: CommentaryLine[];
};

const STEP = 1 / 60;
const RUNOUT_TAU = 1.4;

const gauss = (x: number) => Math.exp(-x * x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const pick = <T>(rng: Rng, arr: T[]) => arr[Math.floor(rng() * arr.length)];

type Shape = {
  samples: Float32Array;
  dt: number;
  reaction: number;
  hiccup: { t: number } | null;
};

function makeShape(rng: Rng, T: number): Shape {
  const n = Math.ceil(T / STEP) + 1;
  const dt = T / (n - 1);
  const vel = new Float64Array(n);

  // Most bottles jump out of the gate; once in a while one is asleep.
  const reaction = 0.03 + rng() ** 2.2 * 0.5;
  const rampDur = 0.7 + rng() * 0.5;
  const strategy = rng() * 2 - 1; // -1 = front-runner, +1 = closer
  const waves = Array.from({ length: 3 }, () => ({
    a: 0.03 + rng() * 0.08,
    f: 0.5 + rng() * 2.2,
    p: rng() * Math.PI * 2,
  }));
  const bursts = Array.from({ length: 1 + Math.floor(rng() * 2.4) }, () => ({
    u: 0.18 + rng() * 0.78,
    w: 0.035 + rng() * 0.06,
    a: 0.16 + rng() * 0.38,
  }));
  const hiccup =
    rng() < 0.3
      ? { u: 0.25 + rng() * 0.55, w: 0.018 + rng() * 0.02, a: 0.45 + rng() * 0.3 }
      : null;

  for (let k = 0; k < n; k++) {
    const t = k * dt;
    const u = t / T;
    let s = 1 + strategy * 0.24 * (u - 0.5);
    for (const w of waves) s += w.a * Math.sin(2 * Math.PI * w.f * u + w.p);
    for (const b of bursts) s += b.a * gauss((u - b.u) / b.w);
    if (hiccup) s -= hiccup.a * gauss((u - hiccup.u) / hiccup.w);
    s = Math.max(0.18, s);
    vel[k] = s * smoothstep(reaction, reaction + rampDur, t);
  }

  // Integrate (trapezoid) and normalise so the runner crosses the line exactly at T.
  const samples = new Float32Array(n);
  let acc = 0;
  for (let k = 1; k < n; k++) {
    acc += ((vel[k - 1] + vel[k]) / 2) * dt;
    samples[k] = acc;
  }
  for (let k = 0; k < n; k++) samples[k] /= acc;
  samples[n - 1] = 1;

  return {
    samples,
    dt,
    reaction,
    hiccup: hiccup ? { t: hiccup.u * T } : null,
  };
}

export function progressAt(plan: RacePlan, i: number, t: number) {
  if (t <= 0) return 0;
  const T = plan.finishTimes[i];
  if (t < T) {
    const s = plan.samples[i];
    const f = t / plan.sampleDt[i];
    const k = Math.min(s.length - 2, Math.floor(f));
    const a = f - k;
    return s[k] + (s[k + 1] - s[k]) * a;
  }
  // Past the line: coast to a stop.
  const x = t - T;
  return 1 + plan.endSpeed[i] * RUNOUT_TAU * (1 - Math.exp(-x / RUNOUT_TAU));
}

function randomPermutation(rng: Rng, n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCandidate(rng: Rng, n: number, seed: number): RacePlan {
  const order = randomPermutation(rng, n);
  const winTime = 21.5 + rng() * 3;
  const photo = rng() < 0.33;
  const gaps = [
    photo ? 0.02 + rng() * 0.09 : 0.16 + rng() * 0.45,
    0.04 + rng() * 0.45,
    0.06 + rng() * 0.6,
    0.1 + rng() * 1.1,
  ];
  const finishTimes = new Array<number>(n);
  let tt = winTime;
  order.forEach((runner, place) => {
    if (place > 0) tt += gaps[Math.min(place - 1, gaps.length - 1)];
    finishTimes[runner] = tt;
  });

  const shapes = finishTimes.map((T) => makeShape(rng, T));
  const plan: RacePlan = {
    seed,
    finishTimes,
    order,
    samples: shapes.map((s) => s.samples),
    sampleDt: shapes.map((s) => s.dt),
    endSpeed: shapes.map((s) => {
      const k = s.samples.length - 1;
      return (s.samples[k] - s.samples[k - 1]) / s.dt;
    }),
    reactions: shapes.map((s) => s.reaction),
    hiccups: shapes.map((s) => (s.hiccup ? s.hiccup.t : null)),
    photoFinish: gaps[0] < 0.13,
    slowMo: null,
    commentary: [],
  };

  const g1 = gaps[0];
  plan.slowMo =
    g1 < 0.4
      ? { from: winTime - 1.5, to: winTime + g1 + 0.3, scale: 0.33 }
      : { from: winTime - 0.7, to: winTime + 0.15, scale: 0.6 };
  return plan;
}

function rankAt(plan: RacePlan, t: number, n: number) {
  const p = Array.from({ length: n }, (_, i) => progressAt(plan, i, t));
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => p[b] - p[a]);
  return { p, idx };
}

function excitement(plan: RacePlan, n: number, rng: Rng) {
  const T1 = plan.finishTimes[plan.order[0]];
  let leader = -1;
  let changes = 0;
  const leaders = new Set<number>();
  let winnerTakesLead = 0;
  for (let t = 2; t <= T1; t += 0.1) {
    const { p, idx } = rankAt(plan, t, n);
    const best = idx[0];
    if (leader === -1) {
      leader = best;
    } else if (best !== leader && p[best] - p[leader] > 0.002) {
      changes++;
      leader = best;
      if (best === plan.order[0]) winnerTakesLead = t;
    }
    leaders.add(leader);
  }
  const spread = (t: number) => {
    const { p } = rankAt(plan, t, n);
    return Math.max(...p) - Math.min(...p);
  };
  const mid = spread(T1 * 0.5);
  const late = spread(T1 * 0.85);
  const u = winnerTakesLead / T1;

  let s = Math.min(changes, 7) - Math.max(0, changes - 9);
  s += leaders.size * 0.7;
  if (u > 0.72 && u < 0.985) s += 2.5; // late overtake for the win
  if (mid < 0.06) s += 1;
  else if (mid > 0.14) s -= 2;
  if (late < 0.08) s += 1;
  return s + rng() * 1.5;
}

const LINES = {
  start: ["Partiti!", "Si aprono i cancelli: partiti!", "Partenza regolare, sono partiti!"],
  firstLead: ["Al comando si porta {0}.", "Scatta bene {0}, che prende la testa."],
  slowStart: ["Partenza lenta per {0}.", "{0} si fa sorprendere al via."],
  lead: [
    "{0} passa al comando!",
    "Cambio al vertice: ora guida {0}.",
    "{0} prende la testa della corsa.",
    "{0} si porta in testa.",
  ],
  backInLead: ["{0} torna al comando!", "{0} riprende la testa."],
  surge: [
    "Bella progressione di {0}.",
    "{0} guadagna terreno all'esterno.",
    "Attenzione a {0}, che risale forte.",
    "{0} rimonta posizioni.",
  ],
  hiccup: ["{0} perde un po' di terreno.", "Momento di difficoltà per {0}."],
  half: ["A metà percorso comanda {0}, segue {1}.", "Metà corsa: {0} davanti a {1}."],
  last: ["Chiude il gruppo {0}.", "In coda al gruppo {0}."],
  stretch: ["Entrano in dirittura d'arrivo!", "Ultimi cento metri!"],
  duel: ["{0} e {1} appaiati!", "Testa a testa tra {0} e {1}!"],
  photo: ["Arrivo al fotofinish!"],
  win: ["Vince {0}!", "Primo al traguardo {0}!", "{0} vince il premio!"],
  winPhoto: ["Al fotofinish la spunta {0}!", "Vince {0}, per pochissimo!"],
};

function buildCommentary(plan: RacePlan, n: number, rng: Rng): CommentaryLine[] {
  const T1 = plan.finishTimes[plan.order[0]];
  const cands: CommentaryLine[] = [];
  const add = (
    t: number,
    kind: CommentaryLine["kind"],
    text: string,
    horses: number[],
    priority: number,
  ) => cands.push({ t, kind, text, horses, priority });

  add(0.05, "start", pick(rng, LINES.start), [], 10);

  // Sleepy starter
  const sleepy = plan.reactions.indexOf(Math.max(...plan.reactions));
  if (plan.reactions[sleepy] > 0.28) {
    add(2.4, "slow-start", pick(rng, LINES.slowStart), [sleepy], 3);
  }

  // Walk the race and spot what's happening
  let leader = -1;
  let lastLeadT = -10;
  const rankHistory: { t: number; idx: number[] }[] = [];
  let lastSurge: Record<number, number> = {};
  for (let t = 1.5; t < T1 - 0.35; t += 0.05) {
    const { p, idx } = rankAt(plan, t, n);
    rankHistory.push({ t, idx });
    const best = idx[0];
    if (leader === -1 && t >= 2.4) {
      leader = best;
      add(t, "lead", pick(rng, LINES.firstLead), [best], 5);
      lastLeadT = t;
    } else if (leader !== -1 && best !== leader && p[best] - p[leader] > 0.002) {
      leader = best;
      if (t - lastLeadT > 1.2) add(t, "lead", pick(rng, LINES.lead), [best], t > T1 * 0.8 ? 8 : 7);
      lastLeadT = t;
    }
    // Surge: gained 2+ places in the last 2 seconds
    const past = rankHistory.find((h) => h.t >= t - 2);
    if (past && t > 4) {
      for (let i = 0; i < n; i++) {
        const gained = past.idx.indexOf(i) - idx.indexOf(i);
        if (gained >= 2 && t - (lastSurge[i] ?? -10) > 5) {
          add(t, "surge", pick(rng, LINES.surge), [i], 6);
          lastSurge = { ...lastSurge, [i]: t };
        }
      }
    }
  }

  plan.hiccups.forEach((ht, i) => {
    if (ht != null && ht > 3 && ht < T1 - 2) add(ht + 0.2, "hiccup", pick(rng, LINES.hiccup), [i], 4);
  });

  {
    const { idx } = rankAt(plan, T1 * 0.5, n);
    add(T1 * 0.5, "half", pick(rng, LINES.half), [idx[0], idx[1]], 4);
  }
  {
    const t = T1 * 0.66;
    const { idx } = rankAt(plan, t, n);
    add(t, "last", pick(rng, LINES.last), [idx[n - 1]], 2);
  }

  // Final stretch: when the leader has ~100 m to go
  let stretchT = T1 * 0.85;
  for (let t = T1 * 0.6; t < T1; t += 0.05) {
    if (Math.max(...rankAt(plan, t, n).p) >= 0.875) {
      stretchT = t;
      break;
    }
  }
  add(stretchT, "stretch", pick(rng, LINES.stretch), [], 9);
  {
    const t = Math.min(T1 - 0.6, stretchT + 1.8);
    const { p, idx } = rankAt(plan, t, n);
    if (p[idx[0]] - p[idx[1]] < 0.02) add(t, "duel", pick(rng, LINES.duel), [idx[0], idx[1]], 8);
  }

  const winner = plan.order[0];
  if (plan.photoFinish) {
    add(T1, "photo", pick(rng, LINES.photo), [], 11);
    add(T1 + 0.05, "win", pick(rng, LINES.winPhoto), [winner], 11);
  } else {
    add(T1, "win", pick(rng, LINES.win), [winner], 11);
  }

  // Keep the important lines and leave room between them so the voice can talk.
  const accepted: CommentaryLine[] = [];
  const sorted = [...cands].sort((a, b) => b.priority - a.priority || a.t - b.t);
  for (const c of sorted) {
    const gap = c.priority >= 9 ? 0.04 : c.priority === 8 ? 1.4 : 2.1;
    const clash = accepted.some((a) => Math.abs(a.t - c.t) < gap && !(c.kind === "win" && a.kind === "photo"));
    if (!clash) accepted.push(c);
  }
  accepted.sort((a, b) => a.t - b.t);
  // Same leader announced twice in a row means someone else led in between
  // (that line was dropped for spacing): say it "gets back" in front.
  let lastLeader = -1;
  for (const l of accepted) {
    if (l.kind !== "lead") continue;
    if (l.horses[0] === lastLeader) l.text = pick(rng, LINES.backInLead);
    lastLeader = l.horses[0];
  }
  return accepted;
}

export function generateRacePlan(n: number, seed = randomSeed()): RacePlan {
  const rng = mulberry32(seed);
  let best: RacePlan | null = null;
  let bestScore = -Infinity;
  for (let c = 0; c < 48; c++) {
    const cand = buildCandidate(rng, n, seed);
    const s = excitement(cand, n, rng);
    if (s > bestScore) {
      best = cand;
      bestScore = s;
    }
  }
  const plan = best!;
  plan.commentary = buildCommentary(plan, n, rng);
  return plan;
}

export const fillLine = (line: CommentaryLine, names: string[]) =>
  line.text.replace(/\{(\d)\}/g, (_, d) => names[line.horses[Number(d)]] ?? "");
