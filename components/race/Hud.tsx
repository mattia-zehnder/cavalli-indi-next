"use client";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Flag,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { CONTENDERS, RACE_METERS, type Contender } from "@/lib/race/config";
import type { Snapshot } from "@/lib/race/engine";
import type { CommentaryLine } from "@/lib/race/plan";

import type { Tally } from "@/lib/race/tally";
import { asset } from "@/lib/asset";

const fmtTime = (s: number) => `${s.toFixed(2).replace(".", ",")}″`;
const fmtGap = (s: number) => `+${s.toFixed(2).replace(".", ",")}″`;
const MEDAL = ["#ffd34d", "#e5e7eb", "#e0a060"];

// ---------------------------------------------------------------------------

export function NumberTile({
  c,
  size = 32,
  className = "",
}: {
  c: Contender;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`font-display inline-flex shrink-0 items-center justify-center rounded-[22%] text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.66,
        lineHeight: 1,
        background: `linear-gradient(160deg, ${c.hex}, color-mix(in srgb, ${c.hex} 70%, black))`,
        boxShadow: `0 0 ${size * 0.5}px ${c.hex}66, inset 0 1px 0 rgba(255,255,255,.35)`,
        textShadow: "0 1px 2px rgba(0,0,0,.35)",
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
    <span className="mx-1 inline-flex items-center gap-2 align-middle">
      <NumberTile c={c} size={30} />
      <span style={{ color: c.hex }} className="font-display uppercase">
        {c.name}
      </span>
    </span>
  );
}

function LineText({ line }: { line: CommentaryLine }) {
  const parts = line.text.split(/(\{\d\})/g);
  return (
    <>
      {parts.map((p, k) => {
        const m = p.match(/^\{(\d)\}$/);
        return m ? <Chip key={k} i={line.horses[Number(m[1])]} /> : <span key={k}>{p}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------

export function TopBar({ snap, race }: { snap: Snapshot; race: number }) {
  const status =
    snap.phase === "paddock"
      ? { text: "Scommesse aperte", color: "#22c55e" }
      : snap.phase === "countdown"
        ? { text: "In partenza", color: "#ffb347" }
        : snap.phase === "running"
          ? { text: "Live", color: "#ff2d55" }
          : { text: "Arrivo ufficiale", color: "#ffd34d" };
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-[clamp(12px,1.6vw,28px)]">
      <div className="flex items-center gap-[clamp(10px,1vw,18px)]">
        <Image
          src={asset("/indi-background.png")}
          alt="Bar Indipendenza"
          width={84}
          height={84}
          priority
          className="h-[clamp(44px,4.4vw,84px)] w-auto drop-shadow-[0_0_18px_rgba(255,40,60,0.55)]"
        />
        <div className="leading-none">
          <div className="font-display text-[clamp(22px,2.6vw,52px)] uppercase text-white [text-shadow:0_2px_24px_rgba(255,42,60,0.55)]">
            Casino <span className="text-[#ff2a3c]">Campari</span> Night
          </div>
          <div className="mt-1 text-[clamp(11px,0.9vw,17px)] font-semibold uppercase tracking-[0.25em] text-white/60">
            Bar Indipendenza · Broni (PV)
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="hud-panel flex items-center gap-3 rounded-xl px-[clamp(12px,1.2vw,22px)] py-[clamp(6px,0.6vw,12px)]">
          <span className="text-[clamp(11px,0.85vw,16px)] font-semibold uppercase tracking-[0.2em] text-white/55">
            Corsa
          </span>
          <span className="font-display text-[clamp(24px,2.4vw,48px)] leading-none text-white">
            N° {race}
          </span>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1 text-[clamp(11px,0.8vw,15px)] font-bold uppercase tracking-[0.18em]"
          style={{ background: `${status.color}22`, color: status.color, border: `1px solid ${status.color}55` }}
        >
          <span className="live-dot inline-block h-2 w-2 rounded-full" style={{ background: status.color }} />
          {status.text}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Standings({ snap }: { snap: Snapshot }) {
  const lead = Math.max(...snap.progress);
  const winT = snap.finishOrder.length ? snap.finishTimes[snap.finishOrder[0]] : 0;
  return (
    <div className="hud-panel pointer-events-none absolute right-[clamp(12px,1.6vw,28px)] top-[clamp(110px,10vw,180px)] z-20 w-[clamp(230px,19vw,360px)] overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-display text-[clamp(16px,1.3vw,26px)] uppercase text-white">Classifica</span>
        <span className="flex items-center gap-1.5 text-[clamp(10px,0.75vw,14px)] font-bold uppercase tracking-widest text-[#ff2d55]">
          <span className="live-dot h-2 w-2 rounded-full bg-[#ff2d55]" /> Live
        </span>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {snap.ranking.map((i, pos) => {
          const c = CONTENDERS[i];
          const fin = snap.finishOrder.indexOf(i);
          let right: string;
          if (fin === 0) right = fmtTime(winT);
          else if (fin > 0) right = fmtGap(snap.finishTimes[i] - winT);
          else if (pos === 0) right = `${Math.max(0, Math.round((1 - snap.progress[i]) * RACE_METERS))} m`;
          else right = `-${((lead - snap.progress[i]) * RACE_METERS).toFixed(1).replace(".", ",")} m`;
          return (
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              key={c.id}
              className="flex items-center gap-2 rounded-lg px-2 py-[clamp(4px,0.45vw,9px)]"
              style={{
                background:
                  pos === 0
                    ? `linear-gradient(90deg, ${c.hex}55, ${c.hex}10)`
                    : `linear-gradient(90deg, ${c.hex}22, transparent)`,
              }}
            >
              <span
                className="font-display w-[1.6em] text-center text-[clamp(16px,1.35vw,26px)] leading-none"
                style={{ color: pos < 3 ? MEDAL[pos] : "rgba(255,255,255,.55)" }}
              >
                {pos + 1}°
              </span>
              <NumberTile c={c} size={28} />
              <span className="font-display flex-1 truncate text-[clamp(15px,1.25vw,24px)] uppercase leading-none text-white">
                {c.name}
              </span>
              <span className="font-mono text-[clamp(11px,0.85vw,16px)] tabular-nums text-white/75">
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
    <div className="hud-panel pointer-events-none absolute inset-x-[clamp(12px,1.6vw,28px)] bottom-[clamp(12px,1.6vw,28px)] z-20 mx-auto flex max-w-[1400px] items-center gap-4 rounded-2xl px-[clamp(12px,1.2vw,22px)] py-3">
      <div className="w-[clamp(84px,8vw,150px)] shrink-0 leading-none">
        <div className="text-[clamp(10px,0.75vw,14px)] font-bold uppercase tracking-[0.2em] text-white/50">
          {toGo > 0 ? "Mancano" : "Arrivo"}
        </div>
        <div className="font-display mt-1 text-[clamp(22px,2vw,40px)] tabular-nums text-white">
          {toGo > 0 ? `${toGo} m` : <Flag className="inline h-[1em] w-[1em] text-[#ffd34d]" />}
        </div>
      </div>
      <div className="relative h-[clamp(64px,5.4vw,96px)] flex-1">
        {/* lanes */}
        {CONTENDERS.map((c, i) => (
          <div
            key={c.id}
            className="absolute inset-x-0 h-px"
            style={{ top: `${((i + 0.5) / CONTENDERS.length) * 100}%`, background: `${c.hex}40` }}
          />
        ))}
        {[0.25, 0.5, 0.75].map((m) => (
          <div key={m} className="absolute inset-y-0 w-px bg-white/10" style={{ left: `${m * 100}%` }} />
        ))}
        <div
          className="absolute -right-1 inset-y-0 w-2 rounded-sm"
          style={{
            backgroundImage: "repeating-conic-gradient(#fff 0 25%, #111 0 50%)",
            backgroundSize: "8px 8px",
          }}
        />
        {CONTENDERS.map((c, i) => {
          const p = Math.min(1, snap.progress[i]);
          return (
            <div
              key={c.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left] duration-100 ease-linear"
              style={{ left: `${p * 100}%`, top: `${((i + 0.5) / CONTENDERS.length) * 100}%` }}
            >
              <NumberTile c={c} size={22} className="rounded-full" />
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
    <div className="pointer-events-none absolute inset-x-0 bottom-[clamp(110px,9.5vw,170px)] z-30 flex justify-center px-4">
      <AnimatePresence mode="wait">
        {show && snap.line && (
          <motion.div
            key={snap.lineId}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="hud-panel flex items-center gap-3 rounded-2xl border-l-4 border-l-[#ff2a3c] px-[clamp(14px,1.4vw,28px)] py-[clamp(8px,0.8vw,16px)]"
          >
            <Mic className="h-[clamp(18px,1.6vw,30px)] w-[clamp(18px,1.6vw,30px)] shrink-0 text-[#ff2a3c]" />
            <span className="font-display text-[clamp(20px,2.1vw,42px)] uppercase leading-tight text-white">
              <LineText line={snap.line} />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Countdown({ snap }: { snap: Snapshot }) {
  const n = snap.countdown;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <AnimatePresence>
        {n != null && (
          <motion.div
            key={n}
            initial={{ scale: n === 0 ? 0.4 : 2.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: n === 0 ? 1.8 : 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="font-display absolute select-none text-center uppercase leading-none"
            style={{
              fontSize: n === 4 ? "clamp(56px,8vw,170px)" : n === 0 ? "clamp(120px,17vw,360px)" : "clamp(140px,21vw,440px)",
              color: n === 0 ? "#ffd34d" : "#ffffff",
              textShadow:
                n === 0
                  ? "0 0 60px rgba(255,211,77,.8), 0 10px 0 #b3121f"
                  : "0 0 50px rgba(255,42,60,.8), 0 10px 0 #b3121f",
            }}
          >
            {n === 4 ? "Pronti?" : n === 0 ? "Via!" : n}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PhotoFinish({ snap }: { snap: Snapshot }) {
  return (
    <AnimatePresence>
      {snap.photo && (
        <motion.div
          key="photo"
          className="pointer-events-none absolute inset-0 z-40"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          />
          <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#ff2a3c] shadow-[0_0_20px_#ff2a3c]" />
          <motion.div
            initial={{ scale: 2.4, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.1 }}
            className="font-display absolute left-1/2 top-[11%] -translate-x-1/2 rounded-xl border-[5px] border-[#ff2a3c] bg-black/50 px-6 py-1.5 text-[clamp(40px,5.2vw,110px)] uppercase leading-none text-[#ff2a3c]"
          >
            Fotofinish
          </motion.div>
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
    <div className="pointer-events-none absolute inset-x-0 top-[clamp(90px,9vw,170px)] z-30 flex justify-center">
      <AnimatePresence>
        {show && c && (
          <motion.div
            key="winner"
            initial={{ y: -40, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="hud-panel flex items-center gap-4 rounded-2xl border-2 px-6 py-3"
            style={{ borderColor: "#ffd34d", boxShadow: "0 0 60px rgba(255,211,77,.35)" }}
          >
            <Trophy className="h-[clamp(28px,2.6vw,52px)] w-[clamp(28px,2.6vw,52px)] text-[#ffd34d]" />
            <span className="font-display text-[clamp(28px,3vw,60px)] uppercase leading-none text-white">
              Vince
            </span>
            <NumberTile c={c} size={56} />
            <span className="font-display text-[clamp(28px,3vw,60px)] uppercase leading-none" style={{ color: c.hex }}>
              {c.name}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Paddock({
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
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-[clamp(10px,1vw,20px)] px-[clamp(12px,1.6vw,28px)] pb-[clamp(14px,1.8vw,32px)]"
    >
      <div className="text-center">
        <div className="font-display text-[clamp(30px,3.6vw,72px)] uppercase leading-none text-white [text-shadow:0_4px_30px_rgba(0,0,0,.8)]">
          Scegli il tuo <span className="text-[#ff2a3c]">camparino</span>
        </div>
        <div className="mt-1 text-[clamp(12px,1vw,19px)] font-semibold uppercase tracking-[0.3em] text-white/60">
          Scommesse aperte · tutti hanno la stessa probabilità
        </div>
      </div>

      <div className="grid w-full max-w-[1500px] grid-cols-5 gap-[clamp(6px,0.8vw,16px)]">
        {CONTENDERS.map((c, k) => {
          const wins = tally.wins[c.id] ?? 0;
          return (
            <motion.div
              key={c.id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 * k, type: "spring", stiffness: 300, damping: 26 }}
              className="hud-panel relative flex items-center gap-[clamp(8px,0.8vw,16px)] overflow-hidden rounded-2xl p-[clamp(8px,0.8vw,16px)]"
              style={{ borderColor: `${c.hex}66` }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{ background: `radial-gradient(120% 90% at 0% 0%, ${c.hex}40, transparent 60%)` }}
              />
              <NumberTile c={c} size={64} className="relative" />
              <div className="relative min-w-0">
                <div className="font-display truncate text-[clamp(18px,1.7vw,34px)] uppercase leading-none text-white">
                  {c.name}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[clamp(11px,0.85vw,16px)] font-semibold text-white/65">
                  <Trophy className="h-[1.1em] w-[1.1em]" style={{ color: wins ? "#ffd34d" : undefined }} />
                  {wins === 0 ? "Ancora a secco" : wins === 1 ? "1 vittoria" : `${wins} vittorie`}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-[clamp(10px,1.4vw,28px)]">
        {tally.history.length > 0 && (
          <div className="hud-panel flex items-center gap-2 rounded-full px-4 py-2">
            <span className="text-[clamp(10px,0.8vw,15px)] font-bold uppercase tracking-[0.18em] text-white/55">
              Ultimi vincitori
            </span>
            {tally.history.slice(0, 8).map((id, k) => {
              const c = CONTENDERS.find((x) => x.id === id);
              return c ? <NumberTile key={k} c={c} size={k === 0 ? 30 : 24} /> : null;
            })}
          </div>
        )}
        <button
          onClick={onStart}
          disabled={disabled}
          className="btn-shine font-display pointer-events-auto relative overflow-hidden rounded-full bg-gradient-to-b from-[#ff3b4a] to-[#b3121f] px-[clamp(28px,3vw,64px)] py-[clamp(10px,1vw,20px)] text-[clamp(24px,2.4vw,48px)] uppercase leading-none text-white shadow-[0_0_40px_rgba(255,42,60,.55),inset_0_1px_0_rgba(255,255,255,.4)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-3">
            <Flag className="h-[0.9em] w-[0.9em]" /> Partenza!
          </span>
        </button>
        <div className="text-[clamp(10px,0.8vw,15px)] font-semibold uppercase tracking-[0.2em] text-white/45">
          oppure premi <kbd className="rounded border border-white/25 px-1.5 py-0.5 font-mono">spazio</kbd>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

export function Results({ snap, race, onNext }: { snap: Snapshot; race: number; onNext: () => void }) {
  const order = snap.finishOrder;
  const winT = snap.finishTimes[order[0]];
  const w = CONTENDERS[order[0]];
  const margin = order.length > 1 ? snap.finishTimes[order[1]] - winT : 0;
  return (
    <motion.div
      initial={{ x: 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 28, delay: 0.6 }}
      className="hud-panel absolute bottom-[clamp(12px,1.6vw,28px)] right-[clamp(12px,1.6vw,28px)] top-[clamp(110px,10vw,180px)] z-30 flex w-[clamp(300px,31vw,600px)] flex-col overflow-hidden rounded-3xl"
    >
      <div
        className="relative overflow-hidden px-[clamp(16px,1.6vw,32px)] py-[clamp(14px,1.4vw,28px)]"
        style={{ background: `linear-gradient(135deg, ${w.hex}55, transparent 70%)` }}
      >
        <div className="text-[clamp(11px,0.85vw,16px)] font-bold uppercase tracking-[0.25em] text-white/60">
          Arrivo ufficiale · Corsa N° {race}
        </div>
        <div className="mt-3 flex items-center gap-[clamp(10px,1vw,20px)]">
          <NumberTile c={w} size={84} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[clamp(14px,1.1vw,22px)] font-bold uppercase tracking-[0.2em] text-[#ffd34d]">
              <Trophy className="h-[1.1em] w-[1.1em]" /> Vincitore
            </div>
            <div
              className="font-display truncate text-[clamp(40px,4.4vw,88px)] uppercase leading-[0.95]"
              style={{ color: w.hex, textShadow: `0 0 40px ${w.hex}88` }}
            >
              {w.name}
            </div>
          </div>
        </div>
        <div className="mt-2 text-[clamp(12px,0.95vw,18px)] font-semibold text-white/70">
          Tempo {fmtTime(winT)} ·{" "}
          {margin < 0.13 ? "vinto al fotofinish!" : `distacco ${fmtGap(margin)}`}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-[clamp(4px,0.5vw,10px)] overflow-y-auto px-[clamp(12px,1.2vw,24px)] py-[clamp(10px,1vw,20px)]">
        {order.map((i, pos) => {
          const c = CONTENDERS[i];
          return (
            <motion.div
              key={c.id}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.9 + pos * 0.12 }}
              className="flex items-center gap-3 rounded-xl px-3 py-[clamp(6px,0.6vw,12px)]"
              style={{ background: pos === 0 ? `${c.hex}30` : "rgba(255,255,255,.04)" }}
            >
              <span
                className="font-display w-[1.7em] text-center text-[clamp(20px,1.8vw,36px)] leading-none"
                style={{ color: pos < 3 ? MEDAL[pos] : "rgba(255,255,255,.5)" }}
              >
                {pos + 1}°
              </span>
              <NumberTile c={c} size={36} />
              <span className="font-display flex-1 truncate text-[clamp(18px,1.6vw,32px)] uppercase leading-none text-white">
                {c.name}
              </span>
              <span className="font-mono text-[clamp(12px,1vw,19px)] tabular-nums text-white/75">
                {pos === 0 ? fmtTime(snap.finishTimes[i]) : fmtGap(snap.finishTimes[i] - winT)}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-[clamp(12px,1.2vw,24px)]">
        <button
          onClick={onNext}
          className="btn-shine font-display relative w-full overflow-hidden rounded-full bg-gradient-to-b from-[#ff3b4a] to-[#b3121f] py-[clamp(10px,1vw,20px)] text-[clamp(22px,2vw,40px)] uppercase leading-none text-white shadow-[0_0_40px_rgba(255,42,60,.45),inset_0_1px_0_rgba(255,255,255,.4)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          Prossima corsa →
        </button>
        <div className="mt-2 text-center text-[clamp(10px,0.75vw,14px)] font-semibold uppercase tracking-[0.2em] text-white/40">
          oppure premi <kbd className="rounded border border-white/25 px-1.5 py-0.5 font-mono">spazio</kbd>
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
    "pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white";
  return (
    <div
      className={`hud-panel absolute left-[clamp(12px,1.6vw,28px)] z-40 flex items-center gap-1 rounded-full p-1 transition-opacity duration-500 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      } bottom-[clamp(12px,1.6vw,28px)]`}
    >
      <button className={btn} onClick={onSound} title="Suoni (M)">
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <button className={btn} onClick={onVoice} title="Telecronaca vocale (V)">
        {voice ? <Mic size={18} /> : <MicOff size={18} />}
      </button>
      <button className={btn} onClick={onFullscreen} title="Schermo intero (F)">
        {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
      <button className={btn} onClick={onReset} title="Azzera serata (vittorie e numero corsa)">
        <RotateCcw size={18} />
      </button>
    </div>
  );
}

export function Credit({ side = "right" }: { side?: "left" | "right" }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-[clamp(12px,1.6vw,28px)] z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-xs text-white/60 ${
        side === "right" ? "right-[clamp(12px,1.6vw,28px)]" : "left-[clamp(70px,5vw,96px)]"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-pink-400"
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
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#08030a]"
    >
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
        <Image src={asset("/indi-background.png")} alt="" width={120} height={120} priority />
      </motion.div>
      <div className="font-display text-3xl uppercase text-white">Stiamo raffreddando i Campari…</div>
      <div className="h-2 w-72 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-[#ff2a3c] transition-[width]" style={{ width: `${progress}%` }} />
      </div>
    </motion.div>
  );
}
