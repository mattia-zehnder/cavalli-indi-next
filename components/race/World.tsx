"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  CONTENDERS,
  FINISH_X,
  LANE_GAP,
  PODIUM_X,
  RACE_METERS,
  START_X,
  TRACK_LEN,
  laneZ,
  trackHalfWidth,
} from "@/lib/race/config";
import type { RaceEngine } from "@/lib/race/engine";
import { mulberry32 } from "@/lib/race/plan";
import { asset } from "@/lib/asset";
import {
  checkerTexture,
  laneNumberTexture,
  markerTexture,
  neonTexture,
  numberPlateTexture,
} from "./textures";

const LANES = CONTENDERS.length;
const HALF = trackHalfWidth(LANES);
const TRACK_FROM = START_X - 14;
const TRACK_TO = PODIUM_X + 14;

const easeOutBack = (x: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export function Ground() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[10, -0.03, 0]}>
        <planeGeometry args={[420, 220]} />
        <meshStandardMaterial color="#0b0507" roughness={0.95} />
      </mesh>
      {/* track surface */}
      <mesh rotation-x={-Math.PI / 2} position={[(TRACK_FROM + TRACK_TO) / 2, -0.01, 0]}>
        <planeGeometry args={[TRACK_TO - TRACK_FROM, HALF * 2]} />
        <meshStandardMaterial color="#1c0b0f" roughness={0.42} metalness={0.25} envMapIntensity={0.6} />
      </mesh>
      {/* outer neon edges */}
      {[-1, 1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[(TRACK_FROM + TRACK_TO) / 2, 0.0, s * HALF]}>
          <planeGeometry args={[TRACK_TO - TRACK_FROM, 0.1]} />
          <meshBasicMaterial color={new THREE.Color("#ff2a3c").multiplyScalar(2.2)} toneMapped={false} />
        </mesh>
      ))}
      {/* lane dividers */}
      {Array.from({ length: LANES - 1 }, (_, k) => {
        const z = laneZ(k, LANES) + LANE_GAP / 2;
        return (
          <mesh key={k} rotation-x={-Math.PI / 2} position={[(START_X + FINISH_X) / 2 + 2, 0.002, z]}>
            <planeGeometry args={[TRACK_LEN + 6, 0.05]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.28} />
          </mesh>
        );
      })}
      {/* coloured lane tint + painted numbers */}
      {CONTENDERS.map((c, i) => (
        <LaneDecor key={c.id} lane={i} hex={c.hex} num={c.number} />
      ))}
    </group>
  );
}

function LaneDecor({ lane, hex, num }: { lane: number; hex: string; num: number }) {
  const tex = useMemo(() => laneNumberTexture(num, hex), [num, hex]);
  const z = laneZ(lane, LANES);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[(START_X + FINISH_X) / 2, 0.001, z]}>
        <planeGeometry args={[TRACK_LEN, LANE_GAP - 0.1]} />
        <meshBasicMaterial color={hex} transparent opacity={0.018} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} rotation-z={-Math.PI / 2} position={[START_X + 3.2, 0.004, z]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

export function FinishLine() {
  const tex = useMemo(() => checkerTexture(4, 30), []);
  return (
    <group position={[FINISH_X, 0, 0]}>
      <mesh rotation-x={-Math.PI / 2} position={[0.6, 0.004, 0]}>
        <planeGeometry args={[1.2, HALF * 2]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
        <planeGeometry args={[0.09, HALF * 2]} />
        <meshBasicMaterial color={new THREE.Color("#ffffff").multiplyScalar(3)} toneMapped={false} />
      </mesh>
      {/* winning post, far side (seen behind the runners in the photo) */}
      <group position={[0, 0, -HALF - 0.55]}>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 10]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
        <mesh position={[0, 2.5, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.42, 0.42, 0.06, 32]} />
          <meshStandardMaterial color="#e11d2e" emissive="#e11d2e" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 2.5, 0.035]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.18, 0.18, 0.01, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      <FinishTower />
    </group>
  );
}

