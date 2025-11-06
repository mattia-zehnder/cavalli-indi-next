"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

// 3D
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  RoundedBox,
  Html,
  useGLTF,
} from "@react-three/drei";

// Optional shadcn/ui (assumes your project is set up with shadcn)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// --- Utility helpers ---
const clamp = (v: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, v));

// A tiny deterministic PRNG for per-race variability
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Types ---
type Horse = {
  id: number;
  name: string;
  color: string; // tailwind color class for UI chips
  hex: string; // hex color for 3D material
  modelUrl?: string; // optional GLB/GLTF url per horse
};

type RaceStatus = "idle" | "running" | "finished";

// ---------- 3D helpers ----------
const TRACK_LEN = 50; // X length in scene units
const LANE_GAP = 3.2; // Z spacing between lanes
const TRACK_W = 2.4; // width of a lane

function worldXFromProgress(progressPct: number) {
  return -TRACK_LEN / 2 + (progressPct / 100) * TRACK_LEN;
}

function Lane({ index, lanes }: { index: number; lanes: number }) {
  const z = (index - (lanes - 1) / 2) * LANE_GAP;
  return (
    <group position={[0, 0, z]}>
      {/* Lane strip with Campari-inspired colors */}
      <mesh
        receiveShadow
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRACK_LEN + 2, TRACK_W]} />
        <meshStandardMaterial
          color={index % 2 === 0 ? "#1a0a0a" : "#2a1515"}
          emissive={index % 2 === 0 ? "#330000" : "#220000"}
          emissiveIntensity={0.1}
        />
      </mesh>
      {/* Glowing side lines with Campari red */}
      <mesh
        receiveShadow
        position={[0, -0.009, TRACK_W / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRACK_LEN + 2, 0.08]} />
        <meshStandardMaterial
          color="#dc143c"
          emissive="#220000"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh
        receiveShadow
        position={[0, -0.009, -TRACK_W / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRACK_LEN + 2, 0.08]} />
        <meshStandardMaterial
          color="#dc143c"
          emissive="#220000"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

function FinishLine({ lanes }: { lanes: number }) {
  // Checkered line at +X end with Campari branding
  const x = TRACK_LEN / 2;
  return (
    <group position={[x, 0, 0]}>
      {/* Main finish line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.4, (lanes - 1) * LANE_GAP + TRACK_W]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#dc143c"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Sparkling effect posts */}
      <mesh position={[0, 1.5, ((lanes - 1) * LANE_GAP + TRACK_W) / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 3]} />
        <meshStandardMaterial
          color="#dc143c"
          emissive="#dc143c"
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0, 1.5, -((lanes - 1) * LANE_GAP + TRACK_W) / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 3]} />
        <meshStandardMaterial
          color="#dc143c"
          emissive="#dc143c"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

function FallbackHorse({ color = "#ff5555" }: { color?: string }) {
  // Cute stylized capsule-like runner
  return (
    <group>
      <RoundedBox args={[0.9, 0.5, 0.4]} radius={0.12} smoothness={3}>
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </RoundedBox>
      <mesh position={[0.4, 0.25, 0]}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* tiny legs as style */}
      <mesh position={[0.25, -0.25, 0.12]}>
        <boxGeometry args={[0.18, 0.18, 0.08]} />
        <meshStandardMaterial color="#151515" />
      </mesh>
      <mesh position={[0.05, -0.25, -0.12]}>
        <boxGeometry args={[0.18, 0.18, 0.08]} />
        <meshStandardMaterial color="#151515" />
      </mesh>
    </group>
  );
}

function HorseModel({ url, color }: { url?: string; color: string }) {
  // Try to load a GLTF horse if provided, otherwise fallback
  try {
    // useGLTF throws inside Suspense until loaded, which is fine
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const gltf = url ? useGLTF(url) : null;
    if (!gltf) return <FallbackHorse color={color} />;
    return <primitive object={gltf.scene} />;
  } catch {
    return <FallbackHorse color={color} />;
  }
}

