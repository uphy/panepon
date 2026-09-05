/**
 * Web Audio だけで鳴らす BGM のシーケンサ。音声ファイルは使わない。
 * 曲データは tools/bgm-candidates.html から移植したもの。
 * オープニング（メニュー）は「1. ポップ・フェアリー」、ゲーム中は「5. チル・幻想」。
 *
 * 音符列は "c4:2 e4+g4:4 r:2" の形式。長さの単位は16分音符で、省略時は 1。
 * "+" で和音、"r" で休符。ドラムは "x...x..." の形式で、x がヒット、o がオープンハイハット。
 */

type Wave = OscillatorType | "pulse25" | "pulse12";

interface Instrument {
  wave: Wave;
  wave2?: Wave;
  /** wave2 の混ぜる量 */
  mix2?: number;
  /** wave2 のデチューン (cents) */
  detune2?: number;
  gain: number;
  /** ADSR。単位は秒、sustain は比率 */
  a: number;
  d: number;
  s: number;
  r: number;
  /** ローパスのカットオフ (Hz) */
  cutoff: number;
  /** 発音時にカットオフを何倍から下げ始めるか */
  fenv?: number;
  vib?: { rate: number; depth: number; delay: number };
  /** 音符長のうち鳴らす割合 */
  gate: number;
  /** エコーへ送る量 */
  echo: number;
}

type DrumKind = "kick" | "snare" | "hat";

interface NoteEvent {
  freqs: number[];
  len: number;
}
interface DrumEvent {
  drum: DrumKind;
  open: boolean;
}

interface Track {
  events: Map<number, NoteEvent | DrumEvent>;
  total: number;
  inst?: Instrument;
}

interface Song {
  tempo: number;
  /** 1小節の16分音符の数 */
  beat: number;
  /** エコーの遅れ (16分音符の数) */
  echoSteps: number;
  echoFeedback: number;
  drumGain: number;
  tracks: Track[];
}

// ------------------------------------------------------------- 音符

const NOTE_IDX: Record<string, number> = {
  c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, f: 5, "f#": 6, gb: 6, g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11,
};

function noteFreq(name: string): number {
  const m = /^([a-g])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`音名が不正: ${name}`);
  const midi = (Number(m[3]) + 1) * 12 + NOTE_IDX[m[1] + m[2]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function parseSeq(seq: string, inst: Instrument): Track {
  const events = new Map<number, NoteEvent>();
  let step = 0;
  for (const tok of seq.trim().split(/\s+/)) {
    const [body, lenStr] = tok.split(":");
    const len = lenStr === undefined ? 1 : Number(lenStr);
    if (!(len > 0)) throw new Error(`長さが不正: ${tok}`);
    if (body !== "r") events.set(step, { freqs: body.split("+").map(noteFreq), len });
    step += len;
  }
  return { events, total: step, inst };
}

function parseDrum(pat: string, kind: DrumKind): Track {
  const s = pat.replace(/\s+/g, "");
  const events = new Map<number, DrumEvent>();
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "x" || s[i] === "o") events.set(i, { drum: kind, open: s[i] === "o" });
  }
  return { events, total: s.length };
}

function arpSeq(chords: string[][], pattern: number[], perChord: number, len: number): string {
  const out: string[] = [];
  for (const c of chords) {
    for (let i = 0; i < perChord; i++) out.push(`${c[pattern[i % pattern.length] % c.length]}:${len}`);
  }
  return out.join(" ");
}

// ------------------------------------------------------------- 楽器と曲

export type SongName = "menu" | "game";

