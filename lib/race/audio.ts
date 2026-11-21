// All sounds are synthesised with WebAudio (no files to load, works offline).
// The commentary voice uses the browser's Italian speech synthesis, if any.

type Note = { f: number; t: number; d: number };

export class RaceAudio {
  sound = true;
  voice = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private itVoice: SpeechSynthesisVoice | null = null;

  configure({ sound, voice }: { sound: boolean; voice: boolean }) {
    this.sound = sound;
    this.voice = voice;
    if (!voice) this.hush();
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
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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

  get hasVoice() {
    return typeof speechSynthesis !== "undefined";
  }

  private ready() {
    return this.sound && this.ctx && this.master ? { ctx: this.ctx, out: this.master } : null;
  }

  private tone(
    f: number,
    start: number,
    dur: number,
    { type = "square" as OscillatorType, vol = 0.18, attack = 0.01, glideTo = 0 } = {},
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

  private noise(start: number, dur: number, { vol = 0.3, hp = 800, lp = 12000 } = {}) {
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
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(h).connect(l).connect(g).connect(out);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  private brass(notes: Note[], vol = 0.09) {
    for (const n of notes) {
      this.tone(n.f, n.t, n.d, { type: "sawtooth", vol, attack: 0.03 });
      this.tone(n.f * 2, n.t, n.d, { type: "square", vol: vol * 0.25, attack: 0.03 });
    }
  }

  // ---- public cues ---------------------------------------------------------

  /** Little bugle call when the bottles go to the gate. */
  bugle() {
    const G4 = 392, C5 = 523.25, E5 = 659.25, G5 = 783.99;
    const q = 0.13;
    this.brass([
      { f: G4, t: 0, d: q },
      { f: C5, t: q, d: q },
      { f: E5, t: 2 * q, d: q },
      { f: G5, t: 3 * q, d: q * 2.2 },
      { f: E5, t: 5.4 * q, d: q },
      { f: G5, t: 6.4 * q, d: q * 4 },
    ]);
  }

  countdown(n: number) {
    this.tone(n > 0 ? 660 : 1320, 0, n > 0 ? 0.16 : 0.6, { vol: 0.16 });
  }

  go() {
    this.countdown(0);
    // starting gate clank + gun
    this.noise(0, 0.25, { vol: 0.5, hp: 300, lp: 4000 });
    this.tone(140, 0, 0.25, { type: "triangle", vol: 0.4, glideTo: 50 });
  }

  beat(strength: number) {
    this.tone(110, 0, 0.18, { type: "sine", vol: 0.35 * strength, attack: 0.004, glideTo: 42 });
    this.tone(90, 0.11, 0.16, { type: "sine", vol: 0.2 * strength, attack: 0.004, glideTo: 40 });
  }

  bell() {
    for (const [f, v] of [
      [1318.5, 0.14],
      [2637, 0.06],
      [3951, 0.03],
    ] as const)
      this.tone(f, 0, 1.4, { type: "sine", vol: v, attack: 0.002 });
  }

  shutter() {
    this.noise(0, 0.05, { vol: 0.6, hp: 2000 });
    this.noise(0.09, 0.07, { vol: 0.5, hp: 1500 });
  }

  fanfare() {
    const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
    const q = 0.12;
    this.brass(
      [
        { f: C5, t: 0, d: q },
        { f: E5, t: q, d: q },
        { f: G5, t: 2 * q, d: q },
        { f: C6, t: 3 * q, d: q * 2 },
        { f: G5, t: 5 * q, d: q },
        { f: C6, t: 6 * q, d: q * 6 },
      ],
      0.1,
    );
    // cheering-ish noise swell
    this.noise(0.3, 2.2, { vol: 0.08, hp: 600, lp: 3000 });
  }

  say(text: string, urgent = false) {
    if (!this.voice || typeof speechSynthesis === "undefined") return;
    if (urgent || speechSynthesis.speaking) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    if (this.itVoice) u.voice = this.itVoice;
    u.rate = 1.12;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  }

  hush() {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }
}
