/**
 * スマホの振動フィードバック。navigator.vibrate() がある端末（Android Chrome など）でだけ動く。
 * iOS Safari は未対応なので何もしない。鳴らす場面は「揃った」「板が落ちた」「危険」「終了」に絞る。
 */
const KEY = "panepon.haptics.v1";

export class Haptics {
  readonly supported: boolean;
  private on = true;
  private lastPanic = 0;

  constructor() {
    this.supported = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
    try {
      this.on = localStorage.getItem(KEY) !== "off";
    } catch {
      this.on = true;
    }
  }

  get enabled(): boolean {
    return this.on;
  }

  setEnabled(v: boolean): void {
    this.on = v;
    try {
      localStorage.setItem(KEY, v ? "on" : "off");
    } catch {
      // 保存できなくても動作には影響しない
    }
    if (v) this.pulse(20);
  }

  toggle(): boolean {
    this.setEnabled(!this.on);
    return this.on;
  }

  private pulse(pattern: number | number[]): void {
    if (!this.supported || !this.on) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // 一部ブラウザはユーザー操作前の呼び出しを例外にする
    }
  }

  /** 揃った瞬間。3枚消しは短く、同時消し・連鎖は規模に応じて長く。 */
  match(panels: number, chain: number): void {
    if (chain >= 5) {
      this.pulse([50, 40, 60]);
      return;
    }
    if (chain >= 2 || panels >= 4) {
      this.pulse(Math.min(60, 20 + (chain - 1) * 10 + Math.max(0, panels - 3) * 5));
      return;
    }
    this.pulse(10);
  }

  /** おじゃまの着地。厚いほど長く。画面の揺れと同期する。 */
  garbageLand(height: number): void {
    this.pulse(Math.min(120, 30 + height * 15));
  }

  /** 天井に触れている間、数秒おきに短く2回。 */
  panic(now: number): void {
    if (now - this.lastPanic < 3000) return;
    this.lastPanic = now;
    this.pulse([30, 60, 30]);
  }

  gameOver(): void {
    this.pulse(200);
  }

  win(): void {
    this.pulse([40, 40, 40, 40, 80]);
  }
}

export const haptics = new Haptics();
