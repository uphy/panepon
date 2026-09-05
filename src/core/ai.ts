import { Board } from "./board";
import { COLS, ROWS } from "./constants";
import { EMPTY, NO_INPUT, type Input } from "./types";

export type CpuLevel = "easy" | "normal" | "hard";

interface CpuParams {
  /** 次の手を考え始めるまでの待ち（フレーム）。 */
  thinkDelay: number;
  /** カーソルを1マス動かす間隔（フレーム）。 */
  moveInterval: number;
  /** 盤面の最大高さがこれ未満なら手動せり上げで盤面を育てる。 */
  raiseBelow: number;
  /** 1手先の連鎖を読むか。 */
  lookahead: boolean;
  /** 揃わない手（仕込み）も打つか。 */
  setup: boolean;
}

export const CPU_PARAMS: Record<CpuLevel, CpuParams> = {
  easy: { thinkDelay: 50, moveInterval: 10, raiseBelow: 3, lookahead: false, setup: false },
  normal: { thinkDelay: 24, moveInterval: 6, raiseBelow: 4, lookahead: true, setup: true },
  hard: { thinkDelay: 8, moveInterval: 3, raiseBelow: 5, lookahead: true, setup: true },
};

/** 評価用の盤面。柄は 0 以上、空は EMPTY、動けないもの（落下中・おじゃま）は BLOCK、消去中は CLEARING。 */
const BLOCK = -2;
const GARBAGE = -3;
const CLEARING = -4;
type Grid = number[][];

interface Move {
  x: number;
  y: number;
  score: number;
}

function snapshot(board: Board): Grid {
  const g: Grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) {
      const cell = board.cells[r][c];
      if (cell.garbage >= 0) row.push(GARBAGE);
      else if (cell.kind === EMPTY) row.push(EMPTY);
      else if (cell.state === "idle") row.push(cell.kind);
      else if (cell.state === "matched" || cell.state === "popped") row.push(CLEARING);
      else row.push(BLOCK);
    }
    g.push(row);
  }
  return g;
}

function clone(g: Grid): Grid {
  return g.map((row) => row.slice());
}

function hasClearing(g: Grid): boolean {
  return g.some((row) => row.includes(CLEARING));
}

/**
 * 消去中のパネルが消えたあとの盤面を作る。消えたパネルの上に乗っていたパネル（＝落ちて連鎖フラグが付くもの）を
 * flags に記録しながら落とす。アクティブ連鎖の読みに使う。
 */
function futureAfterClear(g: Grid): { grid: Grid; flags: boolean[][] } {
  const grid = clone(g);
  const flags: boolean[][] = grid.map((row) => row.map(() => false));
  for (let c = 0; c < COLS; c++) {
    let above = false;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] === CLEARING) {
        grid[r][c] = EMPTY;
        above = true;
      } else if (above && grid[r][c] >= 0) {
        flags[r][c] = true;
      } else if (grid[r][c] === EMPTY || grid[r][c] === GARBAGE || grid[r][c] === BLOCK) {
        above = false;
      }
    }
    let moved = true;
    while (moved) {
      moved = false;
      for (let r = 1; r < ROWS; r++) {
        if (grid[r][c] >= 0 && grid[r - 1][c] === EMPTY) {
          grid[r - 1][c] = grid[r][c];
          grid[r][c] = EMPTY;
          flags[r - 1][c] = flags[r][c];
          flags[r][c] = false;
          moved = true;
        }
      }
    }
  }
  return { grid, flags };
}

/** 柄のパネルだけを落とす。BLOCK とおじゃまは動かない。 */
function settle(g: Grid, cols: number[]): void {
  for (const c of cols) {
    let moved = true;
    while (moved) {
      moved = false;
      for (let r = 1; r < ROWS; r++) {
        if (g[r][c] >= 0 && g[r - 1][c] === EMPTY) {
          g[r - 1][c] = g[r][c];
          g[r][c] = EMPTY;
          moved = true;
        }
      }
    }
  }
}

