"use client";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  BOTTLE_HEIGHT,
  BOTTLE_SCALE,
  MODEL_URL,
  START_X,
  TRACK_LEN,
  laneZ,
  worldX,
  type Contender,
} from "@/lib/race/config";
import type { RaceEngine } from "@/lib/race/engine";
import type { ParticlePool } from "./Fx";
import { PODIUM_SLOTS } from "./World";
import { blobTexture, glowTexture, labelTexture } from "./textures";

const STRIDE = 1.25; // world units per hop
const AVG_SPEED = TRACK_LEN / 23;
const BOTTLE_YAW = -Math.PI / 2; // turns the Campari logo towards the side camera

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

function useBottleScene() {
  const gltf = useGLTF(MODEL_URL);
  return useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      // glossier glass so the studio lights show on the bottle
      m.roughness = 0.32;
      m.metalness = 0.05;
      m.envMapIntensity = 1.4;
      mesh.material = m;
    });
    return scene;
  }, [gltf]);
}

const blobTex = typeof document !== "undefined" ? blobTexture() : null;
const glowTex = typeof document !== "undefined" ? glowTexture() : null;

type Props = {
  engine: RaceEngine;
  index: number;
  contender: Contender;
  lanes: number;
  fizz: ParticlePool;
  confetti: ParticlePool;
};

