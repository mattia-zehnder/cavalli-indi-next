"use client";
import { useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { CONTENDERS, FINISH_X } from "@/lib/race/config";
import type { RaceEngine } from "@/lib/race/engine";
import { Bottle } from "./Bottle";
import { CameraDirector } from "./CameraDirector";
import { ParticlePool, TurfRenderer } from "./Fx";
import {
  Backdrop,
  Boards,
  DistanceMarkers,
  Enclosure,
  FinishLine,
  Ground,
  Rails,
  StartingGate,
} from "./World";

/** Advances the race clock once per rendered frame, before anything reads it. */
function Driver({ engine }: { engine: RaceEngine }) {
  useFrame((_, dt) => engine.update(dt), -1);
  return null;
}

/** Floodlit night: cool overhead key, soft fill, neutral reflections. */
function Lights() {
  return (
    <>
      <hemisphereLight args={["#c9d6ff", "#1c3322", 0.6]} />
      <directionalLight position={[8, 24, 14]} intensity={2.1} color="#f4f6ff" />
      <directionalLight position={[-18, 10, -12]} intensity={0.5} color="#dfe8ff" />
      <pointLight position={[FINISH_X, 9, 5]} intensity={30} distance={32} color="#fff6e8" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#0a0f0c"]} />
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 8, 8]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#fff2dc" position={[-9, 3, 5]} scale={[4, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#dfe8ff" position={[9, 3, -6]} scale={[6, 4, 1]} />
        <Lightformer form="circle" intensity={2} color="#ffffff" position={[0, 12, 0]} scale={4} />
      </Environment>
    </>
  );
}

export function RaceScene({ engine }: { engine: RaceEngine }) {
  const turf = useMemo(() => new ParticlePool(360), []);

  useEffect(() => {
    let last = engine.raceId;
    return engine.subscribe(() => {
      if (engine.raceId !== last) {
        last = engine.raceId;
        turf.clear();
      }
    });
  }, [engine, turf]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [-30, 4, 10], fov: 40, near: 0.1, far: 400 }}
    >
      <color attach="background" args={["#05080a"]} />
      <fog attach="fog" args={["#06090b", 45, 150]} />
      <Driver engine={engine} />
      <CameraDirector engine={engine} />
      <Lights />
      <Stars radius={170} depth={40} count={1200} factor={3.5} saturation={0} fade speed={0.2} />

      <Ground />
      <Rails />
      <Boards />
      <DistanceMarkers />
      <FinishLine />
      <StartingGate engine={engine} />
      <Enclosure engine={engine} />
      <Backdrop engine={engine} />

      <Suspense fallback={null}>
        {CONTENDERS.map((c, i) => (
          <Bottle
            key={c.id}
            engine={engine}
            index={i}
            contender={c}
            lanes={CONTENDERS.length}
            turf={turf}
          />
        ))}
      </Suspense>

      <TurfRenderer pool={turf} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.5} luminanceThreshold={1} luminanceSmoothing={0.15} />
        <Vignette offset={0.3} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}