/** 揃っているマスの一覧。 */
function findMatches(g: Grid): { x: number; y: number }[] {
  const set = new Set<number>();
  for (let y = 0; y < ROWS; y++) {
    let x = 0;
    while (x < COLS) {
      const k = g[y][x];
      if (k < 0) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < COLS && g[y][end] === k) end++;
      if (end - x >= 3) for (let i = x; i < end; i++) set.add(y * COLS + i);
      x = end;
    }
  }
  for (let x = 0; x < COLS; x++) {
    let y = 0;
    while (y < ROWS) {
      const k = g[y][x];
      if (k < 0) {
        y++;
        continue;
      }
      let end = y + 1;
      while (end < ROWS && g[end][x] === k) end++;
      if (end - y >= 3) for (let i = y; i < end; i++) set.add(i * COLS + x);
      y = end;
    }
  }
  return [...set].map((k) => ({ x: k % COLS, y: Math.floor(k / COLS) }));
}

function touchesGarbage(g: Grid, cells: { x: number; y: number }[]): boolean {
  for (const { x, y } of cells) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (g[ny][nx] === GARBAGE) return true;
    }
  }
  return false;
}

/** 「あと1枚で揃う」形の数。仕込みの良さの目安。 */
function potential(g: Grid): number {
  let p = 0;
  const windows: number[][] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x + 2 < COLS; x++) windows.push([g[y][x], g[y][x + 1], g[y][x + 2]]);
  for (let x = 0; x < COLS; x++) for (let y = 0; y + 2 < ROWS; y++) windows.push([g[y][x], g[y + 1][x], g[y + 2][x]]);
  for (const w of windows) {
    const kinds = w.filter((k) => k >= 0);
    if (kinds.length < 2) continue;
    const [a, b, c] = w;
    const same = (a >= 0 && a === b) || (b >= 0 && b === c) || (a >= 0 && a === c);
    if (!same) continue;
    if (kinds.length === 2) p += 2;
    else if (!(a === b && b === c)) p += 1;
  }
  return p;
}

function maxHeight(board: Board): number {
  let h = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - 1; r >= 0; r--) {
      const cell = board.cells[r][c];
      if (cell.kind !== EMPTY || cell.garbage >= 0) {
        h = Math.max(h, r + 1);
        break;
      }
    }
  }
  return h;
}

/**
 * CPU プレイヤー。Board を読んで1フレーム分の Input を返す。
 * カーソルは人と同じく1マスずつ動かし、入れ替えもカーソル位置でしか行わない。
 */
export class CpuPlayer {
  private readonly p: CpuParams;
  private target: { x: number; y: number } | null = null;
  private wait = 0;
  private moveTimer = 0;
  private raising = false;
  private lastSwap: { x: number; y: number; frame: number } | null = null;
  /** 仕込んだアクティブ連鎖で揃う予定のマス（消去後の位置）。消去中はこれを壊す手を打たない。 */
  private plan: { x: number; y: number }[] | null = null;

  constructor(
    private readonly board: Board,
    readonly level: CpuLevel,
  ) {
    this.p = CPU_PARAMS[level];
    this.wait = this.p.thinkDelay;
  }