/** オープニング: C major 132 BPM。跳ねるベースと分散和音の明るい曲。 */
function buildMenuSong(): Song {
  const bassTri: Instrument = { wave: "triangle", wave2: "square", mix2: 0.18, gain: 0.45, a: 0.004, d: 0.12, s: 0.75, r: 0.06, cutoff: 900, fenv: 2, gate: 0.85, echo: 0 };
  const arp: Instrument = { wave: "pulse25", gain: 0.11, a: 0.002, d: 0.09, s: 0.35, r: 0.04, cutoff: 4500, fenv: 1.5, gate: 0.7, echo: 0.35 };
  const lead: Instrument = { wave: "square", gain: 0.15, a: 0.01, d: 0.12, s: 0.75, r: 0.08, cutoff: 3800, vib: { rate: 5.5, depth: 10, delay: 0.12 }, gate: 0.9, echo: 0.3 };
  const chords: Record<string, string[]> = {
    C: ["c4", "e4", "g4", "c5"],
    G: ["g3", "b3", "d4", "g4"],
    Am: ["a3", "c4", "e4", "a4"],
    F: ["f3", "a3", "c4", "f4"],
  };
  // 低い根音・高い根音・5度
  const bass: Record<string, [string, string, string]> = {
    C: ["c2", "c3", "g2"],
    G: ["g2", "g3", "d3"],
    Am: ["a2", "a3", "e3"],
    F: ["f2", "f3", "c3"],
  };
  const bounce = ([lo, hi, fi]: [string, string, string]): string => `${lo}:2 r:2 ${lo}:2 ${hi}:2 ${lo}:2 r:2 ${fi}:2 ${hi}:2`;
  const prog = ["C", "G", "Am", "F", "C", "G", "F", "G"];
  const melody = [
    "e5:2 g5:2 e5:2 c5:2 d5:4 e5:4",
    "d5:2 g5:2 d5:2 b4:2 c5:4 d5:4",
    "e5:2 a5:2 e5:2 c5:2 b4:2 c5:2 d5:4",
    "c5:4 a4:2 f4:2 g4:8",
    "e5:2 g5:2 e5:2 c5:2 d5:4 e5:4",
    "d5:2 g5:2 b5:2 g5:2 d5:2 b4:2 d5:4",
    "f5:4 e5:2 d5:2 c5:2 d5:2 e5:4",
    "g5:4 f5:2 d5:2 b4:4 d5:4",
  ].join(" ");
  return {
    tempo: 132,
    beat: 16,
    echoSteps: 3,
    echoFeedback: 0.35,
    drumGain: 1,
    tracks: [
      parseSeq(prog.map((k) => bounce(bass[k])).join(" "), bassTri),
      parseSeq(arpSeq(prog.map((k) => chords[k]), [0, 1, 2, 3, 2, 1], 16, 1), arp),
      parseSeq(melody, lead),
      parseDrum("x.....x.x.....x.", "kick"),
      parseDrum("....x.......x...", "snare"),
      parseDrum("x.x.x.x.x.x.x.xo", "hat"),
    ],
  };
}

