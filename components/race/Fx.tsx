"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

/**
 * Bits of turf kicked up by the runners. A fixed-size ring buffer: emitters
 * write into it, `step()` simulates it and writes one InstancedMesh.
 */
export class ParticlePool {
  readonly max: number;
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

  constructor(max: number) {
    this.max = max;
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
    this.spin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, 0], i * 3);
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
  step(m: THREE.InstancedMesh, rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    for (let i = 0; i < this.max; i++) {
      let s = 0;
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        const k = i * 3;
        this.vel[k + 1] -= 9 * dt;
        this.pos[k] += this.vel[k] * dt;
        this.pos[k + 1] += this.vel[k + 1] * dt;
        this.pos[k + 2] += this.vel[k + 2] * dt;
        if (this.pos[k + 1] < 0.02) {
          this.pos[k + 1] = 0.02;
          this.vel[k] *= 0.3;
          this.vel[k + 1] = 0;
          this.vel[k + 2] *= 0.3;
          this.spin[k] = this.spin[k + 1] = 0;
        }
        this.rot[k] += this.spin[k] * dt;
        this.rot[k + 1] += this.spin[k + 1] * dt;
        s = this.size[i] * Math.min(1, this.life[i] / 0.25);
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
}

export function TurfRenderer({ pool }: { pool: ParticlePool }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 0.45, 0.8), []);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < pool.max; i++) m.setColorAt(i, tmpColor.setRGB(1, 1, 1));
  }, [pool]);
  useFrame((_, dt) => {
    if (mesh.current) pool.step(mesh.current, dt);
  });
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, pool.max]} frustumCulled={false}>
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}