export function Bottle({ engine, index, contender, lanes, fizz, confetti }: Props) {
  const scene = useBottleScene();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const label = useRef<THREE.Sprite>(null);

  const color = useMemo(() => new THREE.Color(contender.hex), [contender.hex]);
  const neon = useMemo(() => new THREE.Color(contender.hex).multiplyScalar(2.4), [contender.hex]);
  const white = useMemo(() => new THREE.Color("#fff6f0"), []);
  const confettiColors = useMemo(
    () => [color, white, new THREE.Color("#ffd34d"), new THREE.Color("#e11d2e")],
    [color, white],
  );
  const labelTex = useMemo(
    () => labelTexture(contender.number, contender.name, contender.hex),
    [contender],
  );
  const z0 = laneZ(index, lanes);

  const s = useRef({
    x: START_X,
    hop: index * 0.37,
    amp: 0,
    lean: 0,
    ringPulse: 0,
    raceId: -1,
    runoutX: START_X,
    podiumStart: null as null | THREE.Vector3,
    nextConfetti: 0,
    labelIn: 0,
  });

  useFrame(({ clock, camera }, rawDt) => {
    const st = s.current;
    if (!root.current || !body.current) return;
    if (engine.freeze > 0) return; // photo-finish freeze: hold the pose
    const dt = Math.min(rawDt, 0.05);
    const time = clock.elapsedTime;

    if (st.raceId !== engine.raceId) {
      st.raceId = engine.raceId;
      st.x = START_X;
      st.podiumStart = null;
      st.amp = 0;
      st.lean = 0;
    }

    const baseX = engine.phase === "paddock" || engine.phase === "countdown" ? START_X : worldX(engine.progress[index]);
    let x = baseX;
    let y = 0;
    let z = z0;
    let sy = 1;
    let lean = 0;
    let roll = 0;
    let yaw = 0;
    let tip = 0;
    let floor = 0; // height of whatever the bottle stands on (track or podium step)
    let labelVisible = true;
    const place = engine.phase === "finished" ? engine.placeOf(index) : -1;
    const onPodium = place >= 0 && place < 3;

    if (engine.phase === "paddock") {
      x = START_X;
      const b = Math.abs(Math.sin(time * 2.6 + index * 1.3));
      y = 0.05 * b;
      sy = 1 + 0.03 * Math.sin(time * 5.2 + index);
      yaw = Math.sin(time * 0.9 + index) * 0.25;
    } else if (engine.phase === "countdown") {
      x = START_X;
      const urgency = clamp01(1 + engine.t / 3.5); // 0 → 1
      sy = 1 - 0.12 * urgency; // crouch before the jump
      y = Math.abs(Math.sin(time * (9 + urgency * 8) + index)) * 0.04;
      roll = Math.sin(time * 14 + index) * 0.03 * urgency;
    } else {
      const dx = baseX - st.x;
      const raceDt = dt * Math.max(engine.timeScale, 0.05);
      const raceSpeed = dt > 0 ? dx / raceDt : 0;
      const rel = raceSpeed / AVG_SPEED;

      const prev = st.hop;
      st.hop += Math.max(0, dx) / STRIDE;
      const landed = Math.floor(st.hop) !== Math.floor(prev);
      const f = st.hop % 1;

      st.amp = damp(st.amp, 0.34 * Math.min(1.5, Math.max(0, rel)), 6, dt);
      const air = Math.sin(Math.PI * f);
      const ground = 1 - air;
      const k = Math.min(1.2, st.amp / 0.34);
      y = st.amp * air;
      sy = 1 + k * (0.08 * air - 0.2 * Math.pow(ground, 6));
      st.lean = damp(st.lean, Math.min(0.34, Math.max(0, (rel - 0.4) * 0.28)), 5, dt);
      lean = st.lean;
      roll = Math.sin(st.hop * Math.PI) * 0.07 * k;
      yaw = Math.sin(st.hop * Math.PI * 2) * 0.1 * k;

      if (landed && st.amp > 0.05 && !onPodium) {
        st.ringPulse = 1;
        const n = rel > 1.12 ? 5 : 2;
        for (let p = 0; p < n; p++) {
          fizz.emit(
            x - 0.25 - Math.random() * 0.2,
            0.08 + Math.random() * 0.25,
            z + (Math.random() - 0.5) * 0.6,
            -0.8 - Math.random() * 1.6,
            0.4 + Math.random() * 0.8,
            (Math.random() - 0.5) * 0.8,
            0.6 + Math.random() * 0.6,
            0.04 + Math.random() * 0.06,
            Math.random() < 0.45 ? color : white,
          );
        }
      }
      // fast = trail of bubbles from the cap
      if (rel > 1.18 && Math.random() < 0.5 && !onPodium) {
        fizz.emit(
          x - 0.3,
          y + BOTTLE_HEIGHT * 0.9,
          z + (Math.random() - 0.5) * 0.2,
          -1.5 - Math.random(),
          0.6,
          0,
          0.7,
          0.05 + Math.random() * 0.04,
          Math.random() < 0.6 ? color : white,
        );
      }

      if (engine.phase === "finished") {
        const t = engine.phaseTime;
        if (onPodium) {
          // hop onto the podium: 3rd, then 2nd, then the winner
          const slot = PODIUM_SLOTS[place];
          const start = 0.5 + (2 - place) * 0.55;
          const u = clamp01((t - start) / 0.95);
          if (!st.podiumStart) st.podiumStart = new THREE.Vector3(baseX, 0, z0);
          const from = st.podiumStart;
          const e = easeInOut(u);
          x = from.x + (slot.x - from.x) * e;
          z = from.z + (0 - from.z) * e;
          const base = slot.h * e;
          floor = base;
          y = base + Math.sin(Math.PI * u) * 3.2;
          lean = u < 1 ? 0.25 * Math.sin(Math.PI * u) : 0;
          roll = 0;
          sy = u < 1 ? 1 + 0.12 * Math.sin(Math.PI * u) : 1;
          yaw = u < 1 ? u * Math.PI * 2 : 0;
          if (u >= 1) {
            const since = t - start - 0.95;
            if (place === 0) {
              // victory dance + fizz fountain
              const b = Math.abs(Math.sin(since * 5));
              y = slot.h + b * 0.55;
              sy = 1 + 0.1 * b - 0.12 * Math.pow(1 - b, 8);
              yaw = Math.sin(since * 2.2) * 0.6;
              for (let p = 0; p < 2; p++) {
                fizz.emit(
                  x + (Math.random() - 0.5) * 0.1,
                  y + BOTTLE_HEIGHT,
                  z + (Math.random() - 0.5) * 0.1,
                  (Math.random() - 0.5) * 2.2,
                  1.6 + Math.random() * 1.8,
                  (Math.random() - 0.5) * 2.2,
                  0.9,
                  0.05 + Math.random() * 0.07,
                  Math.random() < 0.5 ? color : white,
                );
              }
              if (time > st.nextConfetti) {
                st.nextConfetti = time + 0.03;
                confetti.emit(
                  slot.x + (Math.random() - 0.5) * 9,
                  9 + Math.random() * 2,
                  (Math.random() - 0.5) * 6,
                  (Math.random() - 0.5) * 1,
                  -1,
                  (Math.random() - 0.5) * 1,
                  5,
                  0.16 + Math.random() * 0.08,
                  confettiColors[Math.floor(Math.random() * confettiColors.length)],
                );
              }
            } else {
              const b = Math.abs(Math.sin(since * 3 + place));
              y = slot.h + b * 0.12;
              yaw = Math.sin(since * 1.4 + place) * 0.3;
            }
          }
        } else if (place === engine.n - 1) {
          // last place had one too many: slowly tips over
          tip = easeInOut(clamp01((t - 1.2) / 1.1));
          lean = 0;
          roll = 0;
          y = 0;
          sy = 1;
          labelVisible = tip < 0.5;
        } else {
          y *= Math.max(0, 1 - t);
        }
      }
    }

    st.x = baseX;

    root.current.position.set(x, 0, z);
    body.current.position.y = y + tip * 0.36;
    body.current.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    body.current.rotation.set(roll, yaw, -lean + tip * (Math.PI / 2), "YXZ");

    if (shadow.current) {
      const h = Math.max(0, y - floor);
      const sc = 1.5 * (1 - Math.min(0.6, h / 4));
      shadow.current.scale.set(sc, sc, sc);
      shadow.current.position.y = floor + 0.012;
    }
    st.ringPulse = Math.max(0, st.ringPulse - dt * 3);
    if (ring.current) {
      const sc = 1 + (1 - st.ringPulse) * 0.9;
      ring.current.scale.set(sc, sc, sc);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = st.ringPulse * 0.9;
      ring.current.position.y = engine.phase === "finished" ? -10 : 0.02;
    }
    if (glow.current) {
      glow.current.visible = !onPodium;
      const g = glow.current.material as THREE.MeshBasicMaterial;
      g.opacity = 0.55 + 0.25 * Math.sin(time * 4 + index);
    }
    if (label.current) {
      // In the stalls the gate already shows the numbers: labels pop in once they're out.
      const inGate = engine.phase === "paddock" || engine.phase === "countdown" || x < START_X + 1.2;
      st.labelIn = damp(st.labelIn, inGate || !labelVisible ? 0 : 1, 6, dt);
      label.current.visible = st.labelIn > 0.02;
      (label.current.material as THREE.SpriteMaterial).opacity = st.labelIn;
      label.current.position.y = y + BOTTLE_HEIGHT + 0.7;
      // partially compensate perspective so close-ups don't get giant labels
      const d = camera.position.distanceTo(root.current.position);
      const k = 0.52 * Math.sqrt(Math.max(4, d)) * (0.7 + 0.3 * st.labelIn);
      label.current.scale.set(k, k / 4, 1);
    }
  });

  return (
    <group ref={root} position={[START_X, 0, z0]}>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={blobTex} transparent depthWrite={false} opacity={0.9} />
      </mesh>
      <mesh ref={glow} rotation-x={-Math.PI / 2} position={[0, 0.016, 0]} scale={2.1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowTex} color={neon} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.42, 0.52, 40]} />
        <meshBasicMaterial color={neon} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={body}>
        <primitive
          object={scene}
          scale={BOTTLE_SCALE}
          position={[0, BOTTLE_HEIGHT / 2, 0]}
          rotation-y={BOTTLE_YAW}
        />
        {/* jockey cap in racing colours */}
        <group position={[0, BOTTLE_HEIGHT - 0.04, 0]}>
          <mesh>
            <sphereGeometry args={[0.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.35} emissive={color} emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0.05, 0.01, 0]} rotation-z={-0.14}>
            <cylinderGeometry args={[0.31, 0.31, 0.03, 24, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={color} roughness={0.35} emissive={color} emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      </group>
      <sprite ref={label} position={[0, BOTTLE_HEIGHT + 0.7, 0]} scale={[2.4, 0.6, 1]} renderOrder={20}>
        <spriteMaterial map={labelTex} depthTest={false} depthWrite={false} transparent toneMapped={false} />
      </sprite>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