/** ゲーム中: D major 96 BPM。メジャーセブンスのパッドとエコー多めのリード。 */
function buildGameSong(): Song {
  const pad: Instrument = { wave: "pulse25", wave2: "sawtooth", mix2: 0.5, detune2: 9, gain: 0.055, a: 0.5, d: 0.4, s: 0.85, r: 0.6, cutoff: 1600, gate: 0.98, echo: 0.5 };
  const bassSoft: Instrument = { wave: "triangle", gain: 0.45, a: 0.01, d: 0.2, s: 0.8, r: 0.15, cutoff: 600, gate: 0.95, echo: 0.1 };
  const arp: Instrument = { wave: "pulse25", gain: 0.11, a: 0.002, d: 0.09, s: 0.35, r: 0.04, cutoff: 4500, fenv: 1.5, gate: 0.7, echo: 0.35 };
  const lead: Instrument = { wave: "sine", wave2: "triangle", mix2: 0.35, gain: 0.3, a: 0.03, d: 0.2, s: 0.8, r: 0.3, cutoff: 4000, vib: { rate: 4.5, depth: 12, delay: 0.25 }, gate: 0.95, echo: 0.55 };
  // 2小節ずつ D - Bm - G - A
  const chords: Record<string, string[]> = {
    D: ["d4", "f#4", "a4", "c#5"],
    Bm: ["b3", "d4", "f#4", "a4"],
    G: ["g3", "b3", "d4", "f#4"],
    A: ["a3", "c#4", "e4", "g4"],
  };
  const bass: Record<string, string> = {
    D: "d2:6 r:2 d2:4 r:4 a2:6 r:2 d2:8",
    Bm: "b1:6 r:2 b1:4 r:4 f#2:6 r:2 b1:8",
    G: "g2:6 r:2 g2:4 r:4 d3:6 r:2 g2:8",
    A: "a2:6 r:2 a2:4 r:4 e3:6 r:2 a2:8",
  };
  const prog = ["D", "Bm", "G", "A"];
  const melody = [
    "r:4 f#5:4 a5:4 c#6:8 b5:4 a5:8",
    "r:4 d6:4 c#6:4 b5:8 f#5:4 a5:8",
    "r:4 b5:4 a5:4 g5:8 f#5:4 e5:8",
    "r:4 a5:4 g5:4 e5:8 c#5:4 e5:8",
  ].join(" ");
  return {
    tempo: 96,
    beat: 16,
    echoSteps: 3,
    echoFeedback: 0.45,
    drumGain: 0.6,
    tracks: [
      parseSeq(prog.map((k) => `${chords[k].join("+")}:32`).join(" "), pad),
      parseSeq(prog.map((k) => bass[k]).join(" "), bassSoft),
      parseSeq(arpSeq(prog.map((k) => chords[k]), [0, 1, 2, 3, 2, 1], 16, 2), arp),
      parseSeq(melody, lead),
      parseDrum("x.......x.x.....", "kick"),
      parseDrum("....x.......x...", "snare"),
      parseDrum("..x...x...x...x.", "hat"),
    ],
  };
}

// ------------------------------------------------------------- 再生

/** デューティ比 duty のパルス波。SFC 風の細い音に使う。 */
export function makePulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 48;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

export class BgmPlayer {
  private readonly songs: Record<SongName, Song> = { menu: buildMenuSong(), game: buildGameSong() };
  private song: Song = this.songs.game;
  private current: SongName | null = null;
  private readonly out: GainNode;
  private readonly echoIn: GainNode;
  private readonly delay: DelayNode;
  private readonly feedback: GainNode;
  private readonly waves: Record<string, PeriodicWave>;
  private readonly noiseBuf: AudioBuffer;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private tempoScale = 1;

  constructor(
    private readonly ctx: AudioContext,
    dest: AudioNode,
  ) {
    // SFC の音の丸さを出すために高域を削る
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 9000;
    tone.Q.value = 0.5;
    tone.connect(dest);
    this.out = ctx.createGain();
    this.out.connect(tone);

    // SPC700 風のフィードバックエコー
    this.echoIn = ctx.createGain();
    this.delay = ctx.createDelay(2);
    const fb = ctx.createGain();
    this.feedback = fb;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = "lowpass";
    fbFilter.frequency.value = 3000;
    this.echoIn.connect(this.delay);
    this.delay.connect(fbFilter);
    fbFilter.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.out);

    this.waves = { pulse25: makePulseWave(ctx, 0.25), pulse12: makePulseWave(ctx, 0.125) };
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** 再生中の曲。止まっていれば null。 */
  get playing(): SongName | null {
    return this.current;
  }

  start(name: SongName): void {
    if (this.current === name) return;
    this.stop();
    this.current = name;
    this.song = this.songs[name];
    this.feedback.gain.value = this.song.echoFeedback;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.current = null;
  }

  /** 危険状態でテンポを速くする。 */
  setDanger(on: boolean): void {
    this.tempoScale = on ? 1.3 : 1;
  }

  private tick(): void {
    const ctx = this.ctx;
    const song = this.song;
    const stepDur = 60 / (song.tempo * this.tempoScale) / 4;
    this.delay.delayTime.setTargetAtTime(stepDur * song.echoSteps, ctx.currentTime, 0.05);
    while (this.nextTime < ctx.currentTime + 0.12) {
      const t = this.nextTime;
      for (const tr of song.tracks) {
        const ev = tr.events.get(this.step % tr.total);
        if (!ev) continue;
        if ("drum" in ev) {
          this.playDrum(ev.drum, ev.open, t, song.drumGain);
        } else if (tr.inst) {
          const dur = ev.len * stepDur * tr.inst.gate;
          for (const f of ev.freqs) this.playNote(tr.inst, f, t, dur);
        }
      }
      this.nextTime += stepDur;
      this.step++;
    }
    this.timer = window.setTimeout(() => this.tick(), 30);
  }

