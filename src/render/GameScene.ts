import Phaser from "phaser";
import { Game, type GameMode, type Input, NO_INPUT } from "../core";
import { BoardView } from "./BoardView";
import { P1_KEYS, P2_KEYS, PlayerInput } from "./input";
import { audio } from "./shared";
import { BOARD_H, BOARD_W, FONT, GAME_H, GAME_W, TEXT_COLOR } from "./theme";

const STEP_MS = 1000 / 60;

export class GameScene extends Phaser.Scene {
  private game_!: Game;
  private views: BoardView[] = [];
  private inputs: PlayerInput[] = [];
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

    const boards = this.game_.boards;
    const top = 70;
    if (boards.length === 1) {
      const ox = Math.floor((GAME_W - BOARD_W) / 2);
      this.views.push(new BoardView(this, boards[0], ox, top, "1P", true));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
    } else {
      const gap = 120;
      const ox1 = Math.floor(GAME_W / 2 - gap / 2 - BOARD_W);
      const ox2 = Math.floor(GAME_W / 2 + gap / 2);
      this.views.push(new BoardView(this, boards[0], ox1, top, "1P", false));
      this.views.push(new BoardView(this, boards[1], ox2, top, "2P", false));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      this.inputs.push(new PlayerInput(this, P2_KEYS, 1));
      this.add
        .text(GAME_W / 2, top + BOARD_H / 2, "VS", { fontFamily: FONT, fontSize: "28px", color: "#9a9ab0" })
        .setOrigin(0.5);
    }

    this.pauseText = this.add
      .text(GAME_W / 2, GAME_H / 2, "PAUSE", { fontFamily: FONT, fontSize: "40px", color: TEXT_COLOR })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);
    this.add
      .text(GAME_W / 2, GAME_H - 16, "P: pause   R: restart   Esc: menu   M: mute", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#6a6a80",
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on("keydown-P", () => this.togglePause());
    kb.on("keydown-R", () => this.scene.restart({ mode: this.mode }));
    kb.on("keydown-ESC", () => {
      audio.stopBgm();
      this.scene.start("menu");
    });
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
    const g = this.game_;
    if (this.mode === "endless") {
      const b = g.boards[0];
      this.views[0].showOverlay(
        "GAME OVER",
        `SCORE ${b.score}\nMAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}\n\nR: restart   Esc: menu`,
      );
    } else {
      g.boards.forEach((b, i) => {
        const won = g.winner === i;
        this.views[i].showOverlay(
          won ? "WIN" : "LOSE",
          `MAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}\n\nR: rematch   Esc: menu`,
        );
      });
    }
  }
}
