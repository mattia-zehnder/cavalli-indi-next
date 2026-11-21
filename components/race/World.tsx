"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  CONTENDERS,
  ENCLOSURE_X,
  FINISH_X,
  KEEP_LANES,
  LANE_GAP,
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
  boardTexture,
  markerTexture,
  numberPlateTexture,
  signTexture,
  turfTexture,
} from "./textures";

const LANES = CONTENDERS.length;
const HALF = trackHalfWidth(LANES);
const TRACK_FROM = START_X - 14;
const TRACK_TO = ENCLOSURE_X + 16;
const RAIL_Z = HALF + 0.35;
const dummy = new THREE.Object3D();

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

// ---------------------------------------------------------------------------

export function Ground() {
  const turf = useMemo(() => {
    const t = turfTexture();
    // stripes ~4 units wide across the course
    t.repeat.set((TRACK_TO - TRACK_FROM) / 32, 1);
    return t;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[10, -0.03, 0]}>
        <planeGeometry args={[420, 220]} />
        <meshStandardMaterial color="#0e1c12" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[(TRACK_FROM + TRACK_TO) / 2, -0.01, 0]}>
        <planeGeometry args={[TRACK_TO - TRACK_FROM, HALF * 2 + 1.4]} />
        <meshStandardMaterial map={turf} roughness={0.95} metalness={0} />
      </mesh>
      {/* faint lane dividers from the stalls to the line */}
      {KEEP_LANES &&
        Array.from({ length: LANES - 1 }, (_, k) => (
          <mesh
            key={k}
            rotation-x={-Math.PI / 2}
            position={[(START_X + FINISH_X) / 2 + 0.4, 0.002, laneZ(k, LANES) + LANE_GAP / 2]}
          >
            <planeGeometry args={[TRACK_LEN - 0.8, 0.05]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
          </mesh>
        ))}
    </group>
  );
}

// ---------------------------------------------------------------------------

export function Rails() {
  const posts = useRef<THREE.InstancedMesh>(null);
  const xs = useMemo(() => {
    const a: number[] = [];
    for (let x = TRACK_FROM + 2; x <= TRACK_TO - 2; x += 2.2) a.push(x);
    return a;
  }, []);
  useEffect(() => {
    const m = posts.current;
    if (!m) return;
    let i = 0;
    for (const s of [-1, 1])
      for (const x of xs) {
        dummy.position.set(x, 0.42, s * RAIL_Z);
        dummy.updateMatrix();
        m.setMatrixAt(i++, dummy.matrix);
      }
    m.instanceMatrix.needsUpdate = true;
  }, [xs]);
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, xs.length * 2]}>
        <cylinderGeometry args={[0.04, 0.05, 0.84, 8]} />
        <meshStandardMaterial color="#e8e8e4" roughness={0.5} />
      </instancedMesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(TRACK_FROM + TRACK_TO) / 2, 0.9, s * RAIL_Z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, TRACK_TO - TRACK_FROM - 3, 12]} />
          <meshStandardMaterial color="#f2f2ee" roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Advertising boards just behind the inside rail. */
