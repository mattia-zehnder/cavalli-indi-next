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
  Environment,
  RoundedBox,
  Html,
  useGLTF,
  Stars,
  Sparkles,
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

function Lane({
  index,
  lanes,
  horseColor,
}: {
  index: number;
  lanes: number;
  horseColor: string;
}) {
  const z = (index - (lanes - 1) / 2) * LANE_GAP;
  return (
    <group position={[0, 0, z]}>
      {/* Enhanced lane strip with animated colors */}
      <mesh
        receiveShadow
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRACK_LEN + 2, TRACK_W]} />
        <meshStandardMaterial
          color={index % 2 === 0 ? "#1a0a0a" : "#2a1515"}
          emissive={horseColor}
          emissiveIntensity={0.25}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Animated racing stripes */}
      <mesh
        receiveShadow
        position={[0, -0.008, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRACK_LEN + 2, 0.2]} />
        <meshStandardMaterial
          color={horseColor}
          emissive={horseColor}
          emissiveIntensity={0.6}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Enhanced glowing side lines */}
      <mesh
        receiveShadow
        position={[0, -0.007, TRACK_W / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRACK_LEN + 2, 0.12]} />
        <meshStandardMaterial
          color={horseColor}
          emissive={horseColor}
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh
        receiveShadow
        position={[0, -0.007, -TRACK_W / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRACK_LEN + 2, 0.12]} />
        <meshStandardMaterial
          color={horseColor}
          emissive={horseColor}
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Lane sparkles */}
      <Sparkles
        count={25}
        scale={[TRACK_LEN, 0.5, TRACK_W]}
        size={1}
        speed={1.5}
        color={horseColor}
        position={[0, 0.1, 0]}
      />
    </group>
  );
}