function Runner({
  index,
  lanes,
  hex,
  progress,
  name,
  modelUrl,
  hideNameTag = false,
}: {
  index: number;
  lanes: number;
  color: string;
  hex: string;
  progress: number;
  name: string;
  modelUrl?: string;
  hideNameTag?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const baseY = 0.35; // hover a bit
  const z = (index - (lanes - 1) / 2) * LANE_GAP;

  // A little bobbing with more dramatic effect for Campari night
  useFrame(({ clock }) => {
    if (!group.current) return;
    const x = worldXFromProgress(progress);
    const time = clock.getElapsedTime();
    group.current.position.set(
      x,
      baseY + Math.sin(time * 8 + index) * 0.08 + Math.sin(time * 3) * 0.02,
      z
    );
    // Add a slight swaying motion for more drama
    group.current.rotation.y = Math.sin(time * 4 + index) * 0.1;
    group.current.rotation.z = Math.sin(time * 6 + index) * 0.05;
  });

  return (
    <group ref={group}>
      <Suspense
        fallback={
          <Html center className="text-xs text-white">
            caricamento…
          </Html>
        }
      >
        <HorseModel url={modelUrl} color={hex} />
      </Suspense>
      {/* Enhanced name tag with Italian flair */}
      {!hideNameTag && (
        <Html position={[0, 0.8, 0]} distanceFactor={12}>
          <div className="px-3 py-2 rounded-lg border-2 border-red-500/60 bg-gradient-to-r from-red-900/80 to-black/80 text-white text-xs font-bold whitespace-nowrap shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-1">🐎 {name}</div>
          </div>
        </Html>
      )}
      {/* Speed trail effect */}
      <mesh position={[-0.5, 0, 0]}>
        <planeGeometry args={[1, 0.1]} />
        <meshStandardMaterial
          color={hex}
          transparent
          opacity={0.3}
          emissive={hex}
          emissiveIntensity={0.2}
        />
      </mesh>
    </group>
  );
}

function CameraController({ progress }: { progress: number[] }) {
  const { camera } = useThree();
  const initialPositionRef = useRef<[number, number, number]>([-15, 15, 25]);
  const initialTargetRef = useRef<[number, number, number]>([-15, 5, 3]);

  useFrame(() => {
    // Find the lead horse (highest progress)
    const leadIndex = progress.reduce(
      (maxIdx, current, idx) => (current > progress[maxIdx] ? idx : maxIdx),
      0
    );

    const leadProgress = progress[leadIndex];
    const leadX = worldXFromProgress(leadProgress);

    // Calculate the offset from the initial position to the initial target
    const [initX, initY, initZ] = initialPositionRef.current;
    const [initTargetX, initTargetY] = initialTargetRef.current;

    // Maintain the same relative position but follow the lead horse
    const targetX = leadX + (initX - initTargetX);
    const targetY = initY + (initTargetY - initY + 3);
    const targetZ = initZ - 3;

    // Smooth camera movement while maintaining the initial perspective
    camera.position.set(
      camera.position.x + (targetX - camera.position.x) * 0.05,
      camera.position.y + (targetY - camera.position.y - 2) * 0.05,
      camera.position.z + (targetZ - camera.position.z - 6) * 0.05
    );

    // Look at the lead horse while maintaining the initial viewing angle
    camera.lookAt(leadX, 0, 0);
  });

  return null;
}

function Track3D({
  horses,
  progress,
  hideNameTags = false,
}: {
  horses: Horse[];
  progress: number[];
  hideNameTags?: boolean;
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [-15, 15, 25], fov: 45 }}
      className="rounded-xl overflow-hidden"
    >
      {/* Camera follows lead horse */}
      <CameraController progress={progress} />

      {/* Enhanced Campari-themed lighting */}
      <ambientLight intensity={0.4} color="#ff4444" />
      <directionalLight
        position={[12, 15, 8]}
        intensity={1.8}
        color="#ffaa44"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      {/* Dramatic red accent lights */}
      <pointLight position={[-20, 10, 15]} intensity={0.8} color="#dc143c" />
      <pointLight position={[20, 8, -15]} intensity={0.6} color="#ff6b35" />
      <pointLight position={[0, 12, 0]} intensity={1.2} color="#ffffff" />

      {/* Enhanced ground with Campari colors */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
      >
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial
          color="#0a0505"
          emissive="#220000"
          emissiveIntensity={0.1}
          roughness={0.8}
        />
      </mesh>

      {/* lanes */}
      {horses.map((_, i) => (
        <Lane key={i} index={i} lanes={horses.length} />
      ))}

      <FinishLine lanes={horses.length} />

      {/* runners */}
      {horses.map((h, i) => (
        <Runner
          key={h.id}
          index={i}
          lanes={horses.length}
          color={h.color}
          hex={h.hex}
          name={h.name}
          progress={progress[i]}
          modelUrl={h.modelUrl}
          hideNameTag={hideNameTags}
        />
      ))}

      <Environment preset="night" background={false} />
      <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.2} />

      {/* Atmospheric fog for drama */}
      <fog attach="fog" args={["#220000", 30, 100]} />
    </Canvas>
  );
}

