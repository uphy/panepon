import Phaser from "phaser";
import { FONT, TEXT_COLOR } from "./theme";

/** 選ばれているボタンの背景色。 */
const SELECTED_BG = 0x46466a;

export interface ButtonOptions {
  /** 文字の大きさ（論理 px）。 */
  fontSize?: number;
  /** 最小の幅・高さ（論理 px）。指で押す前提で 36 以上にする。 */
  minWidth?: number;
  minHeight?: number;
  /** 押したときの音を鳴らすか。 */
  color?: string;
  bg?: number;
}

/**
 * タッチでもキーボードでも押せる四角いボタン。
 * Text だけの当たり判定は指には小さすぎるので、背景の矩形ごと Container にして当たり判定にする。
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly baseColor: number;
  private readonly baseTextColor: string;
  private selected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onPress: () => void, opts: ButtonOptions = {}) {
    super(scene, x, y);
    const fontSize = opts.fontSize ?? 15;
    const minW = opts.minWidth ?? 96;
    const minH = opts.minHeight ?? 36;
    this.baseColor = opts.bg ?? 0x2e2e40;
    this.baseTextColor = opts.color ?? TEXT_COLOR;
    this.label = scene.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: `${fontSize}px`, color: opts.color ?? TEXT_COLOR, align: "center" })
      .setOrigin(0.5);
    const w = Math.max(minW, this.label.width + 24);
    const h = Math.max(minH, this.label.height + 12);
    this.bg = scene.add.rectangle(0, 0, w, h, this.baseColor).setStrokeStyle(1, 0x5a5a72);
    this.add([this.bg, this.label]);
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on("pointerover", () => this.bg.setFillStyle(this.selected ? SELECTED_BG : 0x3e3e56));
    this.on("pointerout", () => this.bg.setFillStyle(this.selected ? SELECTED_BG : this.baseColor));
    this.on("pointerdown", (_p?: Phaser.Input.Pointer, _x?: number, _y?: number, event?: Phaser.Types.Input.EventData) => {
      // 下にある「盤面の外を押すとせり上げ」「タップで再開」に伝えない
      event?.stopPropagation();
      this.bg.setFillStyle(0x50506c);
      onPress();
      this.scene.time.delayedCall(120, () => this.bg.setFillStyle(this.selected ? SELECTED_BG : this.baseColor));
    });
    scene.add.existing(this);
  }

  /** 選ばれている状態。背景を明るくし、枠と文字を黄色にする（面選びの現在のステージ・面）。 */
  setSelected(on: boolean): this {
    this.selected = on;
    this.bg.setFillStyle(on ? SELECTED_BG : this.baseColor);
    this.bg.setStrokeStyle(on ? 2 : 1, on ? 0xffe066 : 0x5a5a72);
    this.label.setColor(on ? "#ffe066" : this.baseTextColor);
    return this;
  }

  /** 文字の色を変える。選ばれている間は黄色が優先される。 */
  setTextColor(color: string): this {
    if (!this.selected) this.label.setColor(color);
    return this;
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  get text(): string {
    return this.label.text;
  }

  /** 論理座標がボタンの上か。せり上げ判定などで、ボタンの上のタッチを除くために使う。 */
  contains(x: number, y: number): boolean {
    if (!this.visible) return false;
    const m = this.getWorldTransformMatrix();
    const local = m.applyInverse(x, y);
    return Math.abs(local.x) <= this.width / 2 && Math.abs(local.y) <= this.height / 2;
  }
}
