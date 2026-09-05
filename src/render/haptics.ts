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

  /** 直近の navigator.vibrate() の戻り値。false はブラウザが拒否した（未操作・非対応など）ことを示す。 */
  lastResult: boolean | null = null;

  setEnabled(v: boolean): void {
    this.on = v;
    try {
      localStorage.setItem(KEY, v ? "on" : "off");
    } catch {
      // 保存できなくても動作には影響しない
    }
    // 切り替え時の確認用。端末が振動に対応しているかを、これで確かめられる長さにする
    if (v) this.pulse(150);
  }

  toggle(): boolean {
    this.setEnabled(!this.on);
    return this.on;
  }

  private pulse(pattern: number | number[]): void {
    if (!this.supported || !this.on) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      this.lastResult = navigator.vibrate(pattern);
    } catch {
      // 一部ブラウザはユーザー操作前の呼び出しを例外にする
      this.lastResult = false;
    }
  }

  /**
   * 揃った瞬間。3枚消しは短く、同時消し・連鎖は規模に応じて長く。
   * Android のモーターは 20ms 未満だとほぼ感じないので、最短でも 25ms にする。
   */
  match(panels: number, chain: number): void {
    if (chain >= 5) {
      this.pulse([70, 50, 90]);
      return;
    }
    if (chain >= 2 || panels >= 4) {
      this.pulse(Math.min(90, 40 + (chain - 1) * 12 + Math.max(0, panels - 3) * 8));
      return;
    }
    this.pulse(25);
  }

  /** おじゃまの着地。厚いほど長く。画面の揺れと同期する。 */
  garbageLand(height: number): void {
    this.pulse(Math.min(160, 50 + height * 20));
  }

  /** 天井に触れている間、数秒おきに短く2回。 */
  panic(now: number): void {
    if (now - this.lastPanic < 3000) return;
    this.lastPanic = now;
    this.pulse([45, 70, 45]);
  }

  gameOver(): void {
    this.pulse(250);
  }

  win(): void {
    this.pulse([50, 40, 50, 40, 120]);
  }
}

export const haptics = new Haptics();
