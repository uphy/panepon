/**
 * Web Audio だけで鳴らす効果音とBGM。音声ファイルは使わない。
 * AudioContext はユーザー操作のあとに resume する必要があるので、start() を入力時に呼ぶ。
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private tempo = 126;
  private bgmOn = false;
  muted = false;

  start(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.5;
    this.bgmGain.connect(this.master);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    gain = 0.25,
    when = 0,
    dest: AudioNode | null = this.master,
    slideTo?: number,
  ): void {
    if (!this.ctx || !dest) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, gain = 0.2, when = 0, lowpass = 800): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  // ------------------------------------------------------------- 効果音

  swap(): void {
    this.tone(880, 0.04, "square", 0.08);
  }

  move(): void {
    this.tone(1320, 0.02, "square", 0.04);
  }

  /** 消える音。同じ消去内で index が増えるほど音が高くなる。 */
  pop(index: number): void {
    const f = 520 * Math.pow(1.06, index);
    this.tone(f, 0.09, "square", 0.18, 0, this.master, f * 1.5);
  }

  /** 揃った瞬間の音。連鎖数・同時消し数で音程が上がる。 */
  match(panels: number, chain: number): void {
    const base = 440 * Math.pow(1.12, Math.min(12, chain - 1) + (panels >= 4 ? 1 : 0));
    this.tone(base, 0.08, "triangle", 0.2);
    if (chain >= 2 || panels >= 4) {
      // ファンファーレ風のアルペジオ
      [1, 1.25, 1.5, 2].forEach((m, i) => this.tone(base * m, 0.12, "square", 0.14, 0.05 + i * 0.05));
    }
  }

  land(): void {
    this.tone(160, 0.04, "triangle", 0.08);
  }

  garbageLand(height: number): void {
    this.noise(0.12 + height * 0.04, 0.3 + Math.min(0.4, height * 0.05), 0, 400);
    this.tone(70, 0.2, "sine", 0.3);
  }

  garbageTransform(): void {
    [0, 1, 2].forEach((i) => this.tone(330 + i * 110, 0.08, "square", 0.1, i * 0.06));
  }

  attack(): void {
    this.tone(220, 0.15, "sawtooth", 0.12, 0, this.master, 110);
  }

  gameOver(): void {
    this.stopBgm();
    [0, 1, 2, 3].forEach((i) => this.tone(440 / Math.pow(1.3, i), 0.3, "square", 0.2, i * 0.22));
  }

  select(): void {
    this.tone(660, 0.06, "square", 0.12);
    this.tone(990, 0.1, "square", 0.12, 0.06);
  }

  // ---------------------------------------------------------------- BGM

  private static readonly BASS = [0, 0, 7, 7, 5, 5, 3, 3, 0, 0, 7, 7, 8, 8, 10, 10];
  private static readonly LEAD = [12, 14, 16, 19, 16, 14, 12, 7, 12, 14, 16, 19, 20, 19, 16, 14];

  startBgm(): void {
    if (!this.ctx || this.bgmOn) return;
    this.bgmOn = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    const schedule = (): void => {
      if (!this.ctx || !this.bgmOn) return;
      const beat = 60 / this.tempo / 2; // 8分音符
      while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
        const i = this.step % 16;
        const when = this.nextNoteTime - this.ctx.currentTime;
        const root = 110; // A2
        const bass = root * Math.pow(2, GameAudio.BASS[i] / 12);
        this.tone(bass, beat * 0.9, "triangle", 0.22, when, this.bgmGain);
        if (this.step % 2 === 0 || this.tempo > 140) {
          const lead = root * 2 * Math.pow(2, GameAudio.LEAD[i] / 12);
          this.tone(lead, beat * 0.6, "square", 0.07, when, this.bgmGain);
        }
        if (i % 4 === 0) this.noise(0.05, 0.08, when, 2000);
        this.nextNoteTime += beat;
        this.step++;
      }
      this.bgmTimer = window.setTimeout(schedule, 50);
    };
    schedule();
  }

  stopBgm(): void {
    this.bgmOn = false;
    if (this.bgmTimer !== null) window.clearTimeout(this.bgmTimer);
    this.bgmTimer = null;
  }

  private bgmBeforeSuspend = false;

  /** 画面が隠れたときに呼ぶ。BGM のスケジューラを止め、AudioContext も止めて音を出さない。 */
  suspend(): void {
    this.bgmBeforeSuspend = this.bgmOn;
    this.stopBgm();
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  /** 画面に戻って再開するときに呼ぶ。止める前に BGM が鳴っていたら鳴らし直す。 */
  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    if (this.bgmBeforeSuspend) this.startBgm();
    this.bgmBeforeSuspend = false;
  }

  /** 危険状態でテンポを速くする。 */
  setDanger(on: boolean): void {
    this.tempo = on ? 172 : 126;
  }
}
