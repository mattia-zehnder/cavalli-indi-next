// All sounds are synthesised with WebAudio (no files to load, works offline).
// The commentary voice uses the browser's Italian speech synthesis, if any.

type Note = { f: number; t: number; d: number };

export class RaceAudio {
  sound = true;
  voice = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private crowdGain: GainNode | null = null;
  private itVoice: SpeechSynthesisVoice | null = null;

  configure({ sound, voice }: { sound: boolean; voice: boolean }) {
    this.sound = sound;
    this.voice = voice;
    if (!voice) this.hush();
    if (!sound) this.crowd(0, 0.2);
  }

  /** Must be called from a user gesture (click / key press) the first time. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startCrowdBed();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.pickVoice();
  }

  private pickVoice() {
    if (typeof speechSynthesis === "undefined") return;
    const choose = () => {
      const voices = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("it"));
      const pref = ["Google", "Luca", "Alice", "Federica", "Paola", "Emma"];
      this.itVoice =
        pref.map((p) => voices.find((v) => v.name.includes(p))).find(Boolean) ?? voices[0] ?? null;
    };
    choose();
    if (!this.itVoice) speechSynthesis.onvoiceschanged = choose;
  }

  private ready() {
    return this.sound && this.ctx && this.master ? { ctx: this.ctx, out: this.master } : null;
  }

  private tone(
    f: number,
    start: number,
    dur: number,
    { type = "sine" as OscillatorType, vol = 0.18, attack = 0.01, glideTo = 0 } = {},
  ) {
    const a = this.ready();
    if (!a) return;
    const { ctx, out } = a;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(start: number, dur: number, { vol = 0.3, hp = 800, lp = 12000, attack = 0.002 } = {}) {
    const a = this.ready();
    if (!a || !this.noiseBuf) return;
    const { ctx, out } = a;
    const t0 = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const h = ctx.createBiquadFilter();
    h.type = "highpass";
    h.frequency.value = hp;
    const l = ctx.createBiquadFilter();
    l.type = "lowpass";
    l.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(h).connect(l).connect(g).connect(out);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  /** Continuous crowd murmur; its level is driven by `crowd()`. */
  private startCrowdBed() {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    // slow wobble so it sounds like many voices rather than hiss
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.7;
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(band.frequency);
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.0001;
    src.connect(band).connect(lp).connect(this.crowdGain).connect(this.master);
    src.start();
    lfo.start();
  }

  /** Crowd level 0..1. */
  crowd(level: number, smoothing = 0.6) {
    if (!this.ctx || !this.crowdGain) return;
    const v = this.sound ? Math.max(0.0001, level * 0.5) : 0.0001;
    this.crowdGain.gain.setTargetAtTime(v, this.ctx.currentTime, smoothing);
  }

  private brass(notes: Note[], vol = 0.07) {
    for (const n of notes) {
      this.tone(n.f, n.t, n.d, { type: "sawtooth", vol, attack: 0.03 });
      this.tone(n.f * 2, n.t, n.d, { type: "square", vol: vol * 0.2, attack: 0.03 });
    }
  }

  // ---- public cues ---------------------------------------------------------

  /** Bugle call when the runners go to the post. */
  bugle() {
    const G4 = 392, C5 = 523.25, E5 = 659.25, G5 = 783.99;
    const q = 0.14;
    this.brass([
      { f: G4, t: 0, d: q },
      { f: C5, t: q, d: q },
      { f: E5, t: 2 * q, d: q },
      { f: G5, t: 3 * q, d: q * 2.2 },
      { f: E5, t: 5.4 * q, d: q },
      { f: G5, t: 6.4 * q, d: q * 4 },
    ]);
    this.crowd(0.12, 1.5);
  }

  /** Stalls open: starter's bell + clang of the gates. */
  go() {
    // electric bell: inharmonic partials with a fast tremolo
    for (let k = 0; k < 18; k++) {
      const t = k * 0.045;
      for (const [f, v] of [
        [2120, 0.05],
        [3310, 0.025],
        [4870, 0.012],
      ] as const)
        this.tone(f, t, 0.05, { vol: v, attack: 0.002 });
    }
    this.noise(0, 0.3, { vol: 0.45, hp: 200, lp: 3500 });
    this.tone(120, 0, 0.3, { type: "triangle", vol: 0.35, glideTo: 45 });
    this.crowd(0.35, 0.3);
  }

  /** One galloping stride: four muffled hoof-falls. */
  stride(strength: number) {
    if (strength <= 0.02) return;
    [0, 0.055, 0.13, 0.19].forEach((o, k) => {
      const t = o + Math.random() * 0.012;
      const accent = k === 3 ? 1.2 : 1;
      this.noise(t, 0.06, { vol: 0.16 * strength * accent, hp: 60, lp: 700, attack: 0.003 });
      this.tone(85 + Math.random() * 15, t, 0.07, { vol: 0.12 * strength, attack: 0.003, glideTo: 50 });
    });
    this.crowd(0.25 + strength * 0.75, 0.5);
  }

  shutter() {
    this.noise(0, 0.05, { vol: 0.6, hp: 2000 });
    this.noise(0.09, 0.07, { vol: 0.5, hp: 1500 });
  }

  /** Winner crosses the line: the crowd roars, then applauds. */
  finish() {
    this.crowd(1, 0.15);
    for (let k = 0; k < 70; k++) {
      this.noise(0.4 + Math.random() * 3.2, 0.03, { vol: 0.08 + Math.random() * 0.06, hp: 1200, lp: 6000 });
    }
    if (this.ctx && this.crowdGain && this.sound) {
      this.crowdGain.gain.setTargetAtTime(0.06, this.ctx.currentTime + 2.5, 1.5);
    }
  }

  /** Back to a quiet murmur between races. */
  settle() {
    this.crowd(0.06, 2);
  }

  say(text: string, urgent = false) {
    if (!this.voice || typeof speechSynthesis === "undefined") return;
    if (urgent || speechSynthesis.speaking) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    if (this.itVoice) u.voice = this.itVoice;
    u.rate = 1.1;
    u.pitch = 1;
    speechSynthesis.speak(u);
  }

  hush() {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }
}