  private makeOsc(wave: Wave, freq: number, t0: number): OscillatorNode {
    const osc = this.ctx.createOscillator();
    const pw = this.waves[wave];
    if (pw) osc.setPeriodicWave(pw);
    else osc.type = wave as OscillatorType;
    osc.frequency.setValueAtTime(freq, t0);
    return osc;
  }

  private playNote(inst: Instrument, freq: number, t0: number, dur: number): void {
    const ctx = this.ctx;
    const env = ctx.createGain();
    const peak = inst.gain;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + inst.a);
    const tDec = t0 + inst.a + inst.d;
    env.gain.linearRampToValueAtTime(peak * inst.s, tDec);
    const tRel = Math.max(t0 + dur, tDec);
    env.gain.setValueAtTime(peak * inst.s, tRel);
    env.gain.linearRampToValueAtTime(0, tRel + inst.r);
    const tEnd = tRel + inst.r;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.8;
    if (inst.fenv) {
      filter.frequency.setValueAtTime(Math.min(18000, inst.cutoff * inst.fenv), t0);
      filter.frequency.exponentialRampToValueAtTime(inst.cutoff, t0 + inst.d);
    } else {
      filter.frequency.value = inst.cutoff;
    }

    const oscs = [this.makeOsc(inst.wave, freq, t0)];
    const mix1 = ctx.createGain();
    mix1.gain.value = inst.wave2 ? 1 - (inst.mix2 ?? 0) * 0.5 : 1;
    oscs[0].connect(mix1);
    mix1.connect(filter);
    if (inst.wave2) {
      const o2 = this.makeOsc(inst.wave2, freq, t0);
      if (inst.detune2) o2.detune.value = inst.detune2;
      const mix2 = ctx.createGain();
      mix2.gain.value = inst.mix2 ?? 0.5;
      o2.connect(mix2);
      mix2.connect(filter);
      oscs.push(o2);
    }
    if (inst.vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = inst.vib.rate;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t0);
      lg.gain.linearRampToValueAtTime(inst.vib.depth, t0 + inst.vib.delay + 0.15);
      lfo.connect(lg);
      for (const o of oscs) lg.connect(o.detune);
      lfo.start(t0);
      lfo.stop(tEnd + 0.05);
    }
    filter.connect(env);
    env.connect(this.out);
    if (inst.echo) {
      const send = ctx.createGain();
      send.gain.value = inst.echo;
      env.connect(send);
      send.connect(this.echoIn);
    }
    for (const o of oscs) {
      o.start(t0);
      o.stop(tEnd + 0.05);
    }
  }

  private noiseVoice(t0: number, dur: number, type: BiquadFilterType, freq: number, gain: number, echo = 0): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.out);
    if (echo) {
      const send = ctx.createGain();
      send.gain.value = echo;
      g.connect(send);
      send.connect(this.echoIn);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  private toneVoice(t0: number, dur: number, type: OscillatorType, f0: number, f1: number, gain: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private playDrum(kind: DrumKind, open: boolean, t0: number, level: number): void {
    switch (kind) {
      case "kick":
        this.toneVoice(t0, 0.28, "sine", 160, 45, 0.9 * level);
        this.noiseVoice(t0, 0.015, "lowpass", 2500, 0.3 * level);
        break;
      case "snare":
        this.noiseVoice(t0, 0.16, "bandpass", 1800, 0.45 * level, 0.3);
        this.toneVoice(t0, 0.08, "triangle", 190, 0, 0.3 * level);
        break;
      case "hat":
        this.noiseVoice(t0, open ? 0.3 : 0.045, "highpass", 7500, 0.22 * level, open ? 0.2 : 0);
        break;
    }
  }
}
