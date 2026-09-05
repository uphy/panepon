import Phaser from "phaser";
import { Game, type GameMode, type Input, NO_INPUT } from "../core";
import { BoardView } from "./BoardView";
import { P1_KEYS, P2_KEYS, PlayerInput } from "./input";
import { audio } from "./shared";
import { TouchInput } from "./touch";
import { BOARD_H, BOARD_W, FONT, TEXT_COLOR, layoutFor } from "./theme";

const STEP_MS = 1000 / 60;

export class GameScene extends Phaser.Scene {
  private game_!: Game;
  private views: BoardView[] = [];
  private inputs: PlayerInput[] = [];
  private touches: TouchInput[] = [];
  private accumulator = 0;
  private paused = false;
  private mode: GameMode = "endless";
  private pauseText!: Phaser.GameObjects.Text;
  private ended = false;
  private wasDanger = false;

  constructor() {
    super("game");
  }

  create(data: { mode: GameMode }): void {
    this.mode = data.mode ?? "endless";
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get("seed")) || (Date.now() & 0xffffff);
    const speedLevel = Number(params.get("speed")) || 1;
    this.game_ = new Game({ mode: this.mode, seed, speedLevel });
    this.accumulator = 0;
    this.paused = false;
    this.ended = false;
    this.wasDanger = false;
    this.views = [];
    this.inputs = [];
    this.touches.forEach((t) => t.destroy());
    this.touches = [];

    const layout = layoutFor(this.mode);
    this.scale.resize(layout.width, layout.height);
    const W = layout.width;
    const H = layout.height;

    const boards = this.game_.boards;
    const top = layout.portrait ? 44 : 70;
    const origins: number[] = [];
    if (boards.length === 1) {
      const ox = Math.floor((W - BOARD_W) / 2);
      origins.push(ox);
      this.views.push(new BoardView(this, boards[0], ox, top, "1P", true));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
    } else {
      const gap = layout.portrait ? 32 : 120;
      const ox1 = Math.floor(W / 2 - gap / 2 - BOARD_W);
      const ox2 = Math.floor(W / 2 + gap / 2);
      origins.push(ox1, ox2);
      this.views.push(new BoardView(this, boards[0], ox1, top, "1P", false));
      this.views.push(new BoardView(this, boards[1], ox2, top, "2P", false));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      this.inputs.push(new PlayerInput(this, P2_KEYS, 1));
      this.add
        .text(W / 2, top + BOARD_H / 2, "VS", { fontFamily: FONT, fontSize: layout.portrait ? "18px" : "28px", color: "#9a9ab0" })
        .setOrigin(0.5);
    }

    // タッチ・マウス操作。盤面のドラッグ・タップと RAISE ボタンはどの端末でも受け付ける。
    // ボタンは縦画面では盤面の下、横画面では盤面の外側の脇に置く。
    boards.forEach((b, i) => {
      const ox = origins[i];
      const button = layout.portrait
        ? { x: ox, y: top + BOARD_H + 30, width: BOARD_W, height: 44 }
        : {
            x: boards.length === 2 && i === 0 ? ox - 16 - 64 : ox + BOARD_W + 16,
            y: top + BOARD_H - 150,
            width: 64,
            height: 150,
          };
      const t = new TouchInput(this, b, ox, top, button);
      this.touches.push(t);
      this.inputs[i].touch = t;
    });

    this.pauseText = this.add
      .text(W / 2, H / 2, "PAUSE", { fontFamily: FONT, fontSize: "40px", color: TEXT_COLOR })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);
    this.add
      .text(W / 2, H - 14, layout.touch ? "tap here: menu" : "P: pause   R: restart   Esc: menu   M: mute", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#6a6a80",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.toMenu());

    const kb = this.input.keyboard!;
    kb.on("keydown-P", () => this.togglePause());
    kb.on("keydown-R", () => this.scene.restart({ mode: this.mode }));
    kb.on("keydown-ESC", () => this.toMenu());
    kb.on("keydown-M", () => audio.setMuted(!audio.muted));
    kb.on("keydown", () => audio.start());
    this.input.on("pointerdown", () => audio.start());

    audio.start();
    audio.setDanger(false);
    if (params.get("bgm") !== "0") audio.startBgm();

    // e2e とデバッグ用。
    (window as unknown as { __panepon: unknown }).__panepon = {
      game: this.game_,
      scene: this,
      tick: (inputs: Input[]) => this.stepOnce(inputs),
    };
  }

  private toMenu(): void {
    audio.stopBgm();
    this.touches.forEach((t) => t.destroy());
    this.touches = [];
    this.scene.start("menu");
  }

  private togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    this.pauseText.setVisible(this.paused);
  }

  private stepOnce(inputs: Input[]): void {
    this.game_.tick(inputs);
    this.game_.boards.forEach((b, i) => this.views[i].handleEvents(b.events, true));
  }

  override update(_time: number, delta: number): void {
    if (!this.paused && !this.ended) {
      this.accumulator += Math.min(delta, 250);
      let steps = 0;
      while (this.accumulator >= STEP_MS && steps < 6) {
        const inputs = this.inputs.map((p) => p.poll());
        this.stepOnce(inputs.length ? inputs : [NO_INPUT]);
        this.accumulator -= STEP_MS;
        steps++;
      }
      const danger = this.game_.boards.some((b) => b.danger || b.panic);
      if (danger !== this.wasDanger) {
        this.wasDanger = danger;
        audio.setDanger(danger);
      }
      if (this.game_.finished) this.finish();
    }
    this.views.forEach((v) => v.draw());
  }

  private finish(): void {
    this.ended = true;
    audio.stopBgm();
    // 結果表示のあと、盤面の中をタップ（クリック）するとやり直す
    this.time.delayedCall(800, () => {
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (this.touches.some((t) => t.cellAt(p.x, p.y))) this.scene.restart({ mode: this.mode });
      });
    });
    const g = this.game_;
    if (this.mode === "endless") {
      const b = g.boards[0];
      this.views[0].showOverlay(
        "GAME OVER",
        `SCORE ${b.score}\nMAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}\n\nR / tap: restart   Esc: menu`,
      );
    } else {
      g.boards.forEach((b, i) => {
        const won = g.winner === i;
        this.views[i].showOverlay(
          won ? "WIN" : "LOSE",
          `MAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}\n\nR / tap: rematch   Esc: menu`,
        );
      });
    }
  }
}