export function Boards() {
  const logo = useMemo(() => {
    if (typeof Image === "undefined") return undefined;
    const img = new Image();
    img.src = asset("/indi-background.png");
    return img;
  }, []);
  const textures = useMemo(
    () => [boardTexture("campari"), boardTexture("bar"), boardTexture("night"), boardTexture("logo", logo)],
    [logo],
  );
  const items = useMemo(() => {
    const a: { x: number; k: number }[] = [];
    let k = 0;
    for (let x = TRACK_FROM + 6; x < TRACK_TO - 4; x += 7.2) a.push({ x, k: k++ % 4 });
    return a;
  }, []);
  return (
    <group>
      {items.map(({ x, k }) => (
        <group key={x} position={[x, 0, -RAIL_Z - 1.1]}>
          <mesh position={[0, 0.55, 0]}>
            <planeGeometry args={[6.4, 1]} />
            <meshStandardMaterial
              map={textures[k]}
              roughness={0.6}
              emissive="#ffffff"
              emissiveMap={textures[k]}
              emissiveIntensity={0.12}
            />
          </mesh>
          <mesh position={[0, 0.55, -0.06]}>
            <boxGeometry args={[6.45, 1.05, 0.08]} />
            <meshStandardMaterial color="#1b1b1b" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------

export function DistanceMarkers() {
  return (
    <group>
      {[600, 400, 200, 100].map((m) => (
        <Marker key={m} metersToGo={m} />
      ))}
    </group>
  );
}

function Marker({ metersToGo }: { metersToGo: number }) {
  const tex = useMemo(() => markerTexture(String(metersToGo), metersToGo <= 100), [metersToGo]);
  const x = FINISH_X - (metersToGo / RACE_METERS) * TRACK_LEN;
  return (
    <group position={[x, 0, -RAIL_Z - 0.4]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 8]} />
        <meshStandardMaterial color="#f2f2ee" />
      </mesh>
      <mesh position={[0, 2.45, 0.03]}>
        <planeGeometry args={[0.95, 0.6]} />
        <meshStandardMaterial map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------

export function FinishLine() {
  const sign = useMemo(() => signTexture("ARRIVO", "#0f2a22", "#efe4c8", 512, 160), []);
  return (
    <group position={[FINISH_X, 0, 0]}>
      {/* painted line */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
        <planeGeometry args={[0.14, HALF * 2 + 1.2]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} />
      </mesh>
      {/* winning post on the inside rail */}
      <group position={[0, 0, -RAIL_Z - 0.25]}>
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.8, 10]} />
          <meshStandardMaterial color="#f2f2ee" />
        </mesh>
        <mesh position={[0, 2.9, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.45, 0.45, 0.05, 40]} />
          <meshStandardMaterial color="#c8102e" />
        </mesh>
        <mesh position={[0, 2.9, 0.03]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.2, 0.2, 0.01, 32]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
      {/* judges' box */}
      <group position={[0, 0, -RAIL_Z - 3.2]}>
        {[-1.3, 1.3].map((x) => (
          <mesh key={x} position={[x, 2, 0]}>
            <boxGeometry args={[0.16, 4, 0.16]} />
            <meshStandardMaterial color="#e9e6dc" />
          </mesh>
        ))}
        <mesh position={[0, 4.4, 0]}>
          <boxGeometry args={[3.2, 1.4, 1.6]} />
          <meshStandardMaterial color="#e9e6dc" roughness={0.6} />
        </mesh>
        <mesh position={[0, 4.4, 0.81]}>
          <planeGeometry args={[2.9, 0.9]} />
          <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.25} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Starting stalls: front gates spring open at the start. */
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
        ? easeOut(Math.min(1, Math.max(0, engine.t / 0.3)))
        : 0;
    doors.current.forEach((d, k) => {
      if (!d) return;
      const side = k % 2 === 0 ? 1 : -1;
      d.rotation.y = side * open * 1.65;
    });
  });

  const frame = <meshStandardMaterial color="#d8dad6" metalness={0.5} roughness={0.35} />;
  const green = <meshStandardMaterial color="#1c3d30" roughness={0.7} />;

  return (
    <group>
      {boundaries.map((z) =>
        [frontX, backX].map((x) => (
          <mesh key={`${z}-${x}`} position={[x, 1.35, z]}>
            <boxGeometry args={[0.14, 2.7, 0.14]} />
            {frame}
          </mesh>
        )),
      )}
      {/* padded partitions */}
      {boundaries.map((z) => (
        <mesh key={`p${z}`} position={[(frontX + backX) / 2, 1.0, z]}>
          <boxGeometry args={[frontX - backX, 1.4, 0.1]} />
          {green}
        </mesh>
      ))}
      {[frontX, backX].map((x) => (
        <mesh key={`b${x}`} position={[x, 2.72, 0]}>
          <boxGeometry args={[0.2, 0.2, width + 0.2]} />
          {frame}
        </mesh>
      ))}
      <mesh position={[(frontX + backX) / 2, 2.85, 0]}>
        <boxGeometry args={[frontX - backX + 0.2, 0.08, width + 0.2]} />
        {frame}
      </mesh>
      {/* header with stall numbers */}
      <mesh position={[frontX + 0.02, 3.2, 0]}>
        <boxGeometry args={[0.12, 0.75, width + 0.2]} />
        {green}
      </mesh>
      {CONTENDERS.map((c, i) => (
        <mesh key={c.id} position={[frontX + 0.09, 3.2, laneZ(i, LANES)]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshStandardMaterial
            map={plates[i]}
            emissive="#ffffff"
            emissiveMap={plates[i]}
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
      {/* front gates */}
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
                {[0.45, 1.0, 1.55].map((y) => (
                  <mesh key={y} position={[0, y, 0]}>
                    <boxGeometry args={[0.05, 0.06, doorW]} />
                    {frame}
                  </mesh>
                ))}
                <mesh position={[0, 1.0, s * (doorW / 2 - 0.03)]}>
                  <boxGeometry args={[0.05, 1.16, 0.06]} />
                  {frame}
                </mesh>
                <mesh position={[0, 1.0, 0]}>
                  <boxGeometry args={[0.02, 1.08, doorW - 0.04]} />
                  <meshStandardMaterial color="#0d1f18" transparent opacity={0.35} depthWrite={false} />
                </mesh>
              </group>
            </group>
          );
        });
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------

const ROWS = 7;
const COUNT = ROWS * 190;
const standFrom = TRACK_FROM - 24;
const standTo = TRACK_TO + 14;
const tierZ = (k: number) => -RAIL_Z - 4.2 - k * 1.05;
const tierTop = (k: number) => 0.5 + k * 0.6;

/** Grandstand behind the inside rail, with the crowd and floodlights. */
export function Backdrop({ engine }: { engine: RaceEngine }) {
  const crowd = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);

  const people = useMemo(() => {
    const rnd = mulberry32(7);
    const shirts = [
      "#3a3f4a",
      "#d9d2c5",
      "#2b3a55",
      "#6b2a2a",
      "#2e2e2e",
      "#8a7a5c",
      "#46384f",
      "#e8e1d4",
      "#1f3d33",
      "#5c5c5c",
    ];
    return Array.from({ length: COUNT }, (_, i) => {
      const row = i % ROWS;
      return {
        x: standFrom + rnd() * (standTo - standFrom),
        y: tierTop(row) + 0.34,
        z: tierZ(row) + (rnd() - 0.5) * 0.3,
        s: 0.85 + rnd() * 0.3,
        phase: rnd() * Math.PI * 2,
        freq: 3 + rnd() * 3,
        color: new THREE.Color(shirts[Math.floor(rnd() * shirts.length)]).multiplyScalar(0.5 + rnd() * 0.5),
      };
    });
  }, []);

  useEffect(() => {
    const m = crowd.current;
    if (m) people.forEach((p, i) => m.setColorAt(i, p.color));
    const h = heads.current;
    if (h) {
      const skins = ["#e8b896", "#c68e6a", "#f1c9a5", "#8d5a3c", "#d9a47e"].map((c) => new THREE.Color(c));
      people.forEach((_, i) => h.setColorAt(i, skins[i % skins.length]));
    }
  }, [people]);

  const tmp = useMemo(() => new THREE.Color(), []);
  const flashes = useRef<{ i: number; t: number }[]>([]);
  const excite = useRef(0.1);

  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime;
    const lead = Math.max(...engine.progress);
    const target =
      engine.phase === "running"
        ? 0.05 + 0.95 * Math.min(1, Math.max(0, (lead - 0.7) / 0.3))
        : engine.phase === "finished"
          ? Math.max(0, 0.6 - engine.phaseTime * 0.08)
          : 0;
    excite.current += (target - excite.current) * (1 - Math.exp(-dt * 2));
    const ex = excite.current;

    const m = crowd.current;
    const h = heads.current;
    if (m && h) {
      for (let i = 0; i < COUNT; i++) {
        const p = people[i];
        // standing up and waving in the closing stages
        const lift = Math.max(0, Math.sin(time * p.freq + p.phase)) * 0.12 * ex + ex * 0.08;
        dummy.position.set(p.x, p.y + lift, p.z);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        dummy.position.y += 0.42 * p.s;
        dummy.updateMatrix();
        h.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      h.instanceMatrix.needsUpdate = true;

      // a few camera flashes
      if (Math.random() < 0.05 + ex * 0.5) flashes.current.push({ i: Math.floor(Math.random() * COUNT), t: 0.07 });
      flashes.current = flashes.current.filter((f) => {
        f.t -= dt;
        m.setColorAt(f.i, f.t > 0 ? tmp.setRGB(5, 5, 5) : people[f.i].color);
        return f.t > 0;
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  const roofY = tierTop(ROWS - 1) + 2.6;
  const backZ = tierZ(ROWS - 1) - 0.8;
  const towers = [-58, -14, 30, 74, 118];

  return (
    <group>
      {Array.from({ length: ROWS }, (_, k) => (
        <mesh key={k} position={[(standFrom + standTo) / 2, tierTop(k) / 2, tierZ(k)]}>
          <boxGeometry args={[standTo - standFrom, tierTop(k), 1.05]} />
          <meshStandardMaterial color={k % 2 ? "#1d211f" : "#232826"} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[(standFrom + standTo) / 2, roofY / 2, backZ]}>
        <boxGeometry args={[standTo - standFrom, roofY, 0.4]} />
        <meshStandardMaterial color="#171b19" roughness={0.95} />
      </mesh>
      {/* roof */}
      <mesh position={[(standFrom + standTo) / 2, roofY, (tierZ(0) + backZ) / 2 - 0.3]} rotation-x={0.08}>
        <boxGeometry args={[standTo - standFrom, 0.18, tierZ(0) - backZ + 1.5]} />
        <meshStandardMaterial color="#262b29" roughness={0.8} />
      </mesh>
      {/* roof fascia */}
      <mesh position={[(standFrom + standTo) / 2, roofY - 0.25, tierZ(0) + 0.1]}>
        <boxGeometry args={[standTo - standFrom, 0.5, 0.12]} />
        <meshStandardMaterial color="#0f2a22" roughness={0.7} />
      </mesh>
      <mesh position={[(standFrom + standTo) / 2, roofY - 0.48, tierZ(0) + 0.17]}>
        <boxGeometry args={[standTo - standFrom, 0.04, 0.02]} />
        <meshStandardMaterial color="#b8975a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* roof columns */}
      {Array.from({ length: Math.floor((standTo - standFrom) / 12) }, (_, k) => standFrom + 6 + k * 12).map(
        (x) => (
          <mesh key={x} position={[x, roofY / 2, tierZ(0) + 0.2]}>
            <boxGeometry args={[0.25, roofY, 0.25]} />
            <meshStandardMaterial color="#2c312f" />
          </mesh>
        ),
      )}
      <instancedMesh ref={crowd} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <capsuleGeometry args={[0.19, 0.28, 3, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      {/* floodlight towers */}
      {towers.map((x) => (
        <group key={x} position={[x, 0, backZ - 4]}>
          <mesh position={[0, 9, 0]}>
            <cylinderGeometry args={[0.22, 0.35, 18, 10]} />
            <meshStandardMaterial color="#3a3f3d" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 18.4, 0.3]} rotation-x={0.35}>
            <boxGeometry args={[3.6, 2, 0.3]} />
            <meshStandardMaterial color="#2a2e2c" />
          </mesh>
          <mesh position={[0, 18.4, 0.47]} rotation-x={0.35}>
            <planeGeometry args={[3.3, 1.7]} />
            <meshBasicMaterial color={[6, 6, 5.4]} toneMapped={false} fog={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Winners' enclosure past the line, with the 1st/2nd/3rd boards. */
export const ENCLOSURE_SLOTS = [
  { x: ENCLOSURE_X, z: 0 }, // 1st
  { x: ENCLOSURE_X - 2.4, z: 0.45 }, // 2nd
  { x: ENCLOSURE_X + 2.4, z: 0.45 }, // 3rd
];

export function Enclosure({ engine }: { engine: RaceEngine }) {
  const spot = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(ENCLOSURE_X, 0.8, 0.2);
    return o;
  }, []);
  const signs = useMemo(
    () => [
      signTexture("1°", "#b8975a", "#111"),
      signTexture("2°", "#f4f1ea", "#111"),
      signTexture("3°", "#f4f1ea", "#111"),
    ],
    [],
  );
  useFrame((_, dt) => {
    if (!spot.current) return;
    const on = engine.phase === "finished" ? 160 : 0;
    spot.current.intensity += (on - spot.current.intensity) * (1 - Math.exp(-dt * 2));
  });
  return (
    <group>
      {/* paved ring */}
      <mesh rotation-x={-Math.PI / 2} position={[ENCLOSURE_X, 0.003, 0.2]}>
        <circleGeometry args={[4.1, 64]} />
        <meshStandardMaterial color="#3b3a34" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[ENCLOSURE_X, 0.005, 0.2]}>
        <ringGeometry args={[3.95, 4.1, 64]} />
        <meshStandardMaterial color="#e9e6dc" />
      </mesh>
      {ENCLOSURE_SLOTS.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z - 1]}>
          <mesh position={[0, 1.25, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 2.5, 8]} />
            <meshStandardMaterial color="#e9e6dc" />
          </mesh>
          <mesh position={[0, 2.5, 0.02]}>
            <planeGeometry args={[0.8, 0.5]} />
            <meshStandardMaterial map={signs[i]} emissive="#ffffff" emissiveMap={signs[i]} emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}
      <primitive object={target} />
      <spotLight
        ref={spot}
        position={[ENCLOSURE_X, 13, 7]}
        angle={0.4}
        penumbra={0.7}
        intensity={0}
        color="#fff4e0"
        target={target}
        decay={1.6}
      />
    </group>
  );
}
