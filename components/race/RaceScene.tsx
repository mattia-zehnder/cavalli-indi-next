"use client";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, Stars, useProgress } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { CONTENDERS, FINISH_X } from "@/lib/race/config";
import type { RaceEngine } from "@/lib/race/engine";
import { Bottle } from "./Bottle";
import { CameraDirector } from "./CameraDirector";
import { ConfettiRenderer, FizzRenderer, ParticlePool } from "./Fx";
import { Backdrop, DistanceMarkers, FinishLine, Ground, Podium, Rails, StartingGate } from "./World";

/** Advances the race clock once per rendered frame, before anything reads it. */
function Driver({ engine }: { engine: RaceEngine }) {
  useFrame((_, dt) => engine.update(dt), -1);
  return null;
}

/** Confetti burst over the finish line when the winner crosses. */
function FinishConfetti({ engine, confetti }: { engine: RaceEngine; confetti: ParticlePool }) {
  useEffect(
    () =>
      engine.onEvent((e) => {
        if (e.type !== "cross" || e.place !== 1) return;
        const c = new THREE.Color(CONTENDERS[e.horse].hex);
        const palette = [c, new THREE.Color("#ffffff"), new THREE.Color("#ffd34d"), new THREE.Color("#e11d2e")];
        for (let i = 0; i < 260; i++) {
          confetti.emit(
            FINISH_X + (Math.random() - 0.5) * 3,
            3 + Math.random() * 3,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.3) * 6,
            3 + Math.random() * 6,
            (Math.random() - 0.5) * 6,
            4 + Math.random() * 2,
            0.14 + Math.random() * 0.1,
            palette[i % palette.length],
          );
        }
      }),
    [engine, confetti],
  );
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffe2cc", "#2a0a10", 0.55]} />
      <directionalLight position={[12, 20, 16]} intensity={1.9} color="#fff0e0" />
      <directionalLight position={[-20, 8, -10]} intensity={0.8} color="#ff3b4a" />
      <pointLight position={[FINISH_X, 7, 4]} intensity={40} distance={30} color="#ffd9a0" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#120608"]} />
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 6, 8]} scale={[12, 3, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffcf9a" position={[-8, 3, 4]} scale={[4, 6, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#ff2a3c" position={[8, 2, -6]} scale={[6, 4, 1]} />
        <Lightformer form="circle" intensity={2} color="#ffffff" position={[0, 10, 0]} scale={4} />
      </Environment>
    </>
  );
}

export function RaceScene({ engine }: { engine: RaceEngine }) {
  const fizz = useMemo(() => new ParticlePool(420, "fizz"), []);
  const confetti = useMemo(() => new ParticlePool(700, "confetti"), []);

  useEffect(() => {
    let last = engine.raceId;
    return engine.subscribe(() => {
      if (engine.raceId !== last) {
        last = engine.raceId;
        fizz.clear();
        confetti.clear();
      }
    });
  }, [engine, fizz, confetti]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [-30, 4, 10], fov: 40, near: 0.1, far: 400 }}
    >
      <color attach="background" args={["#08030a"]} />
      <fog attach="fog" args={["#0a0407", 38, 125]} />
      <Driver engine={engine} />
      <CameraDirector engine={engine} />
      <Lights />
      <Stars radius={160} depth={40} count={2500} factor={5} saturation={0} fade speed={0.4} />

      <Ground />
      <Rails />
      <DistanceMarkers />
      <FinishLine />
      <StartingGate engine={engine} />
      <Podium engine={engine} />
      <Suspense fallback={null}>
        <Backdrop engine={engine} />
      </Suspense>

      <Suspense fallback={null}>
        {CONTENDERS.map((c, i) => (
          <Bottle
            key={c.id}
            engine={engine}
            index={i}
            contender={c}
            lanes={CONTENDERS.length}
            fizz={fizz}
            confetti={confetti}
          />
        ))}
      </Suspense>

      <FizzRenderer pool={fizz} />
      <ConfettiRenderer pool={confetti} />
      <FinishConfetti engine={engine} confetti={confetti} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
        <Vignette offset={0.25} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}

/** 0..100 while the 3D model downloads. */
export function useLoadProgress() {
  return useProgress();
}
