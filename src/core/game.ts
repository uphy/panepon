import { Board } from "./board";
import type { BoardOptions, Input } from "./types";
import { NO_INPUT } from "./types";

export type GameMode = "endless" | "versus";

export interface GameOptions {
  mode: GameMode;
  seed: number;
  kinds?: number;
  speedLevel?: number;
}

/**
 * 1人用・2人対戦をまとめる。対戦では攻撃を相手の盤面へ回す。
 */
export class Game {
  readonly mode: GameMode;
  readonly boards: Board[];
  /** 対戦の勝者（0 or 1）。未決着は -1。 */
  winner = -1;
  finished = false;

  constructor(opts: GameOptions) {
    this.mode = opts.mode;
    const common: Omit<BoardOptions, "seed"> = {
      kinds: opts.kinds,
      speedLevel: opts.speedLevel,
      speedUp: opts.mode === "endless",
    };
    if (opts.mode === "endless") {
      this.boards = [new Board({ ...common, seed: opts.seed })];
    } else {
      this.boards = [
        new Board({ ...common, seed: opts.seed }),
        new Board({ ...common, seed: opts.seed + 1 }),
      ];
    }
  }

  tick(inputs: Input[]): void {
    if (this.finished) return;
    this.boards.forEach((b, i) => b.tick(inputs[i] ?? NO_INPUT));
    if (this.mode === "versus") {
      const [a, b] = this.boards;
      if (a.attacksOut.length) b.pendingGarbage.push(...a.attacksOut);
      if (b.attacksOut.length) a.pendingGarbage.push(...b.attacksOut);
      if (a.gameOver || b.gameOver) {
        this.finished = true;
        this.winner = a.gameOver && b.gameOver ? -1 : a.gameOver ? 1 : 0;
      }
    } else if (this.boards[0].gameOver) {
      this.finished = true;
    }
  }
}
