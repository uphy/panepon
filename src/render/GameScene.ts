import Phaser from "phaser";
import { Game, type CpuLevel, type GameMode, type Input, NO_INPUT } from "../core";
import { recordCpuResult, recordEndless } from "./highscore";
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
  private raiseHints: Phaser.GameObjects.Text[] = [];
  private accumulator = 0;
  /** 一時停止中か。P キー、または画面が隠れたときに true になる。 */
  paused = false;
  private mode: GameMode = "endless";
  private cpuLevel: CpuLevel = "normal";
  private pauseText!: Phaser.GameObjects.Text;
  private ended = false;
  private wasDanger = false;

  constructor() {
    super("game");
  }

  create(data: { mode: GameMode; cpuLevel?: CpuLevel }): void {
    this.mode = data.mode ?? "endless";
    this.cpuLevel = data.cpuLevel ?? "normal";
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get("seed")) || (Date.now() & 0xffffff);
    const speedLevel = Number(params.get("speed")) || 1;
    this.game_ = new Game({ mode: this.mode, seed, speedLevel, cpuLevel: this.cpuLevel });
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
      const isCpu = this.mode === "cpu";
      this.views.push(new BoardView(this, boards[0], ox1, top, "1P", false));
      this.views.push(new BoardView(this, boards[1], ox2, top, isCpu ? `CPU ${this.cpuLevel.toUpperCase()}` : "2P", false));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      if (!isCpu) this.inputs.push(new PlayerInput(this, P2_KEYS, 1));
      this.add
        .text(W / 2, top + BOARD_H / 2, "VS", { fontFamily: FONT, fontSize: layout.portrait ? "18px" : "28px", color: "#9a9ab0" })
        .setOrigin(0.5);
    }

    // タッチ・マウス操作。タップ・横ドラッグで入れ替え。どの端末でも受け付ける。CPU の盤面は触れない。
    boards.forEach((b, i) => {
      if (!this.inputs[i]) return;
      const t = new TouchInput(this, b, origins[i], top);
      this.touches.push(t);
      this.inputs[i].touch = t;
    });
    // 盤面の外を押している間は手動せり上げ。対戦では左右どちらの盤面に近いかで振り分ける。
    // 盤面の下に薄い矢印を出し、押している間だけ明るくする。
    this.raiseHints = boards.map((_, i) =>
      this.add
        .text(origins[i] + BOARD_W / 2, top + BOARD_H + (layout.portrait ? 44 : 34), "▲ ▲ ▲", {
          fontFamily: FONT,
          fontSize: "16px",
          color: "#3a3a4c",
        })
        .setOrigin(0.5)
        .setVisible(Boolean(this.inputs[i])),
    );
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.ended) return;
      if (this.touches.some((t) => t.cellAt(p.x, p.y))) return;
      if (p.y > H - 22) return; // 画面下端のメニュー用テキスト
      let nearest = 0;
      if (this.touches.length === 2) nearest = p.x < W / 2 ? 0 : 1;
      this.touches[nearest]?.raisePointers.add(p.id);
    });

    this.pauseText = this.add
      .text(W / 2, H / 2, "PAUSE\n\ntap / P to resume", { fontFamily: FONT, fontSize: "28px", color: TEXT_COLOR, align: "center" })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);
    // ポーズ中のタップ・クリックは再開だけに使う（入れ替えにはしない）
    this.input.on("pointerdown", () => {
      if (this.paused && !this.ended) this.setPaused(false);
    });
    // 画面が隠れたら（別アプリへ切り替え、タブ移動、画面オフ）止めて、BGM も止める
    const onHidden = (): void => this.onHidden();
    this.game.events.on("hidden", onHidden);
    this.game.events.on("blur", onHidden);
    this.events.once("shutdown", () => {
      this.game.events.off("hidden", onHidden);
      this.game.events.off("blur", onHidden);
    });
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
    kb.on("keydown-R", () => this.scene.restart({ mode: this.mode, cpuLevel: this.cpuLevel }));
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
    this.setPaused(!this.paused);
  }

  private setPaused(on: boolean): void {
    if (this.paused === on) return;
    this.paused = on;
    this.pauseText.setVisible(on);
    if (on) {
      audio.suspend();
    } else {
      this.touches.forEach((t) => t.clear());
      this.accumulator = 0;
      audio.resume();
    }
  }

  private onHidden(): void {
    if (this.ended) {
      audio.suspend();
      return;
    }
    this.setPaused(true);
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
    this.raiseHints.forEach((h, i) => {
      const on = this.inputs[i]?.lastRaise ?? false;
      h.setColor(on ? "#dcdcea" : "#3a3a4c");
    });
  }

  private finish(): void {
    this.ended = true;
    audio.stopBgm();
    // 結果表示のあと、盤面の中をタップ（クリック）するとやり直す
    this.time.delayedCall(800, () => {
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (this.touches.some((t) => t.cellAt(p.x, p.y))) this.scene.restart({ mode: this.mode, cpuLevel: this.cpuLevel });
      });
    });
    const g = this.game_;
    if (this.mode === "endless") {
      const b = g.boards[0];
      const rank = recordEndless(b.score, b.maxChain);
      const rankLine = rank === 1 ? "NEW RECORD!" : rank > 0 ? `RANK ${rank}` : "";
      this.views[0].showOverlay(
        "GAME OVER",
        `SCORE ${b.score}\nMAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}\n${rankLine}\n\nR / tap: restart   Esc: menu`,
      );
    } else {
      let recordLine = "";
      if (this.mode === "cpu" && g.winner >= 0) {
        const r = recordCpuResult(this.cpuLevel, g.winner === 0);
        recordLine = `\nVS ${this.cpuLevel.toUpperCase()}  ${r.wins}W ${r.losses}L`;
      }
      g.boards.forEach((b, i) => {
        const won = g.winner === i;
        this.views[i].showOverlay(
          won ? "WIN" : "LOSE",
          `MAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}${i === 0 ? recordLine : ""}\n\nR / tap: rematch   Esc: menu`,
        );
      });
    }
  }
}