function FinishTower() {
  const sign = useMemo(() => neonTexture("TRAGUARDO", "#ffffff", 1024, 220), []);
  const checker = useMemo(() => {
    const t = checkerTexture(24, 2);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, []);
  const z = -HALF - 1.4;
  return (
    <group position={[0, 0, z]}>
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} position={[x, 2.2, 0]}>
          <boxGeometry args={[0.22, 4.4, 0.22]} />
          <meshStandardMaterial color="#d6d6d6" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 4.5, 0]}>
        <boxGeometry args={[4.2, 1.3, 0.2]} />
        <meshStandardMaterial color="#0c0507" />
      </mesh>
      <mesh position={[0, 4.5, 0.11]}>
        <planeGeometry args={[4, 1]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} color={[1.6, 1.6, 1.6]} />
      </mesh>
      <mesh position={[0, 5.25, 0.11]}>
        <planeGeometry args={[4.2, 0.25]} />
        <meshBasicMaterial map={checker} />
      </mesh>
      <mesh position={[0, 3.75, 0.11]}>
        <planeGeometry args={[4.2, 0.25]} />
        <meshBasicMaterial map={checker} />
      </mesh>
    </group>
  );
}

const dummy = new THREE.Object3D();

export function Rails() {
  const posts = useRef<THREE.InstancedMesh>(null);
  const spacing = 2;
  const xs = useMemo(() => {
    const a: number[] = [];
    for (let x = TRACK_FROM + 2; x <= TRACK_TO - 2; x += spacing) a.push(x);
    return a;
  }, []);
  useEffect(() => {
    const m = posts.current;
    if (!m) return;
    let i = 0;
    for (const s of [-1, 1])
      for (const x of xs) {
        dummy.position.set(x, 0.45, s * (HALF + 0.35));
        dummy.updateMatrix();
        m.setMatrixAt(i++, dummy.matrix);
      }
    m.instanceMatrix.needsUpdate = true;
  }, [xs]);
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, xs.length * 2]}>
        <boxGeometry args={[0.07, 0.9, 0.07]} />
        <meshStandardMaterial color="#e9e9e9" roughness={0.4} />
      </instancedMesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(TRACK_FROM + TRACK_TO) / 2, 0.92, s * (HALF + 0.35)]}>
          <boxGeometry args={[TRACK_TO - TRACK_FROM - 3, 0.1, 0.14]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.25} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export function DistanceMarkers() {
  const marks = [600, 400, 200, 100];
  return (
    <group>
      {marks.map((m) => (
        <Marker key={m} metersToGo={m} />
      ))}
    </group>
  );
}

function Marker({ metersToGo }: { metersToGo: number }) {
  const tex = useMemo(
    () => markerTexture(String(metersToGo), metersToGo <= 100 ? "#e11d2e" : "#1f1f1f"),
    [metersToGo],
  );
  const x = FINISH_X - (metersToGo / RACE_METERS) * TRACK_LEN;
  return (
    <group position={[x, 0, HALF + 0.9]}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 8]} />
        <meshStandardMaterial color="#e5e5e5" />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <planeGeometry args={[1.1, 0.7]} />
        <meshBasicMaterial map={tex} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Starting stalls with front doors that spring open at "VIA!". */
