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
import { ENCLOSURE_SLOTS } from "./World";
import { blobTexture, saddleClothTexture, tagTexture } from "./textures";

const STRIDE = 1.45; // world units per galloping stride
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
      // glossier glass so the floodlights show on the bottle
      m.roughness = 0.3;
      m.metalness = 0.05;
      m.envMapIntensity = 1.3;
      mesh.material = m;
    });
    return scene;
  }, [gltf]);
}

const blobTex = typeof document !== "undefined" ? blobTexture() : null;
const TURF = ["#2a4a2c", "#3b3226", "#24402a", "#4a3d2c"].map((c) => new THREE.Color(c));

type Props = {
  engine: RaceEngine;
  index: number;
  contender: Contender;
  lanes: number;
  turf: ParticlePool;
};

export function Bottle({ engine, index, contender, lanes, turf }: Props) {
  const scene = useBottleScene();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const tag = useRef<THREE.Sprite>(null);

  const tagTex = useMemo(() => tagTexture(contender.number, contender.name, contender.hex), [contender]);
  const clothTex = useMemo(() => saddleClothTexture(contender.number, contender.hex), [contender]);
  const z0 = laneZ(index, lanes);

  const s = useRef({
    x: START_X,
    stride: index * 0.29,
    amp: 0,
    lean: 0,
    raceId: -1,
    walkFrom: null as null | THREE.Vector3,
    tagIn: 0,
    yaw: 0,
  });

  useFrame(({ clock, camera }, rawDt) => {
    const st = s.current;
    if (!root.current || !body.current) return;
    if (engine.freeze > 0) {
      // photo-finish freeze: hold the pose, only the saddle cloths identify them
      if (tag.current) tag.current.visible = false;
      return;
    }
    const dt = Math.min(rawDt, 0.05);
    const time = clock.elapsedTime;

    if (st.raceId !== engine.raceId) {
      st.raceId = engine.raceId;
      st.x = START_X;
      st.walkFrom = null;
      st.amp = 0;
      st.lean = 0;
      st.yaw = 0;
    }

    const inStalls = engine.phase === "paddock" || engine.phase === "countdown";
    const baseX = inStalls ? START_X : worldX(engine.progress[index]);
    let x = baseX;
    let z = inStalls ? z0 : engine.lateral[index];
    let y = 0;
    let pitch = 0;
    let yawTarget = 0;
    let tagVisible = true;
    const place = engine.phase === "finished" ? engine.placeOf(index) : -1;
    const toEnclosure = place >= 0 && place < 3;

    if (engine.phase === "paddock") {
      // standing in the stall, shifting a little
      pitch = Math.sin(time * 1.3 + index * 1.7) * 0.015;
      yawTarget = Math.sin(time * 0.5 + index) * 0.08;
    } else if (engine.phase === "countdown") {
      pitch = Math.sin(time * 3.1 + index) * 0.02;
    } else {
      const dx = baseX - st.x;
      const raceDt = dt * Math.max(engine.timeScale, 0.05);
      const rel = raceDt > 0 ? dx / raceDt / AVG_SPEED : 0;

      const prev = st.stride;
      st.stride += Math.max(0, dx) / STRIDE;
      const landed = Math.floor(st.stride) !== Math.floor(prev);
      const f = st.stride % 1;

      // gallop: a light rise once per stride and a rocking pitch
      st.amp = damp(st.amp, 0.085 * Math.min(1.3, Math.max(0, rel)), 5, dt);
      const k = st.amp / 0.085;
      y = st.amp * Math.pow(Math.sin(Math.PI * f), 2);
      st.lean = damp(st.lean, Math.min(0.16, Math.max(0, (rel - 0.5) * 0.14)), 4, dt);
      pitch = st.lean + Math.sin(2 * Math.PI * f) * 0.05 * k;

      if (landed && st.amp > 0.03 && !toEnclosure && rel > 0.4) {
        for (let p = 0; p < 2; p++) {
          turf.emit(
            x - 0.3 - Math.random() * 0.2,
            0.05,
            z + (Math.random() - 0.5) * 0.4,
            -1.2 - Math.random() * 2,
            1.2 + Math.random() * 1.6,
            (Math.random() - 0.5) * 0.6,
            0.7 + Math.random() * 0.4,
            0.035 + Math.random() * 0.035,
            TURF[Math.floor(Math.random() * TURF.length)],
          );
        }
      }

      if (toEnclosure) {
        // walk calmly to the winners' enclosure: 1st, then 2nd, then 3rd
        const slot = ENCLOSURE_SLOTS[place];
        const start = 0.9 + place * 0.35;
        const u = clamp01((engine.phaseTime - start) / 2.8);
        if (!st.walkFrom) st.walkFrom = new THREE.Vector3(baseX, 0, z);
        const e = easeInOut(u);
        x = st.walkFrom.x + (slot.x - st.walkFrom.x) * e;
        z = st.walkFrom.z + (slot.z - st.walkFrom.z) * e;
        const walking = u > 0 && u < 1;
        y = walking ? Math.abs(Math.sin(engine.phaseTime * 7 + index)) * 0.025 : 0;
        pitch = walking ? Math.sin(engine.phaseTime * 7 + index) * 0.02 : 0;
        yawTarget = walking ? Math.atan2(-(slot.z - st.walkFrom.z), slot.x - st.walkFrom.x) * 0.6 : 0;
      }
      if (engine.phase === "finished") tagVisible = false;
    }

    st.x = baseX;
    st.yaw = damp(st.yaw, yawTarget, 4, dt);

    root.current.position.set(x, 0, z);
    body.current.position.y = y;
    body.current.rotation.set(0, st.yaw, -pitch, "YXZ");

    if (shadow.current) {
      const sc = 1.45 * (1 - Math.min(0.3, y));
      shadow.current.scale.set(sc, sc, sc);
    }

    if (tag.current) {
      // In the stalls the gate shows the numbers: tags appear once they're out.
      const show = !inStalls && x > START_X + 1.2 && tagVisible;
      st.tagIn = damp(st.tagIn, show ? 1 : 0, 6, dt);
      tag.current.visible = st.tagIn > 0.02;
      (tag.current.material as THREE.SpriteMaterial).opacity = st.tagIn;
      tag.current.position.y = y + BOTTLE_HEIGHT + 0.55;
      // partially compensate perspective so close-ups don't get giant tags
      const d = camera.position.distanceTo(root.current.position);
      const k = 0.42 * Math.sqrt(Math.max(4, d));
      tag.current.scale.set(k, k / 4, 1);
    }
  });

  return (
    <group ref={root} position={[START_X, 0, z0]}>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={blobTex} transparent depthWrite={false} opacity={0.85} />
      </mesh>
      <group ref={body}>
        <primitive
          object={scene}
          scale={BOTTLE_SCALE}
          position={[0, BOTTLE_HEIGHT / 2, 0]}
          rotation-y={BOTTLE_YAW}
        />
        {/* saddle cloth with the number, wrapped around the bottle */}
        <mesh position={[0, 0.43, 0]} rotation-y={-Math.PI / 2}>
          <cylinderGeometry args={[0.334, 0.377, 0.35, 40, 1, true]} />
          <meshStandardMaterial map={clothTex} roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <sprite ref={tag} position={[0, BOTTLE_HEIGHT + 0.55, 0]} scale={[2, 0.5, 1]} renderOrder={20}>
        <spriteMaterial map={tagTex} depthTest={false} depthWrite={false} transparent toneMapped={false} />
      </sprite>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