  next(): Input {
    const b = this.board;
    if (b.gameOver) return NO_INPUT;
    const danger = maxHeight(b) >= ROWS - 3;

    if (this.target) {
      const { x, y } = this.target;
      if (b.cursor.x === x && b.cursor.y === y) {
        this.target = null;
        this.wait = danger ? Math.min(this.p.thinkDelay, 6) : this.p.thinkDelay;
        this.lastSwap = { x, y, frame: b.frame };
        return { ...NO_INPUT, swap: true };
      }
      if (++this.moveTimer < this.p.moveInterval) return NO_INPUT;
      this.moveTimer = 0;
      return {
        ...NO_INPUT,
        moveX: Math.sign(x - b.cursor.x) as -1 | 0 | 1,
        moveY: Math.sign(y - b.cursor.y) as -1 | 0 | 1,
      };
    }

    if (this.wait > 0) {
      this.wait--;
      return { ...NO_INPUT, raise: this.raising && !danger };
    }

    const move = this.pickMove(danger);
    if (move) {
      this.target = { x: move.x, y: move.y };
      this.raising = false;
      this.moveTimer = this.p.moveInterval;
      return this.next();
    }

    // 打つ手がないときは、盤面が低ければせり上げて材料を増やす
    const h = maxHeight(b);
    this.raising = !danger && h < this.p.raiseBelow;
    this.wait = Math.max(4, Math.floor(this.p.thinkDelay / 2));
    return { ...NO_INPUT, raise: this.raising };
  }

  /** 全ての横入れ替えを評価し、最も良い手を返す。 */
  private pickMove(danger: boolean): Move | null {
    const b = this.board;
    const g = snapshot(b);
    const basePotential = potential(g);
    const clearing = hasClearing(g);
    if (!clearing) this.plan = null;
    let best: Move | null = null;
    let bestPlan: { x: number; y: number }[] | null = null;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS - 1; x++) {
        const a = g[y][x];
        const c = g[y][x + 1];
        if (a === BLOCK || c === BLOCK || a === GARBAGE || c === GARBAGE || a === CLEARING || c === CLEARING) continue;
        if (a === EMPTY && c === EMPTY) continue;
        if (a === c) continue;
        // 直前に入れ替えた場所をすぐ戻さない
        if (this.lastSwap && this.lastSwap.x === x && this.lastSwap.y === y && b.frame - this.lastSwap.frame < 90) continue;

        const sim = clone(g);
        sim[y][x] = c;
        sim[y][x + 1] = a;
        settle(sim, [x, x + 1]);
        const matched = findMatches(sim);
        let score = 0;
        // アクティブ連鎖: 今は揃わないが、消去中のパネルが消えて落ちたあとに、落ちたパネルを含んで揃う手
        let activeChain = 0;
        let futMatched: { x: number; y: number }[] = [];
        if (this.p.lookahead && clearing) {
          const fut = futureAfterClear(sim);
          futMatched = findMatches(fut.grid);
          // 仕込み済みの連鎖を壊す手は打たない
          if (this.plan && !this.plan.every((q) => futMatched.some((m) => m.x === q.x && m.y === q.y))) continue;
          if (matched.length === 0 && futMatched.some((m) => fut.flags[m.y][m.x])) activeChain = futMatched.length;
        }
        if (activeChain > 0) {
          // 連鎖を伸ばす手は、同程度の同時消しより優先する。連鎖が伸びているほど価値が高い
          score += 180 * activeChain + 120 + 40 * Math.min(6, b.chain);
        } else if (matched.length > 0) {
          score += 100 * matched.length + (matched.length >= 4 ? 120 : 0);
          if (touchesGarbage(sim, matched)) score += 80;
          if (this.p.lookahead) {
            for (const m of matched) sim[m.y][m.x] = EMPTY;
            settle(sim, [...new Set(matched.map((m) => m.x))]);
            const chain = findMatches(sim);
            if (chain.length > 0) score += 60 * chain.length + 100;
          }
        } else if (this.p.setup && !danger) {
          const gain = potential(sim) - basePotential;
          if (gain <= 0) continue;
          score += gain * 3;
          // 低い位置の仕込みを好む（後で連鎖の土台になる）
          score += (ROWS - y) * 0.2;
        } else {
          continue;
        }
        // 近い手を少し優先
        score -= (Math.abs(x - b.cursor.x) + Math.abs(y - b.cursor.y)) * 0.5;
        if (!best || score > best.score) {
          best = { x, y, score };
          bestPlan = activeChain > 0 ? futMatched : null;
        }
      }
    }
    if (bestPlan) this.plan = bestPlan;
    return best;
  }
}