export function StartingGate({ engine }: { engine: RaceEngine }) {
  const doors = useRef<(THREE.Group | null)[]>([]);
  const frontX = START_X + 0.8;
  const backX = START_X - 1.2;
  const width = LANES * LANE_GAP;
  const boundaries = Array.from({ length: LANES + 1 }, (_, k) => -width / 2 + k * LANE_GAP);
  const doorW = LANE_GAP / 2 - 0.1;
  const plates = useMemo(() => CONTENDERS.map((c) => numberPlateTexture(c.number, c.hex)), []);

  useFrame(() => {
    const open =
      engine.phase === "running" || engine.phase === "finished"
        ? easeOutBack(Math.min(1, Math.max(0, engine.t / 0.35)))
        : 0;
    doors.current.forEach((d, k) => {
      if (!d) return;
      const side = k % 2 === 0 ? 1 : -1;
      d.rotation.y = side * open * 1.75;
    });
  });

  const metal = (
    <meshStandardMaterial color="#d9d9de" metalness={0.7} roughness={0.28} />
  );

  return (
    <group>
      {/* posts */}
      {boundaries.map((z) =>
        [frontX, backX].map((x) => (
          <mesh key={`${z}-${x}`} position={[x, 1.35, z]}>
            <boxGeometry args={[0.14, 2.7, 0.14]} />
            {metal}
          </mesh>
        )),
      )}
      {/* stall partitions */}
      {boundaries.map((z) => (
        <mesh key={`p${z}`} position={[(frontX + backX) / 2, 1.0, z]}>
          <boxGeometry args={[frontX - backX, 1.3, 0.05]} />
          <meshStandardMaterial color="#2a1216" metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
      {/* top beams */}
      {[frontX, backX].map((x) => (
        <mesh key={`b${x}`} position={[x, 2.72, 0]}>
          <boxGeometry args={[0.2, 0.2, width + 0.2]} />
          {metal}
        </mesh>
      ))}
      <mesh position={[(frontX + backX) / 2, 2.85, 0]}>
        <boxGeometry args={[frontX - backX + 0.2, 0.08, width + 0.2]} />
        {metal}
      </mesh>
      {/* header with numbers */}
      <mesh position={[frontX + 0.02, 3.25, 0]}>
        <boxGeometry args={[0.12, 0.8, width + 0.2]} />
        <meshStandardMaterial color="#b3121f" metalness={0.4} roughness={0.4} />
      </mesh>
      {CONTENDERS.map((c, i) => (
        <mesh key={c.id} position={[frontX + 0.09, 3.25, laneZ(i, LANES)]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[0.66, 0.66]} />
          <meshBasicMaterial map={plates[i]} toneMapped={false} />
        </mesh>
      ))}
      {/* doors */}
      {CONTENDERS.map((c, i) => {
        const zc = laneZ(i, LANES);
        return [1, -1].map((s, j) => {
          const hingeZ = zc - s * (LANE_GAP / 2 - 0.08);
          return (
            <group
              key={`${c.id}-${s}`}
              position={[frontX, 0, hingeZ]}
              ref={(el) => {
                doors.current[i * 2 + j] = el;
              }}
            >
              <group position={[0, 0, s * (doorW / 2)]}>
                {/* frame */}
                <mesh position={[0, 1.55, 0]}>
                  <boxGeometry args={[0.06, 0.07, doorW]} />
                  <meshStandardMaterial color="#e11d2e" metalness={0.5} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.45, 0]}>
                  <boxGeometry args={[0.06, 0.07, doorW]} />
                  <meshStandardMaterial color="#e11d2e" metalness={0.5} roughness={0.35} />
                </mesh>
                <mesh position={[0, 1.0, s * (doorW / 2 - 0.03)]}>
                  <boxGeometry args={[0.06, 1.17, 0.06]} />
                  <meshStandardMaterial color="#e11d2e" metalness={0.5} roughness={0.35} />
                </mesh>
                {/* see-through panel */}
                <mesh position={[0, 1.0, 0]}>
                  <boxGeometry args={[0.02, 1.08, doorW - 0.04]} />
                  <meshStandardMaterial color={c.hex} transparent opacity={0.22} depthWrite={false} />
                </mesh>
              </group>
            </group>
          );
        });
      })}
    </group>
  );
}

const ROWS = 6;
const COUNT = ROWS * 190;
const standFrom = TRACK_FROM - 24;
const standTo = TRACK_TO + 14;
const tierZ = (k: number) => -HALF - 4.6 - k * 1.05;
const tierTop = (k: number) => 0.45 + k * 0.6;
const POLE_GAP = 12;
const lightsZ = -HALF - 3.4;

/** Grandstand behind the far rail: cheering crowd, festival lights, neon signs. */
export function Backdrop({ engine }: { engine: RaceEngine }) {
  const crowd = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);

  // fixed seat positions + shirt colours (deterministic)
  const people = useMemo(() => {
    const rnd = mulberry32(7);
    const shirts = ["#7a1f2b", "#d9d2c5", "#2b3a55", "#a33a2a", "#3d3d3d", "#c78a3b", "#5b2a4e", "#e8e1d4", "#1f4d3a"];
    return Array.from({ length: COUNT }, (_, i) => {
      const row = i % ROWS;
      return {
        x: standFrom + rnd() * (standTo - standFrom),
        y: tierTop(row) + 0.34,
        z: tierZ(row) + (rnd() - 0.5) * 0.3,
        s: 0.85 + rnd() * 0.3,
        phase: rnd() * Math.PI * 2,
        freq: 5 + rnd() * 4,
        color: new THREE.Color(shirts[Math.floor(rnd() * shirts.length)]).multiplyScalar(0.55 + rnd() * 0.5),
      };
    });
  }, []);

  // festival lights ("luminarie") hanging between poles
  const bulbPos = useMemo(() => {
    const a: { x: number; y: number }[] = [];
    for (let x = standFrom; x <= standTo; x += 0.75) {
      const u = ((x - standFrom) % POLE_GAP) / POLE_GAP;
      a.push({ x, y: 4.3 - 0.7 * (1 - Math.pow(2 * u - 1, 2)) });
    }
    return a;
  }, []);
  const poles = useMemo(() => {
    const a: number[] = [];
    for (let x = standFrom; x <= standTo; x += POLE_GAP) a.push(x);
    return a;
  }, []);

  useEffect(() => {
    const m = crowd.current;
    if (m) people.forEach((p, i) => m.setColorAt(i, p.color));
    const h = heads.current;
    if (h) {
      const skins = ["#e8b896", "#c68e6a", "#f1c9a5", "#8d5a3c", "#d9a47e"].map((c) => new THREE.Color(c));
      people.forEach((_, i) => h.setColorAt(i, skins[i % skins.length]));
    }
    const b = bulbs.current;
    if (b) {
      bulbPos.forEach((p, i) => {
        dummy.position.set(p.x, p.y, lightsZ);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
      });
      b.instanceMatrix.needsUpdate = true;
    }
  }, [people, bulbPos]);

  const tmp = useMemo(() => new THREE.Color(), []);
  const flashes = useRef<{ i: number; t: number }[]>([]);
  const excite = useRef(0.3);
  const bulbColors = useMemo(
    () => ["#ffd27a", "#ff5a5a", "#ffe9b0", "#ff9f40"].map((c) => new THREE.Color(c)),
    [],
  );

  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime;
    const lead = Math.max(...engine.progress);
    const target =
      engine.phase === "paddock"
        ? 0.15
        : engine.phase === "countdown"
          ? 0.35
          : engine.phase === "finished"
            ? 0.7
            : 0.3 + 0.7 * Math.min(1, Math.max(0, (lead - 0.5) / 0.45));
    excite.current += (target - excite.current) * (1 - Math.exp(-dt * 2));
    const ex = excite.current;

    const m = crowd.current;
    if (m) {
      for (let i = 0; i < COUNT; i++) {
        const p = people[i];
        const jump = Math.max(0, Math.sin(time * p.freq + p.phase)) * 0.28 * ex;
        dummy.position.set(p.x, p.y + jump, p.z);
        dummy.scale.set(p.s, p.s, p.s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        if (heads.current) {
          dummy.position.y += 0.42 * p.s;
          dummy.updateMatrix();
          heads.current.setMatrixAt(i, dummy.matrix);
        }
      }
      m.instanceMatrix.needsUpdate = true;
      if (heads.current) heads.current.instanceMatrix.needsUpdate = true;

      // phone camera flashes, more of them when it gets exciting
      if (Math.random() < 0.2 + ex * 0.9) flashes.current.push({ i: Math.floor(Math.random() * COUNT), t: 0.09 });
      flashes.current = flashes.current.filter((f) => {
        f.t -= dt;
        m.setColorAt(f.i, f.t > 0 ? tmp.setRGB(6, 6, 6) : people[f.i].color);
        return f.t > 0;
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    const b = bulbs.current;
    if (b) {
      bulbPos.forEach((_, i) => {
        const chase = 0.55 + 0.45 * Math.sin(time * 3 - i * 0.35);
        tmp.copy(bulbColors[i % bulbColors.length]).multiplyScalar(1.2 + 2.2 * chase);
        b.setColorAt(i, tmp);
      });
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
    }
  });

  const signs = useMemo(
    () => [
      neonTexture("CASINO CAMPARI NIGHT", "#ff2a3c"),
      neonTexture("BAR INDIPENDENZA · BRONI", "#ffb347"),
    ],
    [],
  );
  const star = useLoader(THREE.TextureLoader, asset("/indi-background.png"));
  const signZ = tierZ(ROWS - 1) - 1.4;
  const signXs = [-66, -24, 18, 60, 102];

  return (
    <group>
      {/* grass strip between the far rail and the stand */}
      <mesh rotation-x={-Math.PI / 2} position={[(standFrom + standTo) / 2, -0.005, -HALF - 2.4]}>
        <planeGeometry args={[standTo - standFrom, 3.4]} />
        <meshStandardMaterial color="#0f1a10" roughness={1} />
      </mesh>
      {/* tiers */}
      {Array.from({ length: ROWS }, (_, k) => (
        <mesh key={k} position={[(standFrom + standTo) / 2, tierTop(k) / 2, tierZ(k)]}>
          <boxGeometry args={[standTo - standFrom, tierTop(k), 1.05]} />
          <meshStandardMaterial color={k % 2 ? "#1d0b10" : "#24101a"} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[(standFrom + standTo) / 2, tierTop(0) + 0.01, tierZ(0) + 0.53]}>
        <boxGeometry args={[standTo - standFrom, 0.05, 0.05]} />
        <meshBasicMaterial color={new THREE.Color("#ff2a3c").multiplyScalar(3)} toneMapped={false} />
      </mesh>
      {/* back wall */}
      <mesh position={[(standFrom + standTo) / 2, 3.2, signZ - 0.4]}>
        <boxGeometry args={[standTo - standFrom, 6.4, 0.3]} />
        <meshStandardMaterial color="#140709" roughness={0.95} />
      </mesh>
      {/* crowd */}
      <instancedMesh ref={crowd} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <capsuleGeometry args={[0.19, 0.28, 3, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      {/* festival lights */}
      {poles.map((x) => (
        <mesh key={x} position={[x, 2.25, lightsZ]}>
          <cylinderGeometry args={[0.05, 0.05, 4.5, 6]} />
          <meshStandardMaterial color="#3a2a2a" />
        </mesh>
      ))}
      <instancedMesh ref={bulbs} args={[undefined, undefined, bulbPos.length]} frustumCulled={false}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* neon signs on the back wall */}
      {signXs.map((x, k) =>
        k % 2 === 0 ? (
          <mesh key={x} position={[x, 4.7, signZ]}>
            <planeGeometry args={[16, 2]} />
            <meshBasicMaterial
              map={signs[(k / 2) % 2]}
              transparent
              toneMapped={false}
              color={[1.15, 1.15, 1.15]}
              fog={false}
            />
          </mesh>
        ) : (
          <mesh key={x} position={[x, 4.7, signZ]}>
            <planeGeometry args={[3.4, 3.4]} />
            <meshBasicMaterial
              map={star}
              map-colorSpace={THREE.SRGBColorSpace}
              transparent
              toneMapped={false}
              color={[1.6, 1.6, 1.6]}
              fog={false}
            />
          </mesh>
        ),
      )}
    </group>
  );
}

/** Podium beyond the finish line, revealed at the end of the race. */
export const PODIUM_SLOTS = [
  { x: PODIUM_X, h: 1.4 }, // 1st
  { x: PODIUM_X - 2.3, h: 0.95 }, // 2nd
  { x: PODIUM_X + 2.3, h: 0.6 }, // 3rd
];

export function Podium({ engine }: { engine: RaceEngine }) {
  const spot = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(PODIUM_X, 1, 0);
    return o;
  }, []);
  const plates = useMemo(
    () => [
      numberPlateTexture(1, "#d4a017", "#1a1206"),
      numberPlateTexture(2, "#b8bcc6", "#16181c"),
      numberPlateTexture(3, "#b36b2c", "#1a0f06"),
    ],
    [],
  );
  const tops = ["#ffd34d", "#e5e7eb", "#d98b45"];
  useFrame((_, dt) => {
    if (!spot.current) return;
    const on = engine.phase === "finished" ? 220 : 0;
    spot.current.intensity += (on - spot.current.intensity) * (1 - Math.exp(-dt * 3));
  });
  return (
    <group>
      {PODIUM_SLOTS.map((s, i) => (
        <group key={i} position={[s.x, 0, 0]}>
          <mesh position={[0, s.h / 2, 0]}>
            <boxGeometry args={[2.1, s.h, 2.1]} />
            <meshStandardMaterial color="#160a0d" metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh position={[0, s.h + 0.02, 0]}>
            <boxGeometry args={[2.16, 0.06, 2.16]} />
            <meshStandardMaterial color={tops[i]} emissive={tops[i]} emissiveIntensity={0.5} metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, s.h / 2, 1.06]}>
            <planeGeometry args={[Math.min(0.9, s.h * 0.8), Math.min(0.9, s.h * 0.8)]} />
            <meshBasicMaterial map={plates[i]} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <primitive object={target} />
      <spotLight
        ref={spot}
        position={[PODIUM_X, 12, 6]}
        angle={0.42}
        penumbra={0.6}
        intensity={0}
        color="#fff1d6"
        target={target}
        decay={1.6}
      />
    </group>
  );
}
