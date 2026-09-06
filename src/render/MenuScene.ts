import Phaser from "phaser";
import { FONT, KIND_COLORS, TEXT_COLOR, layoutFor, sameLayout } from "./theme";
import { createTextures } from "./textures";
import type { CpuLevel, GameMode } from "../core";
import { audio } from "./shared";
import { loadHighScores } from "./highscore";
import { haptics } from "./haptics";
import { DPR, applyLayout } from "./hidpi";
import { Button } from "./ui";

interface MenuItem {
  label: string;
  mode: GameMode;
  cpuLevel?: CpuLevel;
}

const ITEMS: MenuItem[] = [
  { label: "1P  ENDLESS", mode: "endless" },
  { label: "1P  TIME ATTACK", mode: "timeattack" },
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
    if (mode === "endless" || mode === "timeattack" || mode === "versus" || mode === "cpu") {
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
    applyLayout(this, layout);
    // e2e 用。ゲームを始める前でもメニューの表示物を調べられるようにする
    const g = window as unknown as { __paneponScenes?: Record<string, Phaser.Scene> };
    g.__paneponScenes = { ...g.__paneponScenes, menu: this };
    const W = layout.width;
    const H = layout.height;
    const cx = W / 2;

    // 背の低い画面（Safari のツールバーがある iPhone、横持ちのスマホ）では、縦の間隔を詰める
    const compact = H < 560;
    const titleY = compact ? 40 : layout.portrait ? 64 : 56;
    this.add
      .text(cx, titleY, "PANEPON", { fontFamily: FONT, fontSize: layout.portrait ? "48px" : "56px", color: TEXT_COLOR, fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(cx, titleY + (compact ? 40 : 46), layout.portrait ? "Panel de Pon style puzzle" : "clone  -  Panel de Pon style action puzzle", {
        fontFamily: FONT,
        fontSize: layout.portrait ? "13px" : "16px",
        color: "#9a9ab0",
      })
      .setOrigin(0.5);

    KIND_COLORS.forEach((_, k) => {
      this.add.image(cx - 100 + k * 40, titleY + (compact ? 70 : 84), `panel-${k}`).setScale(1 / DPR);
    });

    const itemTop = titleY + (compact ? 106 : layout.portrait ? 128 : 134);
    const itemGap = compact ? 34 : layout.portrait ? 42 : 34;
    const itemPad = layout.portrait ? (compact ? 5 : 8) : compact ? 5 : 4;
    ITEMS.forEach((item, i) => {
      // 指で押す前提で、文字の上下に余白を取って当たり判定を高さ 32 論理px 以上にする
      const t = this.add
        .text(cx, itemTop + i * itemGap, item.label, { fontFamily: FONT, fontSize: compact ? "20px" : "22px", color: TEXT_COLOR })
        .setOrigin(0.5)
        .setPadding(16, itemPad, 16, itemPad)
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

    const recordsY = itemTop + (ITEMS.length - 1) * itemGap + (compact ? 16 : 22);
    // 記録。エンドレスのベストと、CPU 対戦の勝敗
    const hs = loadHighScores();
    const best = hs.endless[0];
    const cpuLine = (["easy", "normal", "hard"] as CpuLevel[])
      .map((l) => `${layout.portrait ? l[0].toUpperCase() : l.toUpperCase()} ${hs.cpu[l].wins}-${hs.cpu[l].losses}`)
      .join(layout.portrait ? "  " : "   ");
    // タップすると上位5件の一覧を開く
    this.add
      .text(
        cx,
        recordsY,
        [best ? `BEST ${String(best.score).padStart(6, "0")}   MAX CHAIN x${best.maxChain}` : "BEST ------", `VS CPU  ${cpuLine}`, "▸ RECORDS"].join("\n"),
        { fontFamily: FONT, fontSize: "12px", color: "#7a7a90", align: "center" },
      )
      .setOrigin(0.5, 0)
      .setPadding(16, 6, 16, 6)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.showRecords())
      .setName("records");

    const help = layout.touch
      ? ["Tap between two panels to swap them", "Drag a panel sideways to swap", "Raise: hold outside board / 2 fingers", "Pause with the ❚❚ button"]
      : [
          "P1: ←↑↓→ move   Z swap   X raise        P2: WASD move   F swap   H raise",
          "Gamepad: D-pad / stick move   A,B swap   L,R raise      P pause   R restart   Esc menu",
          "Mouse: click between two panels to swap them, or drag a panel sideways. Hold outside the board to raise",
        ];
    // 音と振動の切り替え。振動は対応端末（Android など）でだけ出す
    const soundLabel = (): string => `SOUND: ${audio.muted ? "OFF" : "ON"}`;
    const soundBtn = new Button(
      this,
      0,
      0,
      soundLabel(),
      () => {
        audio.setMuted(!audio.muted);
        soundBtn.setText(soundLabel());
      },
      { fontSize: 12, minWidth: 110, minHeight: 36 },
    ).setName("sound");
    const toggles: Button[] = [soundBtn];
    if (haptics.supported) {
      const label = (): string => `VIBRATION: ${haptics.enabled ? "ON" : "OFF"}`;
      const t = new Button(
        this,
        0,
        0,
        label(),
        () => {
          haptics.toggle();
          t.setText(label());
        },
        { fontSize: 12, minWidth: 110, minHeight: 36 },
      ).setName("vibration");
      toggles.push(t);
    }
    if (layout.portrait) {
      const toggleY = H - 88;
      toggles.forEach((b, i) => b.setPosition(cx + (i - (toggles.length - 1) / 2) * 132, toggleY));
    } else if (layout.phoneLandscape) {
      // 横持ちのスマホは下を3列にする。左に案内、中央に記録、右に切り替え
      toggles.forEach((b, i) => b.setPosition(W - 150, recordsY + 10 + i * 44));
    } else {
      // 横長では記録の左右に置く
      toggles.forEach((b, i) => b.setPosition(cx + (i === 0 ? -300 : 300), recordsY + 28));
    }
    if (layout.phoneLandscape) {
      this.add
        .text(150, recordsY + 30, help.join("\n"), { fontFamily: FONT, fontSize: "12px", color: "#9a9ab0", align: "center", wordWrap: { width: 280 } })
        .setOrigin(0.5);
    } else {
      this.add
        .text(cx, H - 34, help.join("\n"), {
          fontFamily: FONT,
          fontSize: "12px",
          color: "#9a9ab0",
          align: "center",
          wordWrap: { width: W - 20 },
        })
        .setOrigin(0.5);
    }

    // 回転・ウィンドウサイズの変更でレイアウトが変わったら、メニューは作り直す
    let resizeTimer: number | null = null;
    const onResize = (): void => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        if (!sameLayout(layoutFor("menu"), layout)) this.scene.restart();
      }, 150);
    };
    window.addEventListener("resize", onResize);
    this.events.once("shutdown", () => {
      window.removeEventListener("resize", onResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    });

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

  /** 上位5件と CPU 戦の勝敗の一覧。暗幕をタップするか CLOSE で閉じる。 */
  private showRecords(): void {
    const layout = layoutFor("menu");
    const W = layout.width;
    const H = layout.height;
    const hs = loadHighScores();
    const lines: string[] = [];
    for (const [title, list] of [
      ["1P ENDLESS  TOP 5", hs.endless],
      ["1P TIME ATTACK 2:00  TOP 5", hs.timeattack],
    ] as const) {
      lines.push(title);
      if (list.length === 0) lines.push("no records yet");
      list.forEach((e, i) => {
        lines.push(`${i + 1}.  ${String(e.score).padStart(6, "0")}   x${String(e.maxChain).padEnd(2)}  ${e.date || "----------"}`);
      });
      lines.push("");
    }
    lines.push("VS CPU");
    for (const l of ["easy", "normal", "hard"] as CpuLevel[]) {
      const r = hs.cpu[l];
      lines.push(`${l.toUpperCase().padEnd(7)} ${r.wins}W ${r.losses}L`);
    }
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.92).setOrigin(0).setInteractive();
    const body = this.add
      .text(W / 2, H / 2 - 40, lines.join("\n"), { fontFamily: FONT, fontSize: "12px", color: TEXT_COLOR, align: "left", lineSpacing: 3 })
      .setOrigin(0.5);
    const panel = this.add.container(0, 0, [dim, body]).setDepth(50).setName("records-list");
    const close = new Button(this, W / 2, H / 2 + body.height / 2 + 10, "CLOSE", () => panel.destroy(), { minWidth: 140, minHeight: 40 });
    panel.add(close);
    dim.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      panel.destroy();
    });
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