function FinishLine({ lanes }: { lanes: number }) {
  // Enhanced checkered flag pattern with dramatic effects
  const x = TRACK_LEN / 2;
  const trackWidth = (lanes - 1) * LANE_GAP + TRACK_W;
  const checkerSize = 0.4;
  const checkersWide = Math.ceil(trackWidth / checkerSize);
  const checkersLong = 6; // Length of checkered pattern along the track

  return (
    <group position={[x, 0, 0]}>
      {/* Main finish line base with pulsing effect */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[0.4, trackWidth]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#dc143c"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Animated finish line beam */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.1, trackWidth + 2]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Checkered flag pattern - horizontal on the track */}
      {Array.from({ length: checkersLong }, (_, row) =>
        Array.from({ length: checkersWide }, (_, col) => {
          const isBlack = (row + col) % 2 === 0;
          const xPos = (row - checkersLong / 2 + 0.5) * checkerSize;
          const zPos = (col - checkersWide / 2 + 0.5) * checkerSize;

          return (
            <mesh
              key={`checker-${row}-${col}`}
              position={[xPos, 0.002, zPos]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[checkerSize * 0.95, checkerSize * 0.95]} />
              <meshStandardMaterial
                color={isBlack ? "#000000" : "#ffffff"}
                emissive={isBlack ? "#000000" : "#ffffff"}
                emissiveIntensity={0.2}
              />
            </mesh>
          );
        }),
      )}

      {/* Sparkle effects at finish line */}
      <Sparkles
        count={50}
        scale={[2, 2, trackWidth]}
        size={3}
        speed={0.8}
        color="#ffffff"
        position={[0, 1, 0]}
      />

      {/* More colorful sparkles */}
      <Sparkles
        count={30}
        scale={[3, 3, trackWidth]}
        size={4}
        speed={1.2}
        color="#fbbf24"
        position={[0, 1.5, 0]}
      />
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

function HorseModel({ color }: { url?: string; color: string }) {
  // Use Campari model as racing horses, with color tinting
  try {
    const gltf = useGLTF("/campari_soda.glb");

    // Clone the scene to avoid modifying the cached version
    const scene = gltf.scene.clone();

    // Apply color tinting to the model materials and hide tail parts
    scene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        const mesh = child as THREE.Mesh;
        // Clone material to avoid affecting other instances
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => mat.clone());
          mesh.material.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.emissive = new THREE.Color(color);
              mat.emissiveIntensity = 0.3;
            }
          });
        } else {
          mesh.material = mesh.material.clone();
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.emissive = new THREE.Color(color);
            mesh.material.emissiveIntensity = 0.3;
          }
        }
      }
    });

    return <primitive object={scene} scale={[0.9, 0.9, 0.9]} />;
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
  const sparklesRef = useRef<THREE.Group>(null);
  const baseY = 0.9; // hover higher above the track
  const z = (index - (lanes - 1) / 2) * LANE_GAP;

  // Enhanced bobbing and trail effects
  useFrame(({ clock }) => {
    if (!group.current) return;
    const x = worldXFromProgress(progress);
    const time = clock.getElapsedTime();

    // More dramatic movement
    group.current.position.set(
      x,
      baseY +
        Math.sin(time * 12 + index) * 0.15 +
        Math.sin(time * 4) * 0.08 +
        Math.sin(time * 20 + index * 3) * 0.04,
      z,
    );

    // Enhanced rotation effects
    group.current.rotation.y = Math.sin(time * 6 + index) * 0.15;
    group.current.rotation.z = Math.sin(time * 8 + index) * 0.08;
    group.current.rotation.x = Math.sin(time * 10 + index) * 0.05;

    // Speed-based sparkle intensity
    if (sparklesRef.current) {
      const speedFactor = Math.max(0.3, Math.sin(time * 4 + index) + 1);
      sparklesRef.current.scale.setScalar(speedFactor);
    }
  });

  return (
    <group ref={group}>
      {/* Speed trail sparkles */}
      <group ref={sparklesRef} position={[-0.5, 0, 0]}>
        <Sparkles
          count={20}
          scale={[1, 0.5, 0.5]}
          size={2}
          speed={2}
          color={hex}
        />
      </group>

      {/* Additional colorful trail */}
      <Sparkles
        count={15}
        scale={[0.8, 0.8, 0.8]}
        size={1.5}
        speed={1.5}
        color="#ffffff"
        position={[-0.3, 0.2, 0]}
      />

      <Suspense
        fallback={
          <Html center className="text-xs text-white">
            caricamento…
          </Html>
        }
      >
        <HorseModel url={modelUrl} color={hex} />
      </Suspense>

      {/* Enhanced name tag with pulsing effects */}
      {!hideNameTag && (
        <Html position={[0, 0.8, 0]} distanceFactor={12}>
          <div
            className="px-3 py-2 rounded-lg border-2 text-white text-xs font-bold whitespace-nowrap shadow-lg backdrop-blur-sm animate-pulse"
            style={{
              borderColor: `${hex}99`, // 60% opacity
              background: `linear-gradient(45deg, ${hex}CC, ${hex}80, ${hex}CC)`, // Animated gradient
              backgroundSize: "200% 200%",
              animation: "gradientShift 2s ease-in-out infinite",
              boxShadow: `0 0 25px ${hex}60, inset 0 0 10px ${hex}40`,
            }}
          >
            <div className="flex items-center gap-1">🍾 {name} ⚡</div>
          </div>
        </Html>
      )}
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
      0,
    );

    const leadProgress = progress[leadIndex];
    const leadX = worldXFromProgress(leadProgress);

    // Calculate the offset from the initial position to the initial target
    const [initX, initY, initZ] = initialPositionRef.current;
    const [initTargetX, initTargetY] = initialTargetRef.current;

    // Maintain the same relative position but follow the lead horse
    const targetX = leadX + (initX - initTargetX);
    const targetY = initY + (initTargetY - initY + 4);
    const targetZ = initZ - 5;

    // Smooth camera movement while maintaining the initial perspective
    camera.position.set(
      camera.position.x + (targetX - camera.position.x) * 0.05,
      camera.position.y + (targetY - camera.position.y - 2) * 0.05,
      camera.position.z + (targetZ - camera.position.z - 6) * 0.05,
    );

    // Look at the lead horse while maintaining the initial viewing angle
    camera.lookAt(leadX, -2, 0);
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
      camera={{ position: [-15, 15, 25], fov: 40 }}
      className="rounded-xl overflow-hidden"
    >
      {/* Camera follows lead horse */}
      <CameraController progress={progress} />

      {/* Enhanced dramatic lighting system */}
      <ambientLight intensity={0.3} color="#ff4444" />

      {/* Main spotlight following action */}
      <directionalLight
        position={[12, 20, 8]}
        intensity={2.2}
        color="#ffaa44"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />

      {/* Dynamic colored accent lights that pulse */}
      <pointLight position={[-25, 12, 18]} intensity={1.2} color="#dc143c" />
      <pointLight position={[25, 10, -18]} intensity={1.0} color="#ff6b35" />
      <pointLight position={[0, 15, 0]} intensity={1.5} color="#ffffff" />

      {/* Moving spotlight effects */}
      <pointLight position={[-10, 8, 12]} intensity={0.8} color="#fbbf24" />
      <pointLight position={[10, 6, -12]} intensity={0.9} color="#ec4899" />

      {/* Enhanced ground with dramatic Campari colors */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
      >
        <planeGeometry args={[120, 50]} />
        <meshStandardMaterial
          color="#0a0505"
          emissive="#330000"
          emissiveIntensity={0.2}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* Atmospheric stars for night racing */}
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade={true}
        speed={0.5}
      />

      {/* Dramatic sparkles above the track */}
      <Sparkles
        count={100}
        scale={[80, 20, 40]}
        size={5}
        speed={0.6}
        color="#ffffff"
        position={[0, 10, 0]}
      />

      {/* Colored sparkles for atmosphere */}
      <Sparkles
        count={60}
        scale={[60, 15, 30]}
        size={3}
        speed={0.8}
        color="#dc143c"
        position={[0, 8, 0]}
      />

      <Sparkles
        count={40}
        scale={[40, 12, 25]}
        size={4}
        speed={1.0}
        color="#fbbf24"
        position={[0, 12, 0]}
      />

      {/* lanes */}
      {horses.map((horse, i) => (
        <Lane key={i} index={i} lanes={horses.length} horseColor={horse.hex} />
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

      {/* Enhanced dramatic fog */}
      <fog attach="fog" args={["#220000", 20, 80]} />
    </Canvas>
  );
}

// --- Component ---
export default function HorseRacing3DApp() {
  const HORSES: Horse[] = useMemo(
    () => [
      {
        id: 2,
        name: "Negroski",
        color: "bg-red-600",
        hex: "#dc143c",
        modelUrl: undefined,
      },
      {
        id: 3,
        name: "Camparotto",
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
    [],
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
    // set per-horse base speeds (units per second). tuned for ~30s races with tight competition
    baseSpeedsRef.current = HORSES.map(() => 3.6 + prng() * 0.4); // 3.2..3.6 (very close base speeds for tight racing)
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

          // Enhanced randomness for exciting close racing
          const base = baseSpeedsRef.current[i];

          // Reduced random variations to keep horses closer together
          const gentleJitter = (prng() - 0.5) * 1.2; // ±0.6 units/sec (much smaller)

          // Smaller periodic speed bursts for subtle overtaking
          const timeSinceStart = ts - (raceStartRef.current ?? ts);
          const burstCycle = Math.sin(timeSinceStart / 1200 + i * 2) * 0.4; // smaller bursts

          // Gentle momentum changes for realistic but close racing
          const momentum = Math.sin(timeSinceStart / 1000 + i * 1.5) * 0.3;

          // Calculate final speed with reduced variations for tight racing
          const speed = Math.max(
            2.5,
            base + gentleJitter + burstCycle + momentum,
          );

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
    [prng],
  );

  const startRace = useCallback(() => {
    lastTsRef.current = null;
    raceStartRef.current = null;
    rafRef.current = requestAnimationFrame(tick);

    setStatus("running");
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
      {/* Add CSS for gradient animations */}
      <style jsx>{`
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        @keyframes neonPulse {
          0%,
          100% {
            box-shadow:
              0 0 5px currentColor,
              0 0 10px currentColor,
              0 0 15px currentColor;
          }
          50% {
            box-shadow:
              0 0 10px currentColor,
              0 0 20px currentColor,
              0 0 30px currentColor;
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .neon-text {
          animation: neonPulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* Enhanced Campari-themed background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-20 w-96 h-96 bg-gradient-to-br from-red-500/30 to-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-20 w-80 h-80 bg-gradient-to-br from-orange-400/20 to-yellow-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-60 h-60 bg-gradient-to-br from-pink-500/20 to-red-400/15 rounded-full blur-2xl animate-pulse delay-500"></div>
        <div className="absolute top-1/4 right-1/3 w-40 h-40 bg-gradient-to-br from-amber-400/15 to-orange-300/10 rounded-full blur-xl animate-pulse delay-700"></div>

        {/* Additional floating orbs for more flash */}
        <div className="absolute top-20 right-40 w-32 h-32 bg-gradient-to-br from-yellow-400/25 to-red-400/15 rounded-full blur-xl animate-bounce"></div>
        <div className="absolute bottom-32 left-40 w-48 h-48 bg-gradient-to-br from-purple-500/20 to-pink-400/15 rounded-full blur-2xl animate-pulse delay-300"></div>
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

      <div className="mx-auto max-w-7xl space-y-8 relative z-10 p-6 ">
        <header className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            style={{ marginBottom: "-1rem" }}
            className="flex flex-row items-center justify-between"
          >
            <Image
              src="/indi-background.png"
              alt="Campari Logo"
              width={160}
              height={40}
            />
            <div className="relative transform scale-85 origin-top">
              <h1 className="text-5xl md:text-8xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-red-400 via-orange-300 via-yellow-400 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
                  CASINO CAMPARI
                </span>
                <br />
                <span className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                  NIGHT
                </span>
              </h1>

              {/* Sparkle animations around the text */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => {
                  // Create deterministic positions and animations
                  const x = (i * 47 + 31) % 100; // Random X position
                  const y = (i * 23 + 10) % 100; // Random Y position
                  const delay = (i * 0.4) % 3; // Animation delay
                  const duration = 1.5 + (i % 3) * 0.5; // Animation duration
                  const size =
                    i % 3 === 0
                      ? "w-3 h-3"
                      : i % 3 === 1
                        ? "w-2 h-2"
                        : "w-1 h-1";
                  const sparkleType = i % 4;

                  return (
                    <motion.div
                      key={i}
                      className={`absolute ${size}`}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                      }}
                      initial={{
                        opacity: 0,
                        scale: 0,
                        rotate: 0,
                      }}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        scale: [0, 1, 1.2, 0],
                        rotate: [0, 180, 360],
                      }}
                      transition={{
                        duration: duration,
                        delay: delay,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      {sparkleType === 0 && (
                        <div
                          className="w-full h-full bg-yellow-300 rounded-full shadow-lg"
                          style={{ boxShadow: "0 0 10px #fbbf24" }}
                        />
                      )}
                      {sparkleType === 2 && (
                        <div
                          className="w-full h-full bg-red-400 transform rotate-45 shadow-lg"
                          style={{ boxShadow: "0 0 8px #f87171" }}
                        />
                      )}
                      {sparkleType === 3 && (
                        <div className="relative w-full h-full">
                          <div className="absolute top-0 left-1/2 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-orange-400 transform -translate-x-1/2" />
                          <div className="absolute bottom-0 left-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-orange-400 transform -translate-x-1/2" />
                          <div className="absolute left-0 top-1/2 w-0 h-0 border-t-2 border-b-2 border-r-2 border-transparent border-r-orange-400 transform -translate-y-1/2" />
                          <div className="absolute right-0 top-1/2 w-0 h-0 border-t-2 border-b-2 border-l-2 border-transparent border-l-orange-400 transform -translate-y-1/2" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Additional floating sparkles that move across the text */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={`floating-${i}`}
                    className="absolute"
                    initial={{
                      x: -20,
                      y: (i * 25) % 100,
                      opacity: 0,
                    }}
                    animate={{
                      x: "calc(100% + 20px)",
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 4 + i * 0.5,
                      delay: i * 0.8,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <div
                      className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full shadow-lg"
                      style={{
                        boxShadow: "0 0 12px rgba(251, 191, 36, 0.8)",
                      }}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Pulsing glow effect behind text */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-orange-400/20 to-yellow-400/20 blur-2xl -z-10"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
            <Image
              src="/indi-background.png"
              alt="Campari Logo"
              width={160}
              height={40}
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
                className="font-bold text-xl px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 border-2 border-red-400/50 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-200 neon-text relative overflow-hidden"
                style={{
                  boxShadow: "0 0 20px #dc143c80, inset 0 0 20px #ff6b3580",
                }}
              >
                {/* Animated shine effect */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
                  style={{
                    transform: "translateX(-100%)",
                    animation: "shimmer 2s infinite",
                  }}
                />

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 3D Track - Takes up 2/3 of the space */}
            <div className="lg:col-span-2">
              <Card className="bg-gradient-to-br from-slate-800/60 via-red-900/40 to-black/80 border-2 border-red-400/30 shadow-2xl backdrop-blur-sm">
                <CardHeader
                  style={{
                    background:
                      "linear-gradient(135deg, #4c1d1d 0%, #5c1f1f 25%, #6b2626 50%, #5c1f1f 75%, #4c1d1d 100%)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 3px rgba(0,0,0,0.3)",
                    paddingBottom: 0,
                  }}
                  className="border-b border-red-400/20 relative overflow-hidden"
                >
                  {/* Subtle animated overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-400/5 to-transparent opacity-20 animate-pulse"></div>
                  <CardTitle className="text-center relative z-10">
                    <div className="flex items-center justify-center gap-3 text-3xl font-black">
                      <span className="bg-gradient-to-r from-red-400 via-orange-300 via-yellow-400 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
                        🏁 LA PISTA 🏁
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative w-full h-[400px] rounded-xl overflow-hidden border-2 border-red-400/20">
                    <Track3D
                      horses={HORSES}
                      progress={progress}
                      hideNameTags={showLeaderboard}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Leaderboard - Takes up 1/3 of the space */}
            <div className="lg:col-span-1">
              <Card className="bg-gradient-to-br from-slate-800/60 via-orange-900/30 to-black/80 border-2 border-orange-400/30 shadow-2xl backdrop-blur-sm h-full">
                <CardHeader
                  style={{
                    background:
                      "linear-gradient(135deg, #6b3810 0%, #7c2d12 25%, #8b4513 50%, #7c2d12 75%, #6b3810 100%)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 3px rgba(0,0,0,0.3)",
                    paddingBottom: 0,
                    paddingTop: 8,
                  }}
                  className="border-b border-orange-400/20 relative overflow-hidden"
                >
                  {/* Animated shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/5 to-transparent opacity-25 animate-pulse"></div>
                  <CardTitle className="text-center relative z-10">
                    <div className="flex flex-col items-center gap-2 text-xl font-black">
                      <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                        <span style={{ color: "#fbbf24" }}>📊</span> CLASSIFICA
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
                <CardContent className="px-4">
                  <div className="space-y-3">
                    {HORSES.map((_, i) => i)
                      .sort((a, b) =>
                        status === "running"
                          ? progress[b] - progress[a]
                          : finishOrder.indexOf(a) - finishOrder.indexOf(b),
                      )
                      .map((idx, pos) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: pos * 0.1 }}
                          className="relative overflow-hidden rounded-lg border-2 p-3 transition-all duration-300"
                          style={{
                            borderColor:
                              pos === 0
                                ? "#fbbf24" // gold
                                : pos === 1
                                  ? "#9ca3af" // silver
                                  : pos === 2
                                    ? "#d97706" // bronze
                                    : `${HORSES[idx].hex}60`, // horse color with opacity
                            background: `linear-gradient(to right, ${HORSES[idx].hex}20, ${HORSES[idx].hex}10)`,
                            boxShadow:
                              pos < 3
                                ? `0 0 15px ${
                                    pos === 0
                                      ? "#fbbf24"
                                      : pos === 1
                                        ? "#9ca3af"
                                        : "#d97706"
                                  }40`
                                : `0 0 10px ${HORSES[idx].hex}20`,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`text-lg font-black ${
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

                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full ${HORSES[idx].color} shadow-lg`}
                                    style={{
                                      boxShadow: `0 0 10px ${HORSES[idx].hex}40`,
                                    }}
                                  ></div>
                                  <span className="text-sm font-bold text-white truncate">
                                    {HORSES[idx].name}
                                  </span>
                                </div>
                                <div className="text-xs font-mono text-gray-300">
                                  {status === "finished"
                                    ? formatTime(finishTimes[idx])
                                    : "—"}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <div className="relative w-16 h-2 bg-black/50 rounded-full overflow-hidden border border-white/20">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400 rounded-full relative"
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.min(100, progress[idx])}%`,
                                  }}
                                  transition={{ duration: 0.5 }}
                                  style={{
                                    boxShadow: `0 0 8px ${HORSES[idx].hex}80`,
                                  }}
                                >
                                  {/* Animated progress glow */}
                                  <div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse"
                                    style={{
                                      background: `linear-gradient(90deg, transparent, ${HORSES[idx].hex}AA, transparent)`,
                                    }}
                                  />
                                </motion.div>
                              </div>
                              <span className="text-xs font-mono text-orange-200">
                                {progress[idx].toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Racing animation effect */}
                          {status === "running" && (
                            <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse"></div>
                          )}
                        </motion.div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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
                    className="relative overflow-hidden rounded-2xl border-3 p-6 backdrop-blur-sm shadow-2xl"
                    style={{
                      borderColor:
                        i === 0
                          ? "#fbbf24" // gold
                          : i === 1
                            ? "#9ca3af" // silver
                            : i === 2
                              ? "#d97706" // bronze
                              : `${HORSES[row.idx].hex}80`, // horse color with opacity
                      background: `linear-gradient(to right, ${
                        HORSES[row.idx].hex
                      }30, ${HORSES[row.idx].hex}15)`,
                      boxShadow:
                        i < 3
                          ? `0 0 25px ${
                              i === 0
                                ? "#fbbf24"
                                : i === 1
                                  ? "#9ca3af"
                                  : "#d97706"
                            }60`
                          : `0 0 15px ${HORSES[row.idx].hex}30`,
                    }}
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
                    onClick={() => {
                      setRaceNumber((n) => n + 1);
                    }}
                    className="w-full font-black text-xl py-4 bg-gradient-to-r from-red-600 via-orange-600 to-red-600 hover:from-red-500 hover:via-orange-500 hover:to-red-500 border-3 border-red-400/50 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-200"
                  >
                    🍸 PROSSIMA CORSA! 🏁
                  </Button>
                </motion.div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </AnimatePresence>
      </div>

      {/* Subtle watermark credit */}
      <div className="fixed bottom-4 right-4 z-20 opacity-60 hover:opacity-100 transition-opacity duration-300">
        <div className="text-xs text-neutral-100 flex items-center gap-1 px-3 py-2 bg-black/30 backdrop-blur-sm border border-gray-600/20 rounded-full">
          <span className="text-pink-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
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
          </span>
          <span>@cerestiamosotto</span>
        </div>
      </div>
    </div>
  );
}

// Preload the Campari model for better performance
useGLTF.preload("/campari_soda.glb");

// (Optional) If you have real models, you can preload them like:
// useGLTF.preload("/models/horse.glb");
