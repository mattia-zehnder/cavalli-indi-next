"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

/**
 * A fixed-size ring buffer of particles. Emitters write into it, `step()`
 * simulates it and writes the result into one InstancedMesh.
 */
export class ParticlePool {
  readonly max: number;
  readonly kind: "fizz" | "confetti";
  private pos: Float32Array;
  private vel: Float32Array;
  private rot: Float32Array;
  private spin: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private color: Float32Array;
  private dirtyColor = true;
  private next = 0;

  constructor(max: number, kind: "fizz" | "confetti") {
    this.max = max;
    this.kind = kind;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.rot = new Float32Array(max * 3);
    this.spin = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.color = new Float32Array(max * 3).fill(1);
  }

  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    color: THREE.Color,
  ) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
    this.spin.set(
      [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6],
      i * 3,
    );
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.color.set([color.r, color.g, color.b], i * 3);
    this.dirtyColor = true;
  }

  clear() {
    this.life.fill(0);
  }

  /** Advance the simulation and write the instances. */
  step(m: THREE.InstancedMesh, rawDt: number, time: number) {
    const dt = Math.min(rawDt, 0.05);
    for (let i = 0; i < this.max; i++) {
      let s = 0;
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        s = this.kind === "fizz" ? this.stepFizz(i, dt) : this.stepConfetti(i, dt, time);
        const k = i * 3;
        dummy.position.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
        dummy.rotation.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]);
      }
      dummy.scale.setScalar(Math.max(s, 0.0001));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;

    if (this.dirtyColor) {
      for (let i = 0; i < this.max; i++) {
        m.setColorAt(i, tmpColor.setRGB(this.color[i * 3], this.color[i * 3 + 1], this.color[i * 3 + 2]));
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      this.dirtyColor = false;
    }
  }

  private stepFizz(i: number, dt: number) {
    const k = i * 3;
    this.vel[k + 1] += 1.6 * dt; // buoyancy
    const drag = Math.exp(-dt * 2.2);
    this.vel[k] *= drag;
    this.vel[k + 2] *= drag;
    this.pos[k] += this.vel[k] * dt;
    this.pos[k + 1] += this.vel[k + 1] * dt;
    this.pos[k + 2] += this.vel[k + 2] * dt;
    this.rot[k] = this.rot[k + 1] = this.rot[k + 2] = 0;
    const a = Math.max(0, this.life[i] / this.maxLife[i]);
    return this.size[i] * Math.sqrt(a) * (1 + 0.15 * Math.sin(this.life[i] * 30));
  }

  private stepConfetti(i: number, dt: number, time: number) {
    const k = i * 3;
    this.vel[k + 1] -= 4.5 * dt;
    const drag = Math.exp(-dt * 2.6);
    this.vel[k] *= drag;
    this.vel[k + 1] *= drag;
    this.vel[k + 2] *= drag;
    this.pos[k] += (this.vel[k] + Math.sin(time * 3 + i) * 0.4) * dt;
    this.pos[k + 1] += this.vel[k + 1] * dt;
    this.pos[k + 2] += (this.vel[k + 2] + Math.cos(time * 2.3 + i) * 0.4) * dt;
    if (this.pos[k + 1] < 0.02) {
      // landed: lie flat on the track
      this.pos[k + 1] = 0.02;
      this.vel[k] = this.vel[k + 1] = this.vel[k + 2] = 0;
      this.spin[k] = this.spin[k + 1] = this.spin[k + 2] = 0;
      this.rot[k] = -Math.PI / 2;
      this.rot[k + 1] = 0;
    }
    this.rot[k] += this.spin[k] * dt;
    this.rot[k + 1] += this.spin[k + 1] * dt;
    this.rot[k + 2] += this.spin[k + 2] * dt;
    return this.size[i] * Math.min(1, this.life[i] / 0.5);
  }
}

function ParticleMesh({
  pool,
  geometry,
  children,
}: {
  pool: ParticlePool;
  geometry: THREE.BufferGeometry;
  children: React.ReactNode;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < pool.max; i++) m.setColorAt(i, tmpColor.setRGB(1, 1, 1));
  }, [pool]);
  useFrame(({ clock }, dt) => {
    if (mesh.current) pool.step(mesh.current, dt, clock.elapsedTime);
  });
  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, pool.max]} frustumCulled={false}>
      {children}
    </instancedMesh>
  );
}

/** Soda fizz: little glowing bubbles that rise and pop. */
export function FizzRenderer({ pool }: { pool: ParticlePool }) {
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  return (
    <ParticleMesh pool={pool} geometry={geo}>
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.35}
        roughness={0.1}
        metalness={0}
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </ParticleMesh>
  );
}

/** Confetti: fluttering paper squares. */
export function ConfettiRenderer({ pool }: { pool: ParticlePool }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 0.55), []);
  return (
    <ParticleMesh pool={pool} geometry={geo}>
      <meshStandardMaterial
        side={THREE.DoubleSide}
        roughness={0.5}
        metalness={0.2}
        emissive="#ffffff"
        emissiveIntensity={0.15}
      />
    </ParticleMesh>
  );
}
