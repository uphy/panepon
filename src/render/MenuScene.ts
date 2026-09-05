import Phaser from "phaser";
import { FONT, KIND_COLORS, TEXT_COLOR, layoutFor } from "./theme";
import { createTextures } from "./textures";
import type { CpuLevel, GameMode } from "../core";
import { audio } from "./shared";
import { loadHighScores } from "./highscore";
import { haptics } from "./haptics";

interface MenuItem {
  label: string;
  mode: GameMode;
  cpuLevel?: CpuLevel;
}

const ITEMS: MenuItem[] = [
  { label: "1P  ENDLESS", mode: "endless" },
  { label: "VS CPU  EASY", mode: "cpu", cpuLevel: "easy" },
  { label: "VS CPU  NORMAL", mode: "cpu", cpuLevel: "normal" },
  { label: "VS CPU  HARD", mode: "cpu", cpuLevel: "hard" },
  { label: "2P  VERSUS", mode: "versus" },
];

export class MenuScene extends Phaser.Scene {
  private index = 0;
  private texts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("menu");
  }

  create(): void {
    // Scene のインスタンスは使い回されるので、前回の表示物への参照を捨てる。
    // 残したままだと refresh() が破棄済みの Text を触って描画が止まる。
    this.texts = [];
    createTextures(this);
    // URL の ?mode= は最初の1回だけ効かせる。Esc でメニューに戻ったときに再び飛ばされないよう、ここで消す。
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    if (mode === "endless" || mode === "versus" || mode === "cpu") {
      const cpu = params.get("cpu");
      const cpuLevel: CpuLevel = cpu === "easy" || cpu === "hard" ? cpu : "normal";
      params.delete("mode");
      params.delete("cpu");
      const rest = params.toString();
      history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
      this.scene.start("game", { mode, cpuLevel });
      return;
    }

    const layout = layoutFor("menu");
    this.scale.resize(layout.width, layout.height);
    const W = layout.width;
    const H = layout.height;
    const cx = W / 2;

    const titleY = layout.portrait ? 70 : 56;
    this.add
      .text(cx, titleY, "PANEPON", { fontFamily: FONT, fontSize: layout.portrait ? "48px" : "56px", color: TEXT_COLOR, fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(cx, titleY + 48, layout.portrait ? "Panel de Pon style puzzle" : "clone  -  Panel de Pon style action puzzle", {
        fontFamily: FONT,
        fontSize: layout.portrait ? "13px" : "16px",
        color: "#9a9ab0",
      })
      .setOrigin(0.5);

    KIND_COLORS.forEach((_, k) => {
      this.add.image(cx - 100 + k * 40, titleY + 88, `panel-${k}`);
    });

    const itemTop = titleY + 134;
    const itemGap = layout.portrait ? 44 : 36;
    ITEMS.forEach((item, i) => {
      const t = this.add
        .text(cx, itemTop + i * itemGap, item.label, { fontFamily: FONT, fontSize: "22px", color: TEXT_COLOR })
        .setOrigin(0.5)
        .setPadding(16, 4, 16, 4)
        .setInteractive({ useHandCursor: true });
      t.on("pointerover", () => {
        this.index = i;
        this.refresh();
      });
      t.on("pointerdown", () => {
        this.index = i;
        this.select();
      });
      this.texts.push(t);
    });

    // 記録。エンドレスのベストと、CPU 対戦の勝敗
    const hs = loadHighScores();
    const best = hs.endless[0];
    const cpuLine = (["easy", "normal", "hard"] as CpuLevel[])
      .map((l) => `${layout.portrait ? l[0].toUpperCase() : l.toUpperCase()} ${hs.cpu[l].wins}-${hs.cpu[l].losses}`)
      .join(layout.portrait ? "  " : "   ");
    this.add
      .text(
        cx,
        itemTop + (ITEMS.length - 1) * itemGap + 26,
        [best ? `BEST ${String(best.score).padStart(6, "0")}   MAX CHAIN x${best.maxChain}` : "BEST ------", `VS CPU  ${cpuLine}`].join("\n"),
        { fontFamily: FONT, fontSize: "12px", color: "#7a7a90", align: "center" },
      )
      .setOrigin(0.5, 0)
      .setName("records");

    const help = layout.touch
      ? ["Tap between two panels to swap them", "Drag a panel sideways to swap", "Hold outside the board to raise"]
      : [
          "P1: ←↑↓→ move   Z swap   X raise        P2: WASD move   F swap   H raise",
          "Gamepad: D-pad / stick move   A,B swap   L,R raise      P pause   R restart   Esc menu",
          "Mouse: click between two panels to swap them, or drag a panel sideways. Hold outside the board to raise",
        ];
    // 振動の切り替え。対応端末（Android など）でだけ出す
    if (haptics.supported) {
      const label = (): string => `VIBRATION: ${haptics.enabled ? "ON" : "OFF"}`;
      const t = this.add
        .text(cx, H - 78, label(), { fontFamily: FONT, fontSize: "13px", color: "#9a9ab0" })
        .setOrigin(0.5)
        .setPadding(12, 6, 12, 6)
        .setInteractive({ useHandCursor: true })
        .setName("vibration");
      t.on("pointerdown", () => {
        haptics.toggle();
        t.setText(label());
      });
    }
    this.add
      .text(cx, H - 34, help.join("\n"), {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#9a9ab0",
        align: "center",
        wordWrap: { width: W - 20 },
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    // AudioContext は最初の操作のあとにしか動かないので、どの入力でも start() を呼ぶ。BGM は start() 時に鳴り始める
    kb.on("keydown", () => audio.start());
    this.input.on("pointerdown", () => audio.start());
    audio.start();
    audio.startBgm("menu");
    kb.on("keydown-UP", () => this.moveIndex(-1));
    kb.on("keydown-DOWN", () => this.moveIndex(1));
    kb.on("keydown-W", () => this.moveIndex(-1));
    kb.on("keydown-S", () => this.moveIndex(1));
    for (const key of ["ENTER", "Z", "SPACE", "F"]) kb.on(`keydown-${key}`, () => this.select());
    this.refresh();
  }

  private moveIndex(d: number): void {
    audio.start();
    this.index = (this.index + d + ITEMS.length) % ITEMS.length;
    audio.move();
    this.refresh();
  }

  private refresh(): void {
    this.texts.forEach((t, i) => {
      t.setColor(i === this.index ? "#ffe066" : TEXT_COLOR);
      t.setText((i === this.index ? "> " : "  ") + ITEMS[i].label + (i === this.index ? " <" : "  "));
    });
  }

  private select(): void {
    audio.start();
    audio.select();
    const item = ITEMS[this.index];
    this.scene.start("game", { mode: item.mode, cpuLevel: item.cpuLevel });
  }
}
