import * as THREE from "three";

// Canvas-drawn textures (no network needed). Text textures are redrawn once the
// display font has loaded, so they never stay stuck on a fallback font.

export const DISPLAY_FONT = "var(--font-display)";

let resolvedFamily: string | null = null;
function displayFamily() {
  if (resolvedFamily) return resolvedFamily;
  if (typeof document === "undefined") return "Impact, sans-serif";
  const v = getComputedStyle(document.body).getPropertyValue("--font-display").trim();
  resolvedFamily = v ? `${v}, Impact, sans-serif` : "Impact, sans-serif";
  return resolvedFamily;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function textTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, font: string) => void) {
  const { c, g } = canvas(w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const paint = () => {
    g.clearRect(0, 0, w, h);
    draw(g, displayFamily());
    tex.needsUpdate = true;
  };
  paint();
  if (typeof document !== "undefined" && document.fonts) {
    document.fonts.load(`64px ${displayFamily()}`).then(paint).catch(() => {});
    document.fonts.ready.then(paint).catch(() => {});
  }
  return tex;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Floating badge above each bottle: coloured number + name. */
export function labelTexture(num: number, name: string, hex: string) {
  const W = 640,
    H = 160;
  return textTexture(W, H, (g, font) => {
    g.font = `92px ${font}`;
    const nameW = g.measureText(name.toUpperCase()).width;
    const total = Math.min(W - 8, 150 + nameW + 44);
    const x0 = (W - total) / 2;
    roundRect(g, x0, 14, total, H - 28, 60);
    g.fillStyle = "rgba(10,6,8,0.82)";
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = hex;
    g.stroke();
    // number disc
    g.beginPath();
    g.arc(x0 + 66, H / 2, 52, 0, Math.PI * 2);
    g.fillStyle = hex;
    g.fill();
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `84px ${font}`;
    g.fillText(String(num), x0 + 66, H / 2 + 5);
    g.textAlign = "left";
    g.font = `80px ${font}`;
    g.fillText(name.toUpperCase(), x0 + 134, H / 2 + 5);
  });
}

/** Square plate with a big number (starting gate, podium). */
export function numberPlateTexture(num: number | string, bg: string, fg = "#fff") {
  return textTexture(256, 256, (g, font) => {
    g.fillStyle = bg;
    roundRect(g, 8, 8, 240, 240, 36);
    g.fill();
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `190px ${font}`;
    g.fillText(String(num), 128, 140);
  });
}

export function checkerTexture(cols = 4, rows = 24) {
  const s = 32;
  const { c, g } = canvas(cols * s, rows * s);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 ? "#111" : "#f5f5f5";
      g.fillRect(x * s, y * s, s, s);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.anisotropy = 8;
  return tex;
}

/** Soft round shadow. */
export function blobTexture() {
  const { c, g } = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.75)");
  grd.addColorStop(0.5, "rgba(0,0,0,0.35)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Soft glow disc (white, tint with material colour). */
export function glowTexture() {
  const { c, g } = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Neon text sign. */
export function neonTexture(text: string, color: string, w = 2048, h = 256) {
  return textTexture(w, h, (g, font) => {
    g.textAlign = "center";
    g.textBaseline = "middle";
    let size = h * 0.72;
    g.font = `${size}px ${font}`;
    while (g.measureText(text).width > w * 0.92 && size > 20) {
      size -= 4;
      g.font = `${size}px ${font}`;
    }
    g.shadowColor = color;
    g.shadowBlur = 28;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 6);
    g.shadowBlur = 0;
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillText(text, w / 2, h / 2 + 6);
  });
}

/** Distance pole sign. */
export function markerTexture(text: string, bg: string) {
  return textTexture(256, 160, (g, font) => {
    g.fillStyle = bg;
    roundRect(g, 6, 6, 244, 148, 20);
    g.fill();
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `112px ${font}`;
    g.fillText(text, 128, 86);
  });
}

/** Ground lane number painted just after the gate. */
export function laneNumberTexture(num: number, hex: string) {
  return textTexture(256, 256, (g, font) => {
    g.fillStyle = hex;
    g.globalAlpha = 0.9;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `220px ${font}`;
    g.fillText(String(num), 128, 140);
  });
}
