"use client";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Maximize,
  Mic,
  MicOff,
  Minimize,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  CONTENDERS,
  RACE_METERS,
  lengthsShort,
  marginLabel,
  raceName,
  type Contender,
} from "@/lib/race/config";
import type { Snapshot } from "@/lib/race/engine";
import type { CommentaryLine } from "@/lib/race/plan";
import { formOf, type Tally } from "@/lib/race/tally";
import { asset } from "@/lib/asset";

const EDGE = "clamp(12px,1.6vw,28px)";
const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** 0'22"72 */
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(2).padStart(5, "0").replace(".", '"');
  return `${m}'${rest}`;
};

// ---------------------------------------------------------------------------

/** Saddle-cloth number: the colour square everybody bets on. */
export function Saddle({
  c,
  size = 30,
  className = "",
}: {
  c: Contender;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`font-display inline-flex shrink-0 items-center justify-center font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.72,
        lineHeight: 1,
        background: c.hex,
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,.55)",
        borderRadius: Math.max(2, size * 0.08),
      }}
    >
      {c.number}
    </span>
  );
}

function Chip({ i }: { i: number }) {
  const c = CONTENDERS[i];
  if (!c) return null;
  return (
    <span className="ml-1.5 inline-flex items-baseline gap-2 align-middle">
      <Saddle c={c} size={28} className="self-center" />
      <span className="font-semibold">{c.name}</span>
    </span>
  );
}

function LineText({ line }: { line: CommentaryLine }) {
  const parts = line.text.split(/(\{\d\})/g);
  return (
    <>
      {parts.map((p, k) => {
        const m = p.match(/^\{(\d)\}$/);
        return m ? (
          <Chip key={k} i={line.horses[Number(m[1])]} />
        ) : (
          <span key={k}>{p}</span>
        );
      })}
    </>
  );
}

function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`font-display text-[clamp(11px,0.8vw,15px)] font-semibold uppercase tracking-[0.22em] text-[var(--rc-cream)]/55 ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TopBar({ snap, race }: { snap: Snapshot; race: number }) {
  const status =
    snap.phase === "paddock"
      ? { text: "Scommesse aperte", color: "#3fbf7f" }
      : snap.phase === "finished"
        ? { text: "Arrivo ufficiale", color: "#c9a44c" }
        : { text: "Scommesse chiuse", color: "#e0404f" };
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4"
      style={{ padding: EDGE }}
    >
      <div className="flex items-center gap-[clamp(10px,1vw,18px)]">
        <Image
          src={asset("/indi-background.png")}
          alt="Bar Indipendenza"
          width={72}
          height={72}
          priority
          className="h-[clamp(38px,3.6vw,68px)] w-auto"
        />
        <div className="leading-none">
          <div className="font-serif text-[clamp(22px,2.3vw,44px)] font-bold italic text-[var(--rc-cream)]">
            Casino Campari Night
          </div>
          <Label className="mt-1.5">Ippodromo Bar Indipendenza · Broni</Label>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 text-right">
        <div className="hud-panel rounded-md px-[clamp(12px,1.1vw,20px)] py-[clamp(6px,0.55vw,10px)]">
          <Label>Corsa N° {race}</Label>
          <div className="font-serif mt-1 text-[clamp(16px,1.45vw,28px)] font-semibold leading-none text-[var(--rc-cream)]">
            {raceName(race)}
          </div>
        </div>
        <div
          className="font-display flex items-center gap-2 rounded-sm px-2.5 py-1 text-[clamp(11px,0.8vw,15px)] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: "rgba(8,13,11,.85)",
            color: status.color,
            border: `1px solid ${status.color}66`,
          }}
        >
          <span
            className={`inline-block h-2 w-2 ${snap.phase === "running" ? "live-dot" : ""}`}
            style={{ background: status.color }}
          />
          {status.text}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Standings({ snap }: { snap: Snapshot }) {
  const lead = Math.max(...snap.progress);
  return (
    <div
      className="hud-panel pointer-events-none absolute z-20 w-[clamp(230px,18vw,340px)] overflow-hidden rounded-md"
      style={{ right: EDGE, top: "clamp(120px,10.5vw,190px)" }}
    >
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
        <span className="font-display text-[clamp(14px,1.05vw,20px)] font-semibold uppercase tracking-[0.14em] text-[var(--rc-cream)]">
          Ordine di corsa
        </span>
        <span className="font-display flex items-center gap-1.5 text-[clamp(10px,0.75vw,14px)] font-semibold uppercase tracking-widest text-[#e0404f]">
          <span className="live-dot h-1.5 w-1.5 bg-[#e0404f]" /> Live
        </span>
      </div>
      <div className="hud-rule" />
      <div className="flex flex-col py-1">
        {snap.ranking.map((i, pos) => {
          const c = CONTENDERS[i];
          const fin = snap.finishOrder.indexOf(i);
          let right: string;
          if (fin >= 0) right = fin === 0 ? "1° arrivato" : `${fin + 1}°`;
          else if (pos === 0)
            right = `${Math.max(0, Math.round((1 - snap.progress[i]) * RACE_METERS))} m`;
          else right = lengthsShort((lead - snap.progress[i]) * RACE_METERS);
          return (
            <motion.div
              layout
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
              key={c.id}
              className="flex items-center gap-2.5 px-3 py-[clamp(3px,0.4vw,7px)]"
              style={{
                background: pos === 0 ? "rgba(201,164,76,.12)" : undefined,
              }}
            >
              <span className="font-display w-[1.4em] text-[clamp(15px,1.2vw,22px)] font-bold text-[var(--rc-cream)]/70">
                {pos + 1}
              </span>
              <Saddle c={c} size={26} />
              <span className="font-display flex-1 truncate text-[clamp(15px,1.2vw,22px)] font-semibold uppercase tracking-wide text-[var(--rc-cream)]">
                {c.name}
              </span>
              <span className="font-display text-[clamp(12px,0.95vw,17px)] font-medium tabular-nums text-[var(--rc-cream)]/70">
                {right}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Tracker({ snap }: { snap: Snapshot }) {
  const lead = Math.max(...snap.progress);
  const toGo = Math.max(0, Math.round((1 - lead) * RACE_METERS));
  return (
    <div
      className="hud-panel pointer-events-none absolute z-20 mx-auto flex max-w-[1400px] items-center gap-5 rounded-md px-[clamp(12px,1.2vw,22px)] py-3"
      style={{ left: EDGE, right: EDGE, bottom: EDGE }}
    >
      <div className="w-[clamp(84px,7.5vw,140px)] shrink-0 leading-none">
        <Label>{toGo > 0 ? "Al traguardo" : "Arrivo"}</Label>
        <div className="font-display mt-1 text-[clamp(24px,2.1vw,40px)] font-bold tabular-nums text-[var(--rc-cream)]">
          {toGo > 0 ? `${toGo} m` : "—"}
        </div>
      </div>
      <div className="relative h-[clamp(60px,5vw,90px)] flex-1">
        {CONTENDERS.map((c, i) => (
          <div
            key={c.id}
            className="absolute inset-x-0 h-px bg-white/10"
            style={{ top: `${((i + 0.5) / CONTENDERS.length) * 100}%` }}
          />
        ))}
        {[200, 400, 600].map((m) => (
          <div
            key={m}
            className="absolute inset-y-0"
            style={{ left: `${(1 - m / RACE_METERS) * 100}%` }}
          >
            <div className="h-full w-px bg-white/15" />
            <span className="font-display absolute -top-0.5 left-1 text-[10px] font-medium text-white/35">
              {m}
            </span>
          </div>
        ))}
        {/* winning post */}
        <div className="absolute inset-y-0 right-0 w-[3px] bg-[var(--rc-red)]" />
        {CONTENDERS.map((c, i) => {
          const p = Math.min(1, snap.progress[i]);
          return (
            <div
              key={c.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left] duration-100 ease-linear"
              style={{
                left: `${p * 100}%`,
                top: `${((i + 0.5) / CONTENDERS.length) * 100}%`,
              }}
            >
              <Saddle c={c} size={20} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Ticker({ snap }: { snap: Snapshot }) {
  const show =
    snap.line &&
    snap.line.kind !== "win" &&
    snap.line.kind !== "photo" &&
    snap.t - snap.line.t < 2.8 &&
    snap.phase !== "finished";
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4"
      style={{ bottom: "clamp(108px,9.2vw,165px)" }}
    >
      <AnimatePresence mode="wait">
        {show && snap.line && (
          <motion.div
            key={snap.lineId}
            {...fade}
            transition={{ duration: 0.25 }}
            className="hud-panel flex items-center gap-4 rounded-md border-l-4 border-l-[var(--rc-gold)] px-[clamp(14px,1.3vw,26px)] py-[clamp(8px,0.7vw,14px)]"
          >
            <div className="flex flex-col items-center gap-1 text-[var(--rc-gold)]">
              <Mic className="h-[clamp(16px,1.3vw,24px)] w-[clamp(16px,1.3vw,24px)]" />
            </div>
            <span className="text-[clamp(18px,1.7vw,34px)] font-medium leading-tight text-[var(--rc-cream)]">
              <LineText line={snap.line} />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Loading into the stalls (replaces a big 3-2-1). */
export function StartStrip({ snap }: { snap: Snapshot }) {
  const show = snap.phase === "countdown";
  const u = Math.min(1, Math.max(0, 1 + snap.t / 5));
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4"
      style={{ bottom: "clamp(108px,9.2vw,165px)" }}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            key="start"
            {...fade}
            transition={{ duration: 0.3 }}
            className="hud-panel w-[min(640px,90vw)] rounded-md px-6 py-4 text-center"
          >
            <Label>{raceStartLabel(snap.t)}</Label>
            <div className="font-serif mt-1 text-[clamp(22px,2.1vw,40px)] font-semibold italic text-[var(--rc-cream)]">
              {snap.t < -2
                ? "I partenti entrano in gabbia"
                : "Pronti alla partenza"}
            </div>
            <div className="mt-3 h-[3px] w-full bg-white/10">
              <div
                className="h-full bg-[var(--rc-gold)]"
                style={{ width: `${u * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const raceStartLabel = (t: number) =>
  t < -2 ? "Scommesse chiuse" : "Partenza";

// ---------------------------------------------------------------------------

export function PhotoFinish({ snap }: { snap: Snapshot }) {
  return (
    <AnimatePresence>
      {snap.photo && (
        <motion.div
          key="photo"
          className="pointer-events-none absolute inset-0 z-40"
          {...fade}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
          <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[var(--rc-red)]" />
          <div className="absolute left-1/2 top-[11%] -translate-x-1/2 bg-black/80 px-6 py-2.5 text-center">
            <div className="font-display text-[clamp(28px,3vw,56px)] font-bold uppercase tracking-[0.3em] text-white">
              Fotofinish
            </div>
            <div className="font-display text-[clamp(11px,0.85vw,16px)] font-medium uppercase tracking-[0.25em] text-white/60">
              Esame della fotografia d&apos;arrivo
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------

export function WinnerBanner({ snap }: { snap: Snapshot }) {
  const w = snap.finishOrder[0];
  const show = snap.phase === "running" && w != null && !snap.photo;
  const c = w != null ? CONTENDERS[w] : null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
      style={{ top: "clamp(110px,9.5vw,180px)" }}
    >
      <AnimatePresence>
        {show && c && (
          <motion.div
            key="winner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="hud-panel flex items-center gap-4 rounded-md border-t-2 border-t-[var(--rc-gold)] px-6 py-3"
          >
            <Label className="!text-[var(--rc-gold)]">Vincitore</Label>
            <Saddle c={c} size={48} />
            <span className="font-display text-[clamp(28px,2.8vw,54px)] font-bold uppercase leading-none tracking-wide text-[var(--rc-cream)]">
              {c.name}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Form({ positions }: { positions: number[] }) {
  if (!positions.length)
    return <span className="text-[var(--rc-cream)]/40">—</span>;
  return (
    <span className="inline-flex gap-1">
      {positions.map((p, k) => (
        <span
          key={k}
          className="font-display inline-flex h-[1.5em] w-[1.3em] items-center justify-center text-[0.95em] font-semibold"
          style={{
            background: p === 1 ? "var(--rc-gold)" : "rgba(239,230,210,.1)",
            color: p === 1 ? "#14110a" : "var(--rc-cream)",
          }}
        >
          {p}
        </span>
      ))}
    </span>
  );
}

/** Racecard shown while bets are open. */
export function Racecard({
  tally,
  onStart,
  disabled,
}: {
  tally: Tally;
  onStart: () => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      {...fade}
      transition={{ duration: 0.4 }}
      className="absolute inset-x-0 bottom-0 z-30 flex justify-center"
      style={{ padding: EDGE }}
    >
      <div className="hud-panel w-full max-w-[1500px] overflow-hidden rounded-md">
        <div className="flex flex-wrap items-end justify-between gap-2 px-[clamp(14px,1.4vw,28px)] pb-2 pt-3">
          <div>
            <Label>Programma · Corsa N° {tally.race}</Label>
            <div className="font-serif mt-1 text-[clamp(24px,2.4vw,46px)] font-bold leading-none text-[var(--rc-cream)]">
              {raceName(tally.race)}
            </div>
          </div>
          <div className="font-display text-right text-[clamp(13px,1vw,19px)] font-medium uppercase tracking-[0.12em] text-[var(--rc-cream)]/70">
            {RACE_METERS} m · Pista in erba · Terreno buono ·{" "}
            {CONTENDERS.length} partenti
          </div>
        </div>
        <div className="hud-rule" />
        <div className="grid grid-cols-5 divide-x divide-white/10">
          {CONTENDERS.map((c) => {
            const wins = tally.wins[c.id] ?? 0;
            return (
              <div
                key={c.id}
                className="flex items-center gap-[clamp(8px,0.9vw,16px)] px-[clamp(10px,1.1vw,22px)] py-[clamp(10px,1vw,18px)]"
              >
                <Saddle c={c} size={58} />
                <div className="min-w-0 leading-tight">
                  <div className="font-display truncate text-[clamp(18px,1.6vw,32px)] font-bold uppercase tracking-wide text-[var(--rc-cream)]">
                    {c.name}
                  </div>
                  <div className="font-display mt-1 flex items-center gap-2 text-[clamp(11px,0.85vw,16px)] text-[var(--rc-cream)]/60">
                    <span className="uppercase tracking-[0.14em]">Forma</span>
                    <Form positions={formOf(tally, c.id)} />
                  </div>
                  <div className="font-display text-[clamp(11px,0.85vw,16px)] uppercase tracking-[0.14em] text-[var(--rc-cream)]/60">
                    Vittorie{" "}
                    <span className="font-semibold text-[var(--rc-cream)]">
                      {wins}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-[clamp(14px,1.4vw,28px)] py-3">
          <div className="text-[clamp(12px,0.9vw,17px)] text-[var(--rc-cream)]/60">
            Tutti i partenti hanno le stesse probabilità di vittoria.
          </div>
          <div className="flex items-center gap-4">
            <span className="font-display text-[clamp(11px,0.8vw,15px)] uppercase tracking-[0.2em] text-[var(--rc-cream)]/45">
              Premi{" "}
              <kbd className="rounded-sm border border-white/25 px-1.5 py-0.5">
                spazio
              </kbd>
            </span>
            <button
              onClick={onStart}
              disabled={disabled}
              className="font-display pointer-events-auto rounded-sm bg-[var(--rc-red)] px-[clamp(20px,2vw,40px)] py-[clamp(8px,0.7vw,14px)] text-[clamp(18px,1.5vw,28px)] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#a50d26] disabled:opacity-50"
            >
              Avvia la corsa
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

export function Results({
  snap,
  race,
  onNext,
}: {
  snap: Snapshot;
  race: number;
  onNext: () => void;
}) {
  const order = snap.finishOrder;
  const winT = snap.finishTimes[order[0]];
  const w = CONTENDERS[order[0]];
  const nums = order.map((i) => CONTENDERS[i].number);
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, delay: 0.8 }}
      className="hud-panel absolute z-30 flex w-[clamp(300px,30vw,580px)] flex-col overflow-hidden rounded-md"
      style={{ right: EDGE, bottom: EDGE, top: "clamp(120px,10.5vw,190px)" }}
    >
      <div className="px-[clamp(16px,1.5vw,30px)] pb-3 pt-[clamp(12px,1.2vw,22px)]">
        <Label className="!text-[var(--rc-gold)]">
          Arrivo ufficiale · Corsa N° {race}
        </Label>
        <div className="font-serif mt-1 text-[clamp(20px,1.8vw,34px)] font-semibold leading-tight text-[var(--rc-cream)]">
          {raceName(race)}
        </div>
        <div className="mt-4 flex items-center gap-[clamp(10px,1vw,18px)]">
          <Saddle c={w} size={72} />
          <div className="min-w-0">
            <Label>Vincitore</Label>
            <div className="font-display truncate text-[clamp(36px,3.6vw,70px)] font-bold uppercase leading-[0.95] tracking-wide text-[var(--rc-cream)]">
              {w.name}
            </div>
          </div>
        </div>
        <div className="font-display mt-2 text-[clamp(13px,1vw,18px)] uppercase tracking-[0.12em] text-[var(--rc-cream)]/65">
          Tempo {fmtTime(winT)}
        </div>
      </div>
      <div className="hud-rule" />

      <div className="flex flex-1 flex-col overflow-y-auto px-[clamp(10px,1vw,20px)] py-2">
        {order.map((i, pos) => {
          const c = CONTENDERS[i];
          const gap =
            pos === 0
              ? ""
              : marginLabel(
                  snap.finishTimes[i] - snap.finishTimes[order[pos - 1]],
                  winT,
                );
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 + pos * 0.1 }}
              className="flex items-center gap-3 border-b border-white/5 px-2 py-[clamp(6px,0.6vw,11px)] last:border-0"
            >
              <span className="font-display w-[1.6em] text-[clamp(18px,1.6vw,30px)] font-bold text-[var(--rc-cream)]/70">
                {pos + 1}°
              </span>
              <Saddle c={c} size={32} />
              <span className="font-display flex-1 truncate text-[clamp(18px,1.5vw,28px)] font-semibold uppercase tracking-wide text-[var(--rc-cream)]">
                {c.name}
              </span>
              <span className="font-display text-[clamp(12px,0.95vw,17px)] text-[var(--rc-cream)]/65">
                {gap}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
        {[
          { label: "Vincente", value: nums.slice(0, 1) },
          { label: "Accoppiata", value: nums.slice(0, 2) },
          { label: "Trio", value: nums.slice(0, 3) },
        ].map((b) => (
          <div
            key={b.label}
            className="bg-[rgba(8,13,11,.95)] px-3 py-2.5 text-center"
          >
            <Label>{b.label}</Label>
            <div className="font-display mt-0.5 text-[clamp(20px,1.7vw,32px)] font-bold tracking-wider text-[var(--rc-cream)]">
              {b.value.join(" – ")}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-[clamp(12px,1.1vw,22px)]">
        <button
          onClick={onNext}
          className="font-display w-full rounded-sm bg-[var(--rc-red)] py-[clamp(9px,0.8vw,16px)] text-[clamp(18px,1.5vw,28px)] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#a50d26]"
        >
          Prossima corsa
        </button>
        <div className="font-display mt-2 text-center text-[clamp(10px,0.75vw,14px)] uppercase tracking-[0.2em] text-[var(--rc-cream)]/40">
          oppure premi{" "}
          <kbd className="rounded-sm border border-white/25 px-1.5 py-0.5">
            spazio
          </kbd>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

export function Controls({
  sound,
  voice,
  fullscreen,
  onSound,
  onVoice,
  onFullscreen,
  onReset,
  hidden,
}: {
  sound: boolean;
  voice: boolean;
  fullscreen: boolean;
  onSound: () => void;
  onVoice: () => void;
  onFullscreen: () => void;
  onReset: () => void;
  hidden: boolean;
}) {
  const btn =
    "pointer-events-auto flex h-9 w-9 items-center justify-center rounded-sm text-[var(--rc-cream)]/70 transition hover:bg-white/10 hover:text-white";
  return (
    <div
      className={`hud-panel absolute z-40 flex items-center gap-1 rounded-md p-1 transition-opacity duration-500 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ left: EDGE, bottom: EDGE }}
    >
      <button className={btn} onClick={onSound} title="Suoni (M)">
        {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
      </button>
      <button className={btn} onClick={onVoice} title="Telecronaca vocale (V)">
        {voice ? <Mic size={17} /> : <MicOff size={17} />}
      </button>
      <button className={btn} onClick={onFullscreen} title="Schermo intero (F)">
        {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
      </button>
      <button
        className={btn}
        onClick={onReset}
        title="Azzera serata (vittorie, forma e numero corsa)"
      >
        <RotateCcw size={17} />
      </button>
    </div>
  );
}

export function Credit({ side = "right" }: { side?: "left" | "right" }) {
  return (
    <div
      className="pointer-events-none absolute z-10 flex items-center gap-1.5 text-xs text-white/45"
      style={
        side === "right"
          ? { right: EDGE, bottom: 6 }
          : { left: "clamp(70px,5vw,96px)", bottom: EDGE }
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
      @cerestiamosotto
    </div>
  );
}

export function Loading({ progress }: { progress: number }) {
  return (
    <motion.div
      {...fade}
      initial={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#05080a]"
    >
      <Image
        src={asset("/indi-background.png")}
        alt=""
        width={84}
        height={84}
        priority
      />
      <div className="font-serif text-3xl font-semibold italic text-[var(--rc-cream)]">
        Casino Campari Night
      </div>
      <Label>Preparazione della pista</Label>
      <div className="h-[3px] w-64 bg-white/10">
        <div
          className="h-full bg-[var(--rc-gold)] transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
