import type { GarbageSpec, GarbageType } from "./garbage";

/** パネル柄。0..5。描画側で名前と色を割り当てる。 */
export type Kind = number;
export const EMPTY = -1;

export type CellState =
  | "idle"
  | "swapping"
  | "hover"
  | "falling"
  | "matched"
  | "popped";

export interface Cell {
  /** 柄。空・おじゃまは EMPTY。 */
  kind: Kind;
  /** おじゃまブロックID。通常パネル・空は -1。 */
  garbage: number;
  state: CellState;
  /** 状態ごとの残りフレーム。 */
  timer: number;
  fallTimer: number;
  /** 連鎖フラグ。消去で落ちたパネルに付き、着地して揃わなければ消える。 */
  chain: boolean;
  /** 入れ替えアニメーション用。どちらから来たか。 */
  swapFrom: -1 | 0 | 1;
  /** 消去時: 何フレーム後に消えるか。 */
  popAt: number;
  /** 消去時: 何フレーム後に空になるか。 */
  removeAt: number;
  /** 変身中のおじゃまが見せる柄。 */
  revealKind: Kind;
  /** 変身中のおじゃまがこの柄を見せ始めるまでのフレーム。 */
  revealAt: number;
}

export type GarbageState = "idle" | "hover" | "falling" | "transforming";

export interface GarbageBlock {
  id: number;
  type: GarbageType;
  x: number;
  y: number;
  width: number;
  height: number;
  state: GarbageState;
  timer: number;
  fallTimer: number;
  /** 変身完了までのフレーム。 */
  transformEnd: number;
}

export interface Input {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  swap: boolean;
  raise: boolean;
  /** カーソルを直接この位置へ置く（タッチ操作用）。moveX/moveY より先に適用する。 */
  cursorTo?: { x: number; y: number };
}

export const NO_INPUT: Input = { moveX: 0, moveY: 0, swap: false, raise: false };

export type BoardEvent =
  | { type: "swap" }
  | { type: "move" }
  | { type: "match"; panels: number; chain: number; x: number; y: number; score: number }
  | { type: "pop"; x: number; y: number; index: number }
  | { type: "chainEnd"; chain: number }
  | { type: "land"; x: number; y: number }
  | { type: "garbageLand"; height: number }
  | { type: "garbageTransform"; id: number }
  | { type: "attack"; garbage: GarbageSpec[] }
  | { type: "danger"; on: boolean }
  | { type: "panic"; on: boolean }
  | { type: "gameOver" }
  | { type: "levelUp"; level: number };

export interface BoardOptions {
  seed: number;
  kinds?: number;
  /** 開始スピードレベル（1..99）。 */
  speedLevel?: number;
  /** 消去枚数でスピードが上がるか（エンドレス用）。 */
  speedUp?: boolean;
  /** 初期盤面の高さ（各列この段数前後）。0で空盤面。 */
  initialHeight?: number;
  /** 自動せり上がりを止める（テスト・パズル用）。 */
  noRise?: boolean;
}
