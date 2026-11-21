"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "framer-motion";
import { useProgress } from "@react-three/drei";
import { CONTENDERS } from "@/lib/race/config";
import { RaceEngine } from "@/lib/race/engine";
import { RaceAudio } from "@/lib/race/audio";
import { fillLine } from "@/lib/race/plan";
import { tallyStore } from "@/lib/race/tally";
import {
  Controls,
  Countdown,
  Credit,
  Loading,
  Paddock,
  PhotoFinish,
  Results,
  Standings,
  Ticker,
  TopBar,
  Tracker,
  WinnerBanner,
} from "@/components/race/Hud";

const RaceScene = dynamic(() => import("@/components/race/RaceScene").then((m) => m.RaceScene), {
  ssr: false,
});

const NAMES = CONTENDERS.map((c) => c.name);

export default function CampariRaceNight() {
  const [engine] = useState(() => new RaceEngine(CONTENDERS.length));
  const [audio] = useState(() => new RaceAudio());
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  const tally = useSyncExternalStore(tallyStore.subscribe, tallyStore.get, tallyStore.getServer);
  const [sound, setSound] = useState(true);
  const [voice, setVoice] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);

  // 3D model loading
  const { progress, active } = useProgress();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active && progress >= 100) {
      const id = setTimeout(() => setReady(true), 300);
      return () => clearTimeout(id);
    }
  }, [active, progress]);

  // ?seed=123 replays a specific race (handy for testing)
  useEffect(() => {
    const seed = Number(new URLSearchParams(window.location.search).get("seed"));
    if (seed) engine.newRace(seed);
  }, [engine]);

  useEffect(() => {
    audio.configure({ sound, voice });
  }, [audio, sound, voice]);

  // Race events → sound, voice, tally
  useEffect(
    () =>
      engine.onEvent((e) => {
        switch (e.type) {
          case "countdown":
            audio.countdown(e.n);
            break;
          case "go":
            audio.go();
            break;
          case "beat":
            audio.beat(e.strength);
            break;
          case "photo":
            audio.shutter();
            break;
          case "cross":
            if (e.place === 1) audio.bell();
            break;
          case "line": {
            const urgent = e.line.kind === "win" || e.line.kind === "photo" || e.line.kind === "start";
            audio.say(fillLine(e.line, NAMES), urgent);
            break;
          }
          case "end": {
            audio.fanfare();
            const id = CONTENDERS[e.winner].id;
            tallyStore.update((t) => ({
              ...t,
              wins: { ...t.wins, [id]: (t.wins[id] ?? 0) + 1 },
              history: [id, ...t.history].slice(0, 20),
            }));
            break;
          }
        }
      }),
    [engine, audio],
  );

  const readyRef = useRef(false);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  const start = useCallback(() => {
    if (engine.phase !== "paddock" || !readyRef.current) return;
    audio.unlock();
    audio.bugle();
    engine.start();
  }, [engine, audio]);

  const next = useCallback(() => {
    if (engine.phase !== "finished") return;
    audio.unlock();
    audio.hush();
    tallyStore.update((t) => ({ ...t, race: t.race + 1 }));
    engine.newRace();
  }, [engine, audio]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  const resetNight = useCallback(() => {
    if (!window.confirm("Azzerare la serata? (vittorie e numero corsa ripartono da zero)")) return;
    tallyStore.reset();
    if (engine.phase === "finished") engine.newRace();
  }, [engine]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keyboard: SPACE/ENTER start & next, F fullscreen, M sound, V voice
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "enter") {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        if (engine.phase === "paddock") start();
        else if (engine.phase === "finished") next();
      } else if (k === "f") toggleFullscreen();
      else if (k === "m") setSound((s) => !s);
      else if (k === "v") setVoice((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, start, next, toggleFullscreen]);

  // Hide the cursor and the control bar when the mouse is still (it's on a TV)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const poke = () => {
      setIdle(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), 3000);
    };
    poke();
    window.addEventListener("mousemove", poke);
    window.addEventListener("mousedown", poke);
    return () => {
      window.removeEventListener("mousemove", poke);
      window.removeEventListener("mousedown", poke);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // Keep the screen awake during the night
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    const acquire = () => {
      if (document.visibilityState === "visible" && nav.wakeLock)
        nav.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, []);

  const racing = snap.phase === "running" || snap.phase === "countdown";

  return (
    <main
      className={`relative h-[100svh] w-full overflow-hidden bg-[#08030a] text-white select-none ${
        idle && snap.phase !== "paddock" && snap.phase !== "finished" ? "hide-cursor" : ""
      }`}
    >
      <div className={`absolute inset-0 ${snap.photo ? "canvas-photo" : "canvas-live"}`}>
        <RaceScene engine={engine} />
      </div>

      {/* soft vignette + top shade so the HUD always reads */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(120%_80%_at_50%_40%,transparent_55%,rgba(0,0,0,.55))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[22%] bg-gradient-to-b from-black/75 via-black/35 to-transparent" />

      <TopBar snap={snap} race={tally.race} />

      {snap.phase === "running" && <Standings snap={snap} />}
      {racing && <Tracker snap={snap} />}
      <Ticker snap={snap} />
      <Countdown snap={snap} />
      <WinnerBanner snap={snap} />
      <PhotoFinish snap={snap} />

      <AnimatePresence>
        {snap.phase === "paddock" && (
          <Paddock key={`p${snap.raceId}`} tally={tally} onStart={start} disabled={!ready} />
        )}
        {snap.phase === "finished" && (
          <Results key={`r${snap.raceId}`} snap={snap} race={tally.race} onNext={next} />
        )}
      </AnimatePresence>

      <Controls
        sound={sound}
        voice={voice}
        fullscreen={fullscreen}
        onSound={() => setSound((s) => !s)}
        onVoice={() => setVoice((v) => !v)}
        onFullscreen={toggleFullscreen}
        onReset={resetNight}
        hidden={idle || racing}
      />
      {snap.phase === "paddock" && <Credit side="right" />}
      {snap.phase === "finished" && <Credit side="left" />}

      <AnimatePresence>{!ready && <Loading key="loading" progress={progress} />}</AnimatePresence>
    </main>
  );
}
