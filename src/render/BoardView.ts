import Phaser from "phaser";
import { Board, COLS, EMPTY, ROWS, TIMING, TOTAL_ROWS, isPanel, type BoardEvent } from "../core";
import { BOARD_BG, BOARD_H, BOARD_W, CELL, FONT, TEXT_COLOR } from "./theme";
import { audio } from "./shared";
import { haptics } from "./haptics";

/** 描画する行の範囲。可視12段の上に、降ってくるおじゃまが見えるぶんだけ余裕を持たせる。 */
const DRAW_ROWS = Math.min(TOTAL_ROWS, ROWS + 6);

/**
 * 1つの Board を描く。Board の状態を毎フレーム読んで Image の位置・テクスチャを更新するだけで、
 * 自前の状態はエフェクト（吹き出し・揺れ）しか持たない。
 */
export class BoardView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly cells: Phaser.GameObjects.Image[][] = [];
  private readonly nextCells: Phaser.GameObjects.Image[] = [];
  private readonly cursor: Phaser.GameObjects.Image;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly pendingGfx: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Container;
  private readonly overlayTitle: Phaser.GameObjects.Text;
  private readonly overlayBody: Phaser.GameObjects.Text;
  private stopBar: Phaser.GameObjects.Rectangle;
  private startTime = 0;

  /** 経過時間の起点を今にする。カウントダウンが終わって動き出すときに呼ぶ。 */
  resetTimer(): void {
    this.startTime = this.scene.time.now;
  }

  /** 盤面の中心座標。カウントダウンの数字を出す位置に使う。 */
  get center(): { x: number; y: number } {
    return { x: this.ox + BOARD_W / 2, y: this.oy + BOARD_H / 2 };
  }

  constructor(
    private readonly scene: Phaser.Scene,
    readonly board: Board,
    private readonly ox: number,
    private readonly oy: number,
    private readonly label: string,
    private readonly showLevel: boolean,
  ) {
    this.frame = scene.add.rectangle(ox - 4, oy - 4, BOARD_W + 8, BOARD_H + 8, 0x3a3a4c).setOrigin(0);
    this.bg = scene.add.rectangle(ox, oy, BOARD_W, BOARD_H, BOARD_BG).setOrigin(0);

    this.container = scene.add.container(0, 0);

    for (let r = 0; r < DRAW_ROWS; r++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let c = 0; c < COLS; c++) {
        const img = scene.add.image(0, 0, "panel-0").setOrigin(0).setVisible(false);
        this.container.add(img);
        row.push(img);
      }
      this.cells.push(row);
    }
    for (let c = 0; c < COLS; c++) {
      const img = scene.add.image(0, 0, "panel-0-dark").setOrigin(0);
      this.container.add(img);
      this.nextCells.push(img);
    }
    this.cursor = scene.add.image(0, 0, "cursor").setOrigin(0);
    this.container.add(this.cursor);

    this.scoreText = scene.add
      .text(ox, oy - 30, "", { fontFamily: FONT, fontSize: "18px", color: TEXT_COLOR })
      .setOrigin(0, 0);
    this.infoText = scene.add
      .text(ox + BOARD_W, oy + BOARD_H + 14, "", { fontFamily: FONT, fontSize: "13px", color: "#9a9ab0", align: "right" })
      .setOrigin(1, 0);
    this.pendingGfx = scene.add.graphics();
    this.stopBar = scene.add.rectangle(ox, oy + BOARD_H + 6, 0, 4, 0x66ccff).setOrigin(0);

    this.overlay = scene.add.container(ox + BOARD_W / 2, oy + BOARD_H / 2).setVisible(false);
    const dim = scene.add.rectangle(0, 0, BOARD_W, BOARD_H, 0x000000, 0.6);
    this.overlayTitle = scene.add
      .text(0, -30, "", { fontFamily: FONT, fontSize: "30px", color: "#ffe066", fontStyle: "bold" })
      .setOrigin(0.5);
    this.overlayBody = scene.add
      .text(0, 24, "", { fontFamily: FONT, fontSize: "13px", color: TEXT_COLOR, align: "center" })
      .setOrigin(0.5);
    this.overlay.add([dim, this.overlayTitle, this.overlayBody]);
    this.startTime = Number.POSITIVE_INFINITY; // resetTimer() が呼ばれるまで 00:00
  }

  /** 1枚ずつ消える音の通し番号。揃うたびに 0 に戻し、tick をまたいでも音程が上がり続けるようにする。 */
  private popIndex = 0;

  /**
   * Board のイベントを音と演出に変える。tick 直後に呼ぶ。負け・勝ちの音は GameScene が鳴らす。
   * hapticOn は自分が触っている盤面だけ true にする（CPU の盤面で震わせない）。
   */
  handleEvents(events: BoardEvent[], soundOn: boolean, hapticOn = false): void {
    if (hapticOn && this.board.panic && !this.board.gameOver) haptics.panic(this.scene.time.now);
    for (const e of events) {
      switch (e.type) {
        case "swap":
          if (soundOn) audio.swap();
          break;
        case "move":
          if (soundOn) audio.move();
          break;
        case "match":
          this.popIndex = 0;
          if (soundOn) audio.match(e.panels, e.chain);
          if (hapticOn) haptics.match(e.panels, e.chain);
          this.popup(e.x, e.y, e.panels, e.chain);
          break;
        case "pop":
          if (soundOn) audio.pop(this.popIndex++);
          break;
        case "chainEnd":
          if (soundOn && e.chain >= 2) audio.chainEnd(e.chain);
          break;
        case "land":
          if (soundOn) audio.land();
          break;
        case "garbageLand":
          if (soundOn) audio.garbageLand(e.height);
          if (hapticOn) haptics.garbageLand(e.height);
          break;
        case "garbageTransform":
          if (soundOn) audio.garbageTransform();
          break;
        case "attack":
          if (soundOn) audio.attack();
          break;
        case "levelUp":
          if (soundOn) audio.levelUp();
          break;
        case "danger":
          if (soundOn && e.on) audio.dangerWarn();
          break;
        case "panic":
          if (soundOn && e.on) audio.panicWarn();
          break;
        default:
          break;
      }
    }
  }

  /** 「4」「x2」の吹き出し。同時消しは赤枠、連鎖は緑枠。 */
  private popup(x: number, y: number, panels: number, chain: number): void {
    const px = this.ox + x * CELL + CELL / 2;
    const py = this.oy + (ROWS - 1 - y) * CELL;
    const items: { text: string; color: string }[] = [];
    if (panels >= 4) items.push({ text: String(panels), color: "#ff5c6c" });
    if (chain >= 2) items.push({ text: chain >= 14 ? "x?" : `x${chain}`, color: "#6cff7a" });
    items.forEach((it, i) => {
      const t = this.scene.add
        .text(px, py + i * 22, it.text, {
          fontFamily: FONT,
          fontSize: "18px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: it.color,
          padding: { x: 5, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(10);
      this.scene.tweens.add({
        targets: t,
        y: t.y - 28,
        alpha: 0,
        delay: 350,
        duration: 500,
        onComplete: () => t.destroy(),
      });
    });
  }

  /** 毎描画フレーム呼ぶ。Board の現在状態をそのまま画面に反映する。 */
  draw(): void {
    const b = this.board;
    const rise = b.riseProgress * CELL;
    let shake = 0;
    if (b.shakeTimer > 0) shake = Math.sin(b.frame * 1.7) * Math.min(6, b.shakeTimer * 0.5);
    const blink = (b.frame >> 1) & 1;

    for (let r = 0; r < DRAW_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const img = this.cells[r][c];
        const cell = b.cells[r][c];
        if (cell.kind === EMPTY && cell.garbage < 0) {
          img.setVisible(false);
          continue;
        }
        let dx = 0;
        let dy = 0;
        let key: string;
        let visible = true;
        if (isPanel(cell)) {
          key = `panel-${cell.kind}`;
          if (cell.state === "swapping") dx = cell.swapFrom * (cell.timer / TIMING.swap) * CELL;
          if (cell.state === "falling") dy = (cell.fallTimer / TIMING.fallPerRow) * CELL;
          // 点滅（flash）→ 揃った柄を明るく見せる（face）→ 1枚ずつ消える
          if (cell.state === "matched") key = cell.flashTimer > 0 && blink ? `panel-${cell.kind}-bright` : cell.flashTimer > 0 ? `panel-${cell.kind}` : `panel-${cell.kind}-bright`;
          if (cell.state === "popped") visible = false;
        } else {
          const g = b.garbage.get(cell.garbage);
          key = g?.type === "shock" ? "garbage-shock" : "garbage";
          if (g?.state === "falling") dy = (g.fallTimer / TIMING.fallPerRow) * CELL;
          if (g?.state === "transforming") {
            if (cell.revealAt <= 0 && cell.revealKind !== EMPTY) key = `panel-${cell.revealKind}`;
            else if (blink) key = "white";
          }
        }
        img.setTexture(key);
        img.setAlpha(key === "white" ? 0.5 : 1);
        const py = this.oy + (ROWS - 1 - r) * CELL - rise + dy + shake;
        img.setPosition(this.ox + c * CELL + dx, py);
        img.setVisible(visible && this.clip(img, py));
      }
    }
    for (let c = 0; c < COLS; c++) {
      const img = this.nextCells[c];
      img.setTexture(`panel-${b.nextRow[c]}-dark`);
      const py = this.oy + ROWS * CELL - rise + shake;
      img.setPosition(this.ox + c * CELL, py);
      img.setVisible(this.clip(img, py));
    }
    this.cursor.setPosition(
      this.ox + b.cursor.x * CELL - 3,
      this.oy + (ROWS - 1 - b.cursor.y) * CELL - rise - 3 + shake,
    );
    this.cursor.setVisible(!b.gameOver);

    this.bg.setFillStyle(b.panic ? 0x3a1e26 : b.danger ? 0x2c1e2a : BOARD_BG);
    this.frame.setFillStyle(b.panic && blink ? 0xaa3344 : 0x3a3a4c);

    this.scoreText.setText(`${this.label}  ${String(b.score).padStart(6, "0")}`);
    const elapsed = Math.max(0, Math.floor((this.scene.time.now - this.startTime) / 1000));
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    const parts = [`${mm}:${ss}`];
    if (this.showLevel) parts.push(`SPEED ${b.level}`);
    parts.push(`MAX x${b.maxChain}`);
    this.infoText.setText(parts.join("   "));

    const stopW = Math.min(1, b.stopTimer / TIMING.stopMax) * BOARD_W;
    this.stopBar.setSize(stopW, 4);
    this.stopBar.setVisible(stopW > 0);

    this.pendingGfx.clear();
    let px = this.ox;
    for (const spec of b.pendingGarbage) {
      const w = spec.width * 5;
      const h = Math.max(4, spec.height * 4);
      this.pendingGfx.fillStyle(spec.type === "shock" ? 0x5c5c66 : 0x8a8a96, 1);
      this.pendingGfx.fillRect(px, this.oy - 12 - h, w, h);
      px += w + 4;
    }
  }

  /** 盤面の枠からはみ出す部分を切り取る。完全に外なら false。 */
  private clip(img: Phaser.GameObjects.Image, py: number): boolean {
    const top = Math.max(0, this.oy - py);
    const bottom = Math.max(0, py + CELL - (this.oy + BOARD_H));
    if (top >= CELL || bottom >= CELL) return false;
    img.setCrop(0, top, CELL, CELL - top - bottom);
    return true;
  }

  showOverlay(title: string, body: string): void {
    this.overlay.setVisible(true);
    this.overlay.setDepth(20);
    this.overlayTitle.setText(title);
    this.overlayBody.setText(body);
  }

  hideOverlay(): void {
    this.overlay.setVisible(false);
  }
}