// --- Component ---
export default function HorseRacing3DApp() {
  const HORSES: Horse[] = useMemo(
    () => [
      {
        id: 1,
        name: "Campari Shakerato",
        color: "bg-red-600",
        hex: "#dc143c",
        modelUrl: undefined,
      },
      {
        id: 2,
        name: "Campari col bianco",
        color: "bg-orange-500",
        hex: "#ff6b35",
        modelUrl: undefined,
      },
      {
        id: 3,
        name: "Spritz campari",
        color: "bg-green-600",
        hex: "#16a34a",
        modelUrl: undefined,
      },
      {
        id: 4,
        name: "Negroni",
        color: "bg-amber-600",
        hex: "#d97706",
        modelUrl: undefined,
      },
      {
        id: 5,
        name: "Sbagliato",
        color: "bg-pink-500",
        hex: "#ec4899",
        modelUrl: undefined,
      },
      {
        id: 6,
        name: "Camparino",
        color: "bg-purple-600",
        hex: "#9333ea",
        modelUrl: undefined,
      },
    ],
    []
  );

  // State
  const [status, setStatus] = useState<RaceStatus>("idle");
  const [raceNumber, setRaceNumber] = useState(1);
  const [progress, setProgress] = useState<number[]>(() => HORSES.map(() => 0));
  const [finishOrder, setFinishOrder] = useState<number[]>([]); // horse indices in order of finishing
  const [finishTimes, setFinishTimes] = useState<Record<number, number>>({}); // idx -> ms
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Timing refs
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const raceStartRef = useRef<number | null>(null);

  // Per-race speed seeds so each race feels different
  const prng = useMemo(() => mulberry32(raceNumber * 1337), [raceNumber]);
  const baseSpeedsRef = useRef<number[]>(HORSES.map(() => 0));

  // Compute in-race places by current progress (descending)
  // const places = useMemo(() => {
  //   const idxs = progress.map((_, i) => i);
  //   idxs.sort((a, b) => progress[b] - progress[a]);
  //   const placeOf: Record<number, number> = {};
  //   idxs.forEach((idx, i) => (placeOf[idx] = i + 1));
  //   return placeOf; // e.g., places[horseIdx] => 1..N
  // }, [progress]);

  const resetRace = useCallback(() => {
    setProgress(HORSES.map(() => 0));
    setFinishOrder([]);
    setFinishTimes({});
    setStatus("idle");
    setShowLeaderboard(false);
    lastTsRef.current = null;
    raceStartRef.current = null;
    // set per-horse base speeds (units per second). tuned for ~6–9s races
    baseSpeedsRef.current = HORSES.map(() => 10 + prng() * 3); // 10..13
  }, [HORSES, prng]);

  useEffect(() => {
    resetRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceNumber]);

  const stopRAF = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const statusRef = useRef<RaceStatus>("idle");

  // Update refs when state changes
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const tick = useCallback(
    (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      if (raceStartRef.current == null) raceStartRef.current = ts;

      const dt = (ts - lastTsRef.current) / 1000; // seconds
      lastTsRef.current = ts;

      setProgress((prev) => {
        const next = [...prev];
        const newlyFinished: number[] = [];

        for (let i = 0; i < next.length; i++) {
          if (next[i] >= 100) continue;

          // base speed + random jitter; turbo adds stronger randomness bursts
          const base = baseSpeedsRef.current[i];
          const jitter = (prng() - 0.5) * 4; // +-5 or +-2 units/sec
          const speed = Math.max(6, base + jitter); // never too slow

          next[i] = clamp(next[i] + speed * dt);

          if (next[i] >= 100) {
            newlyFinished.push(i);
          }
        }

        if (newlyFinished.length) {
          setFinishOrder((o) => {
            const merged = [...o];
            newlyFinished.forEach((idx) => {
              if (!merged.includes(idx)) merged.push(idx);
            });
            return merged;
          });

          setFinishTimes((ft) => {
            const t = ts - (raceStartRef.current ?? ts);
            const copy = { ...ft };
            newlyFinished.forEach((idx) => {
              if (copy[idx] == null) copy[idx] = t; // ms since race start
            });
            return copy;
          });
        }

        // If all finished, end race
        if (next.every((p) => p >= 100)) {
          setStatus("finished");
          stopRAF();
          setTimeout(() => setShowLeaderboard(true), 500);
        }

        return next;
      });

      if (statusRef.current === "running") {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [prng]
  );

  const startRace = useCallback(() => {
    setStatus("running");
    lastTsRef.current = null;
    raceStartRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const nextRace = useCallback(() => {
    if (statusRef.current === "finished") {
      setRaceNumber((n) => n + 1);
    }
    startRace();
  }, [startRace]);

  useEffect(() => () => stopRAF(), []);

  // Leaderboard sorted by finish order with times
  const leaderboard = useMemo(() => {
    return finishOrder.map((idx) => ({
      idx,
      name: HORSES[idx].name,
      timeMs: finishTimes[idx],
    }));
  }, [finishOrder, finishTimes, HORSES]);

  // UI helpers
  const formatTime = (ms?: number) =>
    ms == null ? "—" : `${(ms / 1000).toFixed(2)}s`;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-red-950 to-black text-white relative overflow-hidden">
      {/* Enhanced Campari-themed background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-20 w-96 h-96 bg-gradient-to-br from-red-500/30 to-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-20 w-80 h-80 bg-gradient-to-br from-orange-400/20 to-yellow-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-60 h-60 bg-gradient-to-br from-pink-500/20 to-red-400/15 rounded-full blur-2xl animate-pulse delay-500"></div>
        <div className="absolute top-1/4 right-1/3 w-40 h-40 bg-gradient-to-br from-amber-400/15 to-orange-300/10 rounded-full blur-xl animate-pulse delay-700"></div>
      </div>

      {/* Animated sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(40)].map((_, i) => {
          // Use deterministic positioning to avoid hydration mismatch
          const left = (i * 37 + 23) % 100; // Deterministic left position
          const top = (i * 53 + 17) % 100; // Deterministic top position
          const delay = (i * 0.3) % 3; // Deterministic delay
          const duration = 2 + (i % 3); // Deterministic duration

          return (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
              }}
            />
          );
        })}
      </div>

      <div className="mx-auto max-w-7xl space-y-8 relative z-10 p-6 mt-8">
        <header className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-row items-center justify-between"
          >
            <Image
              src="/campari-logo.png"
              alt="Campari Logo"
              width={200}
              height={60}
            />
            <h1 className="text-5xl md:text-7xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-red-400 via-orange-300 via-yellow-400 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
                CASINO CAMPARI
              </span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                NIGHT
              </span>
            </h1>
            <Image
              src="/campari-logo.png"
              alt="Campari Logo"
              width={200}
              height={60}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-2"
          >
            <div className="text-2xl font-bold text-orange-100 flex items-center justify-center gap-3">
              🍸 Bar Indipendenza • Broni (PV) 🇮🇹
            </div>
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-400/30 rounded-full backdrop-blur-sm">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>

              <span className="text-lg font-semibold text-red-300">
                Corsa #{raceNumber}
              </span>
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-4"
          >
            {/*             <div className="flex cursor-pointer items-center gap-3 bg-gradient-to-r from-red-800/40 to-orange-800/40 px-6 py-3 rounded-full border border-red-400/40 backdrop-blur-sm hover:from-red-700/50 hover:to-orange-700/50 transition-all">
              <Switch
                id="turbo"
                checked={turboRandom}
                onCheckedChange={setTurboRandom}
              />
              <Label
                htmlFor="turbo"
                className="cursor-pointer text-orange-100 font-semibold flex items-center gap-2"
              >
                🚀 Turbo Campari Mode
              </Label>
            </div> */}

            {status !== "running" ? (
              <Button
                onClick={nextRace}
                className="font-bold text-xl px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 border-2 border-red-400/50 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-200"
              >
                {status === "finished"
                  ? "🍸 NUOVA CORSA! 🍸"
                  : "🏁 INIZIA LA CORSA! 🏁"}
              </Button>
            ) : (
              <div className="px-8 py-4 " />
            )}

            {/*            {status !== "running" && (
              <Button
                variant="secondary"
                onClick={() => setRaceNumber((n) => n + 1)}
                className="font-bold text-lg px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white border-2 border-orange-400/50 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                🍸 Prossima Corsa
              </Button>
            )} */}
          </motion.div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <Card className="bg-gradient-to-br from-slate-800/60 via-red-900/40 to-black/80 border-2 border-red-400/30 shadow-2xl backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-red-600/30 via-orange-600/20 to-red-600/30 border-b border-red-400/20">
              <CardTitle className="text-center">
                <div className="flex items-center justify-center gap-3 text-3xl font-black">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    🏆 LA PISTA DI CAMPARI
                  </span>
                  {status === "running" && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-lg bg-red-600 text-white px-3 py-1 rounded-full font-bold">
                        LIVE
                      </span>
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative w-full h-[500px] rounded-xl overflow-hidden border-2 border-red-400/20">
                <Track3D
                  horses={HORSES}
                  progress={progress}
                  hideNameTags={showLeaderboard}
                />
                {/* Enhanced finish line marker */}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Enhanced Live standings */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <Card className="bg-gradient-to-br from-slate-800/60 via-orange-900/30 to-black/80 border-2 border-orange-400/30 shadow-2xl backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-600/30 via-red-600/20 to-orange-600/30 border-b border-orange-400/20">
              <CardTitle className="text-center">
                <div className="flex items-center justify-center gap-3 text-2xl font-black">
                  <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                    📊 CLASSIFICA LIVE
                  </span>
                  <span className="text-orange-200 text-lg">
                    • Bar Indipendenza
                  </span>
                  {status === "running" && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-ping"></div>
                      <span className="text-sm text-red-300 font-bold">
                        LIVE
                      </span>
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {HORSES.map((_, i) => i)
                  .sort((a, b) => progress[b] - progress[a])
                  .map((idx, pos) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: pos * 0.1 }}
                      className={`relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300 hover:scale-[1.02] ${
                        pos === 0
                          ? "border-yellow-400/60 bg-gradient-to-r from-yellow-900/20 to-orange-900/30"
                          : pos === 1
                          ? "border-gray-400/60 bg-gradient-to-r from-gray-800/20 to-slate-700/30"
                          : pos === 2
                          ? "border-amber-500/60 bg-gradient-to-r from-amber-900/20 to-orange-800/30"
                          : "border-red-400/40 bg-gradient-to-r from-red-800/20 to-red-700/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`text-3xl font-black ${
                              pos === 0
                                ? "text-yellow-400"
                                : pos === 1
                                ? "text-gray-300"
                                : pos === 2
                                ? "text-amber-500"
                                : "text-orange-300"
                            }`}
                          >
                            {pos === 0
                              ? "🥇"
                              : pos === 1
                              ? "🥈"
                              : pos === 2
                              ? "🥉"
                              : `${pos + 1}°`}
                          </div>

                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full ${HORSES[idx].color} shadow-lg`}
                              style={{
                                boxShadow: `0 0 20px ${HORSES[idx].hex}40`,
                              }}
                            ></div>
                            <span className="text-xl font-bold text-white">
                              {HORSES[idx].name}
                            </span>
                            {pos === 0 && progress[idx] > 20 && (
                              <span className="text-2xl animate-bounce">
                                👑
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-3">
                              <div className="relative w-32 h-3 bg-black/50 rounded-full overflow-hidden border border-white/20">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.min(100, progress[idx])}%`,
                                  }}
                                  transition={{ duration: 0.5 }}
                                />
                              </div>
                              <span className="text-lg font-mono text-orange-200 min-w-[4rem]">
                                {progress[idx].toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-sm font-mono text-gray-300 mt-1">
                              {status === "finished"
                                ? formatTime(finishTimes[idx])
                                : "—"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Racing animation effect */}
                      {status === "running" && (
                        <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse"></div>
                      )}
                    </motion.div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Enhanced Leaderboard dialog */}
        <AnimatePresence>
          <Dialog open={showLeaderboard} onOpenChange={setShowLeaderboard}>
            <DialogContent className="bg-gradient-to-br from-slate-900/98 via-red-900/95 to-black/98 border-4 border-yellow-400/60 text-white max-w-2xl backdrop-blur-lg">
              <DialogHeader className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <DialogTitle className="text-4xl font-black">
                    <span className="bg-gradient-to-r from-yellow-400 via-orange-300 to-red-400 bg-clip-text text-transparent drop-shadow-lg">
                      🏆 CAMPARI NIGHT CHAMPIONS! 🏆
                    </span>
                  </DialogTitle>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="space-y-2"
                >
                  <p className="text-xl font-bold text-orange-200">
                    🍸 Bar Indipendenza • Broni (PV) 🇮🇹
                  </p>
                  <div className="text-sm text-gray-300 bg-red-900/30 px-4 py-2 rounded-full border border-red-400/30">
                    Corsa #{raceNumber} - Risultati Ufficiali
                  </div>
                </motion.div>
              </DialogHeader>

              <div className="space-y-4 max-h-90 overflow-y-auto">
                {leaderboard.map((row, i) => (
                  <motion.div
                    key={row.idx}
                    initial={{ opacity: 0, x: -30, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{
                      delay: i * 0.15,
                      type: "spring",
                      stiffness: 100,
                    }}
                    className={`relative overflow-hidden rounded-2xl border-3 p-6 backdrop-blur-sm ${
                      i === 0
                        ? "border-yellow-400 bg-gradient-to-r from-yellow-900/40 to-orange-900/50 shadow-yellow-400/20"
                        : i === 1
                        ? "border-gray-400 bg-gradient-to-r from-gray-800/40 to-slate-700/50 shadow-gray-400/20"
                        : i === 2
                        ? "border-amber-500 bg-gradient-to-r from-amber-900/40 to-orange-800/50 shadow-amber-500/20"
                        : "border-red-500 bg-gradient-to-r from-red-800/40 to-red-700/50 shadow-red-500/20"
                    } shadow-2xl`}
                  >
                    {/* Sparkle effect for winner */}
                    {i === 0 && (
                      <div className="absolute inset-0 pointer-events-none">
                        {[...Array(6)].map((_, sparkle) => (
                          <div
                            key={sparkle}
                            className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping"
                            style={{
                              left: `${20 + sparkle * 15}%`,
                              top: `${10 + sparkle * 10}%`,
                              animationDelay: `${sparkle * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div
                          className={`text-5xl font-black flex items-center gap-2 ${
                            i === 0
                              ? "text-yellow-400"
                              : i === 1
                              ? "text-gray-300"
                              : i === 2
                              ? "text-amber-500"
                              : "text-orange-300"
                          }`}
                        >
                          {i === 0
                            ? "🥇"
                            : i === 1
                            ? "🥈"
                            : i === 2
                            ? "🥉"
                            : `${i + 1}°`}
                          {i === 0 && (
                            <motion.span
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="text-yellow-400"
                            >
                              👑
                            </motion.span>
                          )}
                        </div>
                        <div>
                          <div className="text-2xl font-black text-white">
                            {row.name}
                          </div>
                          {i === 0 && (
                            <div className="text-sm font-bold text-yellow-300">
                              CAMPARI CHAMPION!
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-mono text-orange-100 font-bold">
                          {formatTime(row.timeMs)}
                        </div>
                        <div className="text-sm text-gray-300">
                          {i === 0
                            ? "Tempo vincente"
                            : `+${(
                                (row.timeMs - leaderboard[0].timeMs) /
                                1000
                              ).toFixed(2)}s`}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <DialogFooter className="mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="w-full"
                >
                  <Button
                    onClick={() => setRaceNumber((n) => n + 1)}
                    className="w-full font-black text-xl py-4 bg-gradient-to-r from-red-600 via-orange-600 to-red-600 hover:from-red-500 hover:via-orange-500 hover:to-red-500 border-3 border-red-400/50 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-200"
                  >
                    🍸 PROSSIMA CORSA! 🏁
                  </Button>
                </motion.div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="text-center space-y-4 bg-gradient-to-br from-red-900/30 via-orange-900/20 to-black/40 p-8 rounded-2xl border border-red-400/30 backdrop-blur-sm"
        >
          <div className="text-2xl font-black bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
            🍸 Campari Night Racing Experience
          </div>
          <div className="text-lg text-orange-200 font-semibold">
            Bar Indipendenza • Broni (PV) 🇮🇹
          </div>
          <div className="text-sm text-red-300 bg-red-800/20 p-4 rounded-xl border border-red-400/20">
            <span className="font-semibold">💡 Suggerimento Pro:</span> Attiva
            il{" "}
            <span className="font-bold text-orange-300">
              Turbo Campari Mode
            </span>{" "}
            per corse più emozionanti con sorpassi spettacolari!
          </div>
          <div className="text-sm text-orange-400 italic font-medium bg-gradient-to-r from-orange-900/20 to-red-900/20 p-3 rounded-lg border border-orange-400/20">
            &ldquo;Dove ogni corsa è un aperitivo indimenticabile!&rdquo; 🥂✨
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// (Optional) If you have real models, you can preload them like:
// useGLTF.preload("/models/horse.glb");
