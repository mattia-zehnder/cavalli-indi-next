import * as THREE from "three";

// Canvas-drawn textures (no network needed). Text textures are redrawn once the
// web fonts have loaded, so they never stay stuck on a fallback font.

const families: Record<string, string> = {};
function family(varName: "--font-display" | "--font-serif", fallback: string) {
  if (families[varName]) return families[varName];
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.body).getPropertyValue(varName).trim();
  families[varName] = v ? `${v}, ${fallback}` : fallback;
  return families[varName];
}
const display = () => family("--font-display", "'Arial Narrow', sans-serif");
const serif = () => family("--font-serif", "Georgia, serif");

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

type Fonts = { display: string; serif: string };

function textTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, f: Fonts) => void) {
  const { c, g } = canvas(w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const paint = () => {
    g.clearRect(0, 0, w, h);
    draw(g, { display: display(), serif: serif() });
    tex.needsUpdate = true;
  };
  paint();
  if (typeof document !== "undefined" && document.fonts) {
    Promise.all([
      document.fonts.load(`700 64px ${display()}`),
      document.fonts.load(`700 64px ${serif()}`),
    ])
      .then(paint)
      .catch(() => {});
    document.fonts.ready.then(paint).catch(() => {});
  }
  return { tex, repaint: paint };
}

/** Broadcast pointer above each runner: saddle-cloth number + name. */
export function tagTexture(num: number, name: string, hex: string) {
  const W = 512,
    H = 128;
  return textTexture(W, H, (g, f) => {
    g.font = `600 64px ${f.display}`;
    const nameW = g.measureText(name.toUpperCase()).width;
    const total = Math.min(W - 4, 112 + nameW + 28);
    const x0 = (W - total) / 2;
    // body
    g.fillStyle = "rgba(12,16,14,0.88)";
    g.fillRect(x0, 8, total, 96);
    // number block
    g.fillStyle = hex;
    g.fillRect(x0, 8, 96, 96);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 78px ${f.display}`;
    g.fillText(String(num), x0 + 48, 60);
    g.textAlign = "left";
    g.font = `600 64px ${f.display}`;
    g.fillStyle = "#f3ecdc";
    g.fillText(name.toUpperCase(), x0 + 112, 60);
    // pointer
    g.fillStyle = "rgba(12,16,14,0.88)";
    g.beginPath();
    g.moveTo(W / 2 - 12, 104);
    g.lineTo(W / 2 + 12, 104);
    g.lineTo(W / 2, 124);
    g.closePath();
    g.fill();
  }).tex;
}

/** Square plate with a number (starting stalls). */
export function numberPlateTexture(num: number | string, bg: string, fg = "#fff") {
  return textTexture(256, 256, (g, f) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 10;
    g.strokeRect(12, 12, 232, 232);
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 180px ${f.display}`;
    g.fillText(String(num), 128, 136);
  }).tex;
}

/**
 * Saddle cloth wrapped around the bottle: coloured band with the number on
 * both sides. u = 0.25 ends up facing the camera (see Bottle).
 */
export function saddleClothTexture(num: number, hex: string) {
  const W = 512,
    H = 128;
  return textTexture(W, H, (g, f) => {
    g.fillStyle = hex;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(0, 6, W, 6);
    g.fillRect(0, H - 12, W, 6);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 92px ${f.display}`;
    g.fillText(String(num), W * 0.25, H / 2 + 4);
    g.fillText(String(num), W * 0.75, H / 2 + 4);
  }).tex;
}

/** Night turf: mowing stripes across the course + speckle. */
export function turfTexture() {
  const W = 512,
    H = 256;
  const { c, g } = canvas(W, H);
  for (let x = 0; x < W; x += 64) {
    g.fillStyle = (x / 64) % 2 ? "#27512f" : "#2d5c35";
    g.fillRect(x, 0, 64, H);
  }
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n * 0.6;
    img.data[i + 1] += n;
    img.data[i + 2] += n * 0.5;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Soft round shadow. */
export function blobTexture() {
  const { c, g } = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.7)");
  grd.addColorStop(0.5, "rgba(0,0,0,0.3)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Distance pole board. */
export function markerTexture(text: string, red = false) {
  return textTexture(256, 160, (g, f) => {
    g.fillStyle = red ? "#c8102e" : "#f4f1ea";
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = red ? "#fff" : "#111";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 118px ${f.display}`;
    g.fillText(text, 128, 86);
  }).tex;
}

/** Advertising board along the inside rail. */
export function boardTexture(kind: "campari" | "bar" | "night" | "logo", logo?: HTMLImageElement) {
  const W = 1024,
    H = 160;
  const { tex, repaint } = textTexture(W, H, (g, f) => {
    const red = "#c8102e";
    if (kind === "campari") {
      g.fillStyle = red;
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#fff";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `700 112px ${f.serif}`;
      g.fillText("Campari", W / 2, H / 2 + 6);
    } else if (kind === "bar") {
      g.fillStyle = "#f4f1ea";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#1a1a1a";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `600 78px ${f.display}`;
      g.fillText("BAR INDIPENDENZA · BRONI", W / 2, H / 2 + 4);
    } else if (kind === "night") {
      g.fillStyle = "#0f2a22";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#e9dcb8";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `italic 700 84px ${f.serif}`;
      g.fillText("Casino Campari Night", W / 2, H / 2 + 4);
    } else {
      g.fillStyle = "#f4f1ea";
      g.fillRect(0, 0, W, H);
      if (logo?.complete && logo.naturalWidth) {
        for (const x of [W * 0.2, W * 0.5, W * 0.8]) g.drawImage(logo, x - 65, 15, 130, 130);
      }
    }
  });
  if (kind === "logo" && logo && !logo.complete) logo.addEventListener("load", repaint, { once: true });
  return tex;
}

/** Signs for the winners' enclosure ("1°", "2°", "3°") and the finish ("ARRIVO"). */
export function signTexture(text: string, bg = "#f4f1ea", fg = "#111", w = 256, h = 160) {
  return textTexture(w, h, (g, f) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    let size = h * 0.68;
    g.font = `700 ${size}px ${f.display}`;
    while (g.measureText(text).width > w * 0.86 && size > 12) {
      size -= 4;
      g.font = `700 ${size}px ${f.display}`;
    }
    g.fillText(text, w / 2, h / 2 + size * 0.05);
  }).tex;
}
