"use client";
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ENCLOSURE_X, FINISH_X, KEEP_LANES, START_X, worldX } from "@/lib/race/config";

// With fixed lanes the field fills the whole width of the track: stand a little further back.
const BACK = KEEP_LANES ? 2.5 : 0;
import type { RaceEngine } from "@/lib/race/engine";

type Shot = "paddock" | "gate" | "start" | "side" | "headon" | "finish" | "enclosure";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Broadcast-style camera: picks a shot from the race state, eases between
 * shots of the same kind and hard-cuts when the director switches angle.
 */
export function CameraDirector({ engine }: { engine: RaceEngine }) {
  const st = useRef({
    shot: null as Shot | null,
    pos: v(START_X + 10, 4, 10),
    look: v(START_X, 1, 0),
    fov: 40,
    raceId: -1,
    shiftX: 0,
    shiftY: 0,
  });

  useFrame(({ clock, camera, size }, rawDt) => {
    const s = st.current;
    const dt = Math.min(rawDt, 0.05);
    const time = clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const widen = aspect < 1.5 ? Math.min(2.2, 1.5 / aspect) : 1;

    const n = engine.n;
    let lead = 0;
    let last = Infinity;
    let sum = 0;
    let lz = 0;
    for (let i = 0; i < n; i++) {
      const p = engine.progress[i];
      lead = Math.max(lead, p);
      last = Math.min(last, p);
      sum += p;
      lz += engine.lateral[i] / n;
    }
    const leadX = worldX(Math.min(lead, 1.06));
    const lastX = worldX(Math.min(last, 1.06));
    const meanX = worldX(Math.min(sum / n, 1.06));
    const cx = 0.6 * leadX + 0.4 * meanX;
    const spread = leadX - lastX;
    const T1 = engine.plan.finishTimes[engine.plan.order[0]];

    let shot: Shot;
    if (engine.phase === "paddock") shot = "paddock";
    else if (engine.phase === "countdown") shot = "gate";
    else if (engine.phase === "finished") shot = "enclosure";
    else if (engine.t < 2.6) shot = "start";
    else if (lead > 0.86 || engine.finishOrder.length > 0) shot = "finish";
    else if (engine.t > T1 * 0.46 && engine.t < T1 * 0.6) shot = "headon";
    else shot = "side";

    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    let fov = 38;
    let k = 3.2; // follow stiffness
    switch (shot) {
      case "paddock": {
        const a = 0.55 + Math.sin(time * 0.15) * 0.42;
        pos = v(START_X + 1 + Math.cos(a) * 12.5, 4 + Math.sin(time * 0.23) * 0.5, Math.sin(a) * 12.5);
        look = v(START_X + 0.5, 1.6, -0.4);
        fov = 40;
        k = 2;
        break;
      }
      case "gate": {
        const u = Math.min(1, engine.phaseTime / 5);
        pos = v(START_X + 11.5 - u * 2.5, 2.9 - u * 0.4, 4.6 - u * 1.4);
        look = v(START_X, 1.4, 0);
        fov = 40;
        k = 2.2;
        break;
      }
      case "start": {
        pos = v(cx + 9.5, 3.4, 9);
        look = v(cx - 0.5, 1, 0);
        fov = 44;
        k = 5;
        break;
      }
      case "side": {
        const d = 12.5 + BACK + spread * 0.45;
        pos = v(cx - 3, 4.4 + BACK * 0.3 + spread * 0.15, lz + d);
        look = v(cx + 1.5, 1.45, lz - 0.8);
        fov = 36;
        break;
      }
      case "headon": {
        pos = v(leadX + 9.5, 2.4 + BACK * 0.2, lz + 4.8 + BACK * 1.4);
        look = v(cx - 3, 0.9, lz);
        fov = 40;
        k = 4;
        break;
      }
      case "finish": {
        // track the pack, then settle square-on to the finish line (photo-finish camera)
        const fx = Math.min(cx + 0.6, FINISH_X);
        pos = v(fx, 4.8 + BACK * 0.3, lz + 15 + BACK);
        look = v(fx, 1.2, lz - 0.6);
        fov = 34;
        k = 3.5;
        break;
      }
      case "enclosure":
      default: {
        const a = Math.sin(time * 0.18) * 0.5;
        pos = v(ENCLOSURE_X + Math.sin(a) * 10.5, 3.2, 0.4 + Math.cos(a) * 10.5);
        look = v(ENCLOSURE_X, 1.4, 0.2);
        fov = 36;
        k = 1.4;
        break;
      }
    }
    pos.z *= widen;
    pos.y += (widen - 1) * 2;

    const cut =
      s.shot === null ||
      s.raceId !== engine.raceId ||
      (s.shot !== shot &&
        !(s.shot === "side" && shot === "finish") &&
        !(s.shot === "finish" && shot === "enclosure") &&
        !(s.shot === "paddock" && shot === "gate"));
    s.shot = shot;
    s.raceId = engine.raceId;

    if (engine.freeze > 0) {
      // the photo-finish frame: square-on to the line, exactly on it
      s.pos.set(FINISH_X, 4.8 + BACK * 0.3 + (widen - 1) * 2, lz + (15 + BACK) * widen);
      s.look.set(FINISH_X, 1.2, lz - 0.6);
      s.fov = 34;
    } else if (cut) {
      s.pos.copy(pos);
      s.look.copy(look);
      s.fov = fov;
    } else {
      const a = 1 - Math.exp(-k * dt);
      s.pos.lerp(pos, a);
      s.look.lerp(look, a);
      s.fov += (fov - s.fov) * a;
    }

    cam.position.copy(s.pos);
    cam.lookAt(s.look);

    // Lens shift keeps the action clear of the HUD panels
    // (paddock cards at the bottom, results on the right).
    const wantX = shot === "enclosure" && aspect > 1.2 ? 0.17 : 0;
    const wantY = shot === "paddock" ? 0.14 : 0;
    const a = 1 - Math.exp(-3 * dt);
    s.shiftX += (wantX - s.shiftX) * a;
    s.shiftY += (wantY - s.shiftY) * a;
    cam.fov = s.fov;
    if (Math.abs(s.shiftX) > 0.001 || Math.abs(s.shiftY) > 0.001) {
      cam.setViewOffset(size.width, size.height, s.shiftX * size.width, s.shiftY * size.height, size.width, size.height);
    } else {
      cam.clearViewOffset();
    }
  });

  return null;
}
