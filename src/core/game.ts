import { CpuPlayer, type CpuLevel } from "./ai";
import { Board } from "./board";
import { DEFAULT_SHOCK_MAX, TIME_ATTACK_FRAMES } from "./constants";
import type { BoardOptions, Input } from "./types";
import { NO_INPUT } from "./types";

/**
 * endless: 1人用。timeattack: 1人用で制限時間内の得点を競う。
 * versus: 2人対戦。cpu: 2P側を CpuPlayer が操作する対戦。
 */
export type GameMode = "endless" | "timeattack" | "versus" | "cpu";

export interface GameOptions {
  mode: GameMode;
  seed: number;
  kinds?: number;
  speedLevel?: number;
  cpuLevel?: CpuLevel;
  /** 対戦でのビックリパネルの上限枚数。省略時は DEFAULT_SHOCK_MAX、0 で出さない。 */
  shockMax?: number;
  /** タイムアタックの制限時間（フレーム）。省略時は TIME_ATTACK_FRAMES。 */
  timeLimitFrames?: number;
}

/**
 * 1人用・2人対戦をまとめる。対戦では攻撃を相手の盤面へ回す。
 */
export class Game {
  readonly mode: GameMode;
  readonly boards: Board[];
  readonly cpu: CpuPlayer | null = null;
  /** 対戦の勝者（0 or 1）。未決着は -1。 */
  winner = -1;
  finished = false;
  /** タイムアタックの制限時間（フレーム）。他のモードは null。 */
  readonly timeLimit: number | null;
  /** タイムアタックで時間切れになったか。天井に届いて終わったときは false。 */
  timeUp = false;

  constructor(opts: GameOptions) {
    this.mode = opts.mode;
    this.timeLimit = opts.mode === "timeattack" ? (opts.timeLimitFrames ?? TIME_ATTACK_FRAMES) : null;
    const common: Omit<BoardOptions, "seed"> = {
      kinds: opts.kinds,
      speedLevel: opts.speedLevel,
      speedUp: opts.mode === "endless" || opts.mode === "timeattack",
    };
    if (opts.mode === "endless" || opts.mode === "timeattack") {
      this.boards = [new Board({ ...common, seed: opts.seed })];
    } else {
      const shockMax = opts.shockMax ?? DEFAULT_SHOCK_MAX;
      this.boards = [
        new Board({ ...common, seed: opts.seed, shockMax }),
        new Board({ ...common, seed: opts.seed + 1, shockMax }),
      ];
      if (opts.mode === "cpu") this.cpu = new CpuPlayer(this.boards[1], opts.cpuLevel ?? "normal");
    }
  }

  tick(inputs: Input[]): void {
    if (this.finished) return;
    const resolved = this.boards.map((_, i) => inputs[i] ?? NO_INPUT);
    if (this.cpu) resolved[1] = this.cpu.next();
    this.boards.forEach((b, i) => b.tick(resolved[i]));
    if (this.boards.length === 2) {
      const [a, b] = this.boards;
      if (a.attacksOut.length) b.pendingGarbage.push(...a.attacksOut);
      if (b.attacksOut.length) a.pendingGarbage.push(...b.attacksOut);
      if (a.gameOver || b.gameOver) {
        this.finished = true;
        this.winner = a.gameOver && b.gameOver ? -1 : a.gameOver ? 1 : 0;
      }
    } else if (this.boards[0].gameOver) {
      this.finished = true;
    } else if (this.timeLimit !== null && this.boards[0].frame >= this.timeLimit) {
      this.finished = true;
      this.timeUp = true;
    }
  }

  /** タイムアタックの残りフレーム。他のモードは null。 */
  get framesLeft(): number | null {
    if (this.timeLimit === null) return null;
    return Math.max(0, this.timeLimit - this.boards[0].frame);
  }
}
