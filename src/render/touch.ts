import Phaser from "phaser";
import { Board, COLS, ROWS, type Input } from "../core";
import { BOARD_H, BOARD_W, CELL } from "./theme";

/** 横ドラッグを「入れ替え」と判定する移動量。 */
const SWIPE_THRESHOLD = CELL * 0.35;
/** これ以下の移動ならタップ扱い。 */
const TAP_SLOP = 8;

type DragMode = "pending" | "swipe";

interface Drag {
  startX: number;
  startY: number;
  /** ドラッグ中のパネルが今いるマス。入れ替えるたびに追従する。 */
  cellX: number;
  cellY: number;
  mode: DragMode;
}

/**
 * 盤面へのタッチ・マウス操作を Input に変える。
 *
 * - 2枚の境目をタップ: その2枚を入れ替える（1回で入れ替わる）
 * - パネルを横にドラッグ: その方向の隣と入れ替える。指を離さず引き続ければ連続で入れ替わる
 * - 盤面の外を押している間: 手動せり上げ（GameScene が盤面外の指を振り分けて raisePointers に入れる）
 *
 * 操作はキューに積み、poll() が1フレームに1つずつ取り出す。
 */
export class TouchInput {
  private queue: Input[] = [];
  private readonly drags = new Map<number, Drag>();
  /** 盤面の外を押してせり上げている指。 */
  readonly raisePointers = new Set<number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly board: Board,
    readonly ox: number,
    readonly oy: number,
  ) {
    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onDown, this);
    this.scene.input.off("pointermove", this.onMove, this);
    this.scene.input.off("pointerup", this.onUp, this);
    this.scene.input.off("pointerupoutside", this.onUp, this);
    this.drags.clear();
    this.raisePointers.clear();
  }

  /** 画面座標を盤面のマスに変換する。盤面の外なら null。 */
  cellAt(px: number, py: number): { x: number; y: number } | null {
    if (px < this.ox || px >= this.ox + BOARD_W || py < this.oy || py >= this.oy + BOARD_H) return null;
    const x = Math.floor((px - this.ox) / CELL);
    const rise = this.board.riseProgress * CELL;
    const y = ROWS - 1 - Math.floor((py - this.oy + rise) / CELL);
    return { x: Math.max(0, Math.min(COLS - 1, x)), y: Math.max(0, Math.min(ROWS - 1, y)) };
  }

  /** せり上げ中の指があるか。 */
  get raising(): boolean {
    return this.raisePointers.size > 0;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const cell = this.cellAt(p.x, p.y);
    if (!cell) return;
    this.drags.set(p.id, { startX: p.x, startY: p.y, cellX: cell.x, cellY: cell.y, mode: "pending" });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const d = this.drags.get(p.id);
    if (!d) return;
    const dx = p.x - d.startX;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    const dir = dx > 0 ? 1 : -1;
    const target = d.cellX + dir;
    if (target < 0 || target >= COLS) return;
    const left = dir > 0 ? d.cellX : target;
    // 掴んでいるパネルの現在の高さで入れ替える（せり上がりで段がずれても追従する）
    this.queue.push({ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x: left, y: d.cellY } });
    d.cellX = target;
    d.startX += dir * CELL;
    d.mode = "swipe";
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.raisePointers.delete(p.id);
    const d = this.drags.get(p.id);
    if (!d) return;
    this.drags.delete(p.id);
    if (d.mode !== "pending") return;
    if (Math.abs(p.x - d.startX) > TAP_SLOP || Math.abs(p.y - d.startY) > TAP_SLOP) return;
    // タップ1回で入れ替える。タップ位置に最も近いマスの境目を挟む2枚が対象。
    // マスの中央を叩いたときは、左右のうち近い側の隣と入れ替える。
    const boundary = Math.round((d.startX - this.ox) / CELL);
    const left = Math.max(0, Math.min(COLS - 2, boundary - 1));
    this.queue.push({ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x: left, y: d.cellY } });
  }

  /** キューの先頭を1つ取り出す。何もなければ null。せり上げの状態は毎回返す。 */
  poll(): { action: Input | null; raise: boolean } {
    return { action: this.queue.shift() ?? null, raise: this.raising };
  }
}
