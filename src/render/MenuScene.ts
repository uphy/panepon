import Phaser from "phaser";
import { FONT, GAME_H, GAME_W, KIND_COLORS, TEXT_COLOR } from "./theme";
import { createTextures } from "./textures";
import type { GameMode } from "../core";
import { audio } from "./shared";

interface MenuItem {
  label: string;
  mode: GameMode;
}

const ITEMS: MenuItem[] = [
  { label: "1P  ENDLESS", mode: "endless" },
  { label: "2P  VERSUS", mode: "versus" },
];

export class MenuScene extends Phaser.Scene {
  private index = 0;
  private texts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("menu");
  }

  create(): void {
    createTextures(this);
    // URL の ?mode= は最初の1回だけ効かせる。Esc でメニューに戻ったときに再び飛ばされないよう、ここで消す。
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    if (mode === "endless" || mode === "versus") {
      params.delete("mode");
      const rest = params.toString();
      history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
      this.scene.start("game", { mode });
      return;
    }

    this.add
      .text(GAME_W / 2, 90, "PANEPON", { fontFamily: FONT, fontSize: "64px", color: TEXT_COLOR, fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 145, "clone  -  Panel de Pon style action puzzle", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#9a9ab0",
      })
      .setOrigin(0.5);

    KIND_COLORS.forEach((_, k) => {
      this.add.image(GAME_W / 2 - 100 + k * 40, 200, `panel-${k}`);
    });

    ITEMS.forEach((item, i) => {
      const t = this.add
        .text(GAME_W / 2, 270 + i * 44, item.label, { fontFamily: FONT, fontSize: "26px", color: TEXT_COLOR })
        .setOrigin(0.5)
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

    this.add
      .text(
        GAME_W / 2,
        GAME_H - 80,
        [
          "P1: ←↑↓→ move   Z swap   X raise        P2: WASD move   F swap   H raise",
          "Gamepad: D-pad / stick move   A,B swap   L,R raise      P pause   R restart   Esc menu",
        ].join("\n"),
        { fontFamily: FONT, fontSize: "13px", color: "#9a9ab0", align: "center" },
      )
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
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
    this.scene.start("game", { mode: ITEMS[this.index].mode });
  }
}
