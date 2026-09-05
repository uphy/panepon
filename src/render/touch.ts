import Phaser from "phaser";
import { Board, COLS, ROWS, type Input } from "../core";
import { BOARD_H, BOARD_W, CELL, FONT } from "./theme";

/** ドラッグを「入れ替え」と判定する横移動量。 */
const SWIPE_THRESHOLD = CELL * 0.35;
/** これ以下の移動ならタップ扱い。 */
const TAP_SLOP = 8;

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  /** ドラッグ中のパネルが今いるマス。入れ替えるたびに追従する。 */
  cellX: number;
  cellY: number;
  swiped: boolean;
}

/**
 * 盤面へのタッチ・マウス操作を Input に変える。
 *
 * - パネルを横にドラッグ: その方向の隣と入れ替える。指を離さず引き続ければ連続で入れ替わる
 * - タップ: カーソルをそこへ移す。カーソルの中をタップしたら入れ替える
 * - RAISE ボタンを押し続ける: 手動せり上げ
 *
 * 操作はキューに積み、poll() が1フレームに1つずつ取り出す。
 */
export class TouchInput {
  private queue: Input[] = [];
  private drag: Drag | null = null;
  private raiseHeld = false;
  private raisePointer = -1;
  readonly raiseButton: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly board: Board,
    private readonly ox: number,
    private readonly oy: number,
    button: { x: number; y: number; width: number; height: number },
  ) {
    const bg = scene.add
      .rectangle(0, 0, button.width, button.height, 0x2c2c3c)
      .setStrokeStyle(2, 0x55556a)
      .setOrigin(0.5);
    const vertical = button.height > button.width;
    const label = scene.add
      .text(0, 0, vertical ? "▲\nR\nA\nI\nS\nE" : "▲ RAISE", {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#dcdcea",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);
    this.raiseButton = scene.add.container(button.x + button.width / 2, button.y + button.height / 2, [bg, label]);
    bg.setInteractive();
    bg.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.raiseHeld = true;
      this.raisePointer = p.id;
      bg.setFillStyle(0x4a4a66);
    });
    const release = (p: Phaser.Input.Pointer): void => {
      if (p.id !== this.raisePointer) return;
      this.raiseHeld = false;
      this.raisePointer = -1;
      bg.setFillStyle(0x2c2c3c);
    };
    bg.on("pointerup", release);
    bg.on("pointerout", release);
    scene.input.on("pointerup", release);

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
  }

  /** 画面座標を盤面のマスに変換する。盤面の外なら null。 */
  cellAt(px: number, py: number): { x: number; y: number } | null {
    if (px < this.ox || px >= this.ox + BOARD_W || py < this.oy || py >= this.oy + BOARD_H) return null;
    const x = Math.floor((px - this.ox) / CELL);
    const rise = this.board.riseProgress * CELL;
    const y = ROWS - 1 - Math.floor((py - this.oy + rise) / CELL);
    return { x: Math.max(0, Math.min(COLS - 1, x)), y: Math.max(0, Math.min(ROWS - 1, y)) };
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.drag) return;
    const cell = this.cellAt(p.x, p.y);
    if (!cell) return;
    this.drag = { pointerId: p.id, startX: p.x, startY: p.y, cellX: cell.x, cellY: cell.y, swiped: false };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || p.id !== d.pointerId) return;
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
    d.swiped = true;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || p.id !== d.pointerId) return;
    this.drag = null;
    if (d.swiped) return;
    if (Math.abs(p.x - d.startX) > TAP_SLOP || Math.abs(p.y - d.startY) > TAP_SLOP) return;
    const { cursor } = this.board;
    const inCursor = d.cellY === cursor.y && (d.cellX === cursor.x || d.cellX === cursor.x + 1);
    if (inCursor) {
      this.queue.push({ moveX: 0, moveY: 0, swap: true, raise: false });
    } else {
      const x = Math.min(COLS - 2, d.cellX);
      this.queue.push({ moveX: 0, moveY: 0, swap: false, raise: false, cursorTo: { x, y: d.cellY } });
    }
  }

  /** キューの先頭を1つ取り出す。何もなければ null。せり上げの押下状態は毎回返す。 */
  poll(): { action: Input | null; raise: boolean } {
    return { action: this.queue.shift() ?? null, raise: this.raiseHeld };
  }
}
