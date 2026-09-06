import Phaser from "phaser";
import { Game, type CpuLevel, type GameMode, type Input, NO_INPUT } from "../core";
import { recordCpuResult, recordEndless } from "./highscore";
import { BoardView } from "./BoardView";
import { P1_KEYS, P2_KEYS, PlayerInput } from "./input";
import { audio } from "./shared";
import { haptics } from "./haptics";
import { TouchInput } from "./touch";
import { applyLayout } from "./hidpi";
import { Button } from "./ui";
import { wakeLock } from "./wakelock";
import { canShare, shareText } from "./share";
import { BOARD_H, BOARD_W, FONT, TEXT_COLOR, type Layout, layoutFor, sameLayout } from "./theme";

const STEP_MS = 1000 / 60;
/** 縦持ちの CPU 対戦で、CPU の盤面を描く大きさ。 */
const CPU_BOARD_SCALE = 0.5;

export class GameScene extends Phaser.Scene {
  private game_!: Game;
  views: BoardView[] = [];
  private inputs: PlayerInput[] = [];
  touches: TouchInput[] = [];
  private raiseHints: Phaser.GameObjects.Text[] = [];
  private accumulator = 0;
  /** 一時停止中か。P キー、または画面が隠れたときに true になる。 */
  paused = false;
  private mode: GameMode = "endless";
  private cpuLevel: CpuLevel = "normal";
  layout!: Layout;
  private vsText: Phaser.GameObjects.Text | null = null;
  private pauseButton!: Button;
  /** ポーズ画面。暗幕・見出し・ボタンをまとめた Container。 */
  pauseMenu!: Phaser.GameObjects.Container;
  private pauseDim!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseButtons: Button[] = [];
  private hintText!: Phaser.GameObjects.Text;
  private ended = false;
  /** 開始のカウントダウン中か。この間はゲームを進めない。 */
  starting = false;
  private wasDanger = false;
  /** ゲーム用に履歴を積んでいるか。メニューへ戻るときに1つ戻して消す。 */
  private historyPushed = false;

  constructor() {
    super("game");
  }

  create(data: { mode: GameMode; cpuLevel?: CpuLevel }): void {
    this.mode = data.mode ?? "endless";
    this.cpuLevel = data.cpuLevel ?? "normal";
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get("seed")) || (Date.now() & 0xffffff);
    const speedLevel = Number(params.get("speed")) || 1;
    const shockMax = params.has("shock") ? Number(params.get("shock")) || 0 : undefined;
    this.game_ = new Game({ mode: this.mode, seed, speedLevel, cpuLevel: this.cpuLevel, shockMax });
    this.accumulator = 0;
    this.paused = false;
    this.ended = false;
    this.wasDanger = false;
    this.views = [];
    this.inputs = [];
    this.touches.forEach((t) => t.destroy());
    this.touches = [];
    this.pauseButtons = [];

    this.layout = layoutFor(this.mode);
    applyLayout(this, this.layout);

    const boards = this.game_.boards;
    if (boards.length === 1) {
      this.views.push(new BoardView(this, boards[0], "1P", true));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      this.vsText = null;
    } else {
      const isCpu = this.mode === "cpu";
      this.views.push(new BoardView(this, boards[0], "1P", false));
      this.views.push(new BoardView(this, boards[1], isCpu ? `CPU ${this.cpuLevel.toUpperCase()}` : "2P", false));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      if (!isCpu) this.inputs.push(new PlayerInput(this, P2_KEYS, 1));
      this.vsText = this.add.text(0, 0, "VS", { fontFamily: FONT, fontSize: "28px", color: "#9a9ab0" }).setOrigin(0.5);
    }

    // タッチ・マウス操作。タップ・横ドラッグで入れ替え。どの端末でも受け付ける。CPU の盤面は触れない。
    boards.forEach((b, i) => {
      if (!this.inputs[i]) return;
      const t = new TouchInput(this, b);
      this.touches.push(t);
      this.inputs[i].touch = t;
    });
    // 盤面の外を押している間は手動せり上げ。対戦では左右どちらの盤面に近いかで振り分ける。
    // 盤面の下に薄い矢印を出し、押している間だけ明るくする。
    this.raiseHints = boards.map((_, i) =>
      this.add
        .text(0, 0, "▲ ▲ ▲", { fontFamily: FONT, fontSize: "16px", color: "#3a3a4c" })
        .setOrigin(0.5)
        .setVisible(Boolean(this.inputs[i])),
    );
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.ended) return;
      if (this.touches.some((t) => t.cellAt(p.worldX, p.worldY))) return;
      if (this.hintText.visible && p.worldY > this.layout.height - 22) return; // 画面下端のキー操作の案内
      let nearest = 0;
      if (this.touches.length === 2) nearest = p.worldX < this.layout.width / 2 ? 0 : 1;
      this.touches[nearest]?.raisePointers.add(p.id);
    });

    // 画面上のポーズボタン。ボタンは pointerdown を止めるので、せり上げにはならない
    this.pauseButton = new Button(this, 0, 0, "❚❚", () => this.togglePause(), { minWidth: 44, minHeight: 30, fontSize: 13 }).setDepth(5);

    // ポーズ画面。暗幕をタップしても再開する。ボタンで やり直し・音・振動・メニュー
    this.pauseDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.7).setOrigin(0);
    this.pauseTitle = this.add.text(0, 0, "PAUSE", { fontFamily: FONT, fontSize: "32px", color: TEXT_COLOR, fontStyle: "bold" }).setOrigin(0.5);
    const soundLabel = (): string => `SOUND: ${audio.muted ? "OFF" : "ON"}`;
    const vibLabel = (): string => `VIBRATION: ${haptics.enabled ? "ON" : "OFF"}`;
    this.pauseButtons.push(new Button(this, 0, 0, "RESUME", () => this.setPaused(false), { minWidth: 180, minHeight: 40 }));
    this.pauseButtons.push(new Button(this, 0, 0, "RESTART", () => this.restart(), { minWidth: 180, minHeight: 40 }));
    const toggleSound = (): void => {
      audio.setMuted(!audio.muted);
      soundBtn.setText(soundLabel());
    };
    const soundBtn = new Button(this, 0, 0, soundLabel(), toggleSound, { minWidth: 180, minHeight: 40 });
    this.pauseButtons.push(soundBtn);
    if (haptics.supported) {
      const vibBtn = new Button(
        this,
        0,
        0,
        vibLabel(),
        () => {
          haptics.toggle();
          vibBtn.setText(vibLabel());
        },
        { minWidth: 180, minHeight: 40 },
      );
      this.pauseButtons.push(vibBtn);
    }
    this.pauseButtons.push(new Button(this, 0, 0, "MENU", () => this.toMenu(), { minWidth: 180, minHeight: 40 }));
    this.pauseMenu = this.add.container(0, 0, [this.pauseDim, this.pauseTitle, ...this.pauseButtons]).setDepth(30).setVisible(false);
    // ポーズ中の暗幕タップは再開だけに使う（入れ替えにはしない）
    this.input.on("pointerdown", () => {
      if (this.paused && !this.ended) this.setPaused(false);
    });
    // 画面が隠れたら（別アプリへ切り替え、タブ移動、画面オフ）止めて、BGM も止める
    const onHidden = (): void => this.onHidden();
    this.game.events.on("hidden", onHidden);
    this.game.events.on("blur", onHidden);
    // Android の戻るジェスチャ・戻るボタンでアプリが閉じないよう、履歴を1つ積んで popstate を受ける。
    // 戻る1回目はポーズ、ポーズ中や終了後の戻るはメニューへ。
    history.pushState({ panepon: "game" }, "");
    this.historyPushed = true;
    const onPop = (): void => {
      if (!this.historyPushed) return;
      if (this.paused || this.ended) {
        this.historyPushed = false;
        this.toMenu();
        return;
      }
      history.pushState({ panepon: "game" }, "");
      this.setPaused(true);
    };
    window.addEventListener("popstate", onPop);
    // 回転・ウィンドウサイズの変更。連続して来るので少し待ってからレイアウトし直す
    let resizeTimer: number | null = null;
    const onResize = (): void => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        this.relayout();
      }, 150);
    };
    window.addEventListener("resize", onResize);
    // ゲーム中は画面をスリープさせない。メニューへ戻るときに外す
    void wakeLock.request();
    this.events.once("shutdown", () => {
      wakeLock.release();
      this.game.events.off("hidden", onHidden);
      this.game.events.off("blur", onHidden);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("resize", onResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    });
    // キーボード向けの案内。タッチ端末では出さない（ボタンがある）
    this.hintText = this.add
      .text(0, 0, "P: pause   R: restart   Esc: menu   M: mute", { fontFamily: FONT, fontSize: "12px", color: "#6a6a80" })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on("keydown-P", () => this.togglePause());
    kb.on("keydown-R", () => this.restart());
    kb.on("keydown-ESC", () => this.toMenu());
    kb.on("keydown-M", toggleSound);
    kb.on("keydown-V", () => haptics.toggle());
    kb.on("keydown", () => audio.start());
    this.input.on("pointerdown", () => audio.start());

    this.place();

    audio.start();
    audio.setDanger(false);
    // メニューの曲はここで止め、カウントダウン中は無音にする。ゲームの曲は START で始める
    audio.stopBgm();

    // e2e とデバッグ用。
    (window as unknown as { __panepon: unknown }).__panepon = {
      game: this.game_,
      scene: this,
      /** 論理サイズ。canvas は DPR 倍なので、テストは scale.width ではなくこちらで座標を換算する */
      layout: this.layout,
      tick: (inputs: Input[]) => this.stepOnce(inputs),
    };

    if (params.get("countdown") === "0") this.beginPlay();
    else this.runCountdown();
  }

  /** 画面の向きやサイズが変わったとき。レイアウトが変わるなら置き直す。ゲームの進行はそのまま。 */
  private relayout(): void {
    const next = layoutFor(this.mode);
    if (sameLayout(next, this.layout)) return;
    this.layout = next;
    applyLayout(this, next);
    this.place();
    (window as unknown as { __panepon: { layout: Layout } }).__panepon.layout = next;
  }

  /** 現在のレイアウトに合わせて、盤面と UI の位置を決める。 */
  private place(): void {
    const L = this.layout;
    const W = L.width;
    const H = L.height;
    const boards = this.game_.boards;
    const top = L.portrait ? 52 : 70;
    const placeBoard = (i: number, ox: number, oy: number, scale: number): void => {
      this.views[i].place(ox, oy, scale);
      this.touches[i]?.place(ox, oy, scale);
      this.raiseHints[i].setPosition(ox + (BOARD_W / 2) * scale, oy + BOARD_H * scale + (L.portrait ? 44 : 34));
    };
    if (boards.length === 1) {
      placeBoard(0, Math.floor((W - BOARD_W) / 2), top, 1);
    } else if (this.mode === "cpu" && L.portrait) {
      // 自分の盤面はエンドレスと同じ大きさ。CPU の盤面は右に小さく
      const cpuW = BOARD_W * CPU_BOARD_SCALE;
      const gap = 12;
      const ox1 = Math.floor((W - BOARD_W - gap - cpuW) / 2);
      placeBoard(0, ox1, top, 1);
      placeBoard(1, ox1 + BOARD_W + gap, top, CPU_BOARD_SCALE);
      this.vsText?.setVisible(false);
    } else {
      const gap = L.portrait ? 20 : 120;
      const ox1 = Math.floor(W / 2 - gap / 2 - BOARD_W);
      const ox2 = Math.floor(W / 2 + gap / 2);
      placeBoard(0, ox1, top, 1);
      placeBoard(1, ox2, top, 1);
      this.vsText?.setPosition(W / 2, top + BOARD_H / 2).setFontSize(L.portrait ? 18 : 28).setVisible(true);
    }
    // ポーズボタンは自分の盤面の右上（得点表示の右）
    const v0 = this.views[0];
    this.pauseButton.setPosition(v0.ox + BOARD_W - 22, top - 24);

    this.pauseDim.setSize(W, H);
    this.pauseTitle.setPosition(W / 2, H / 2 - 40 - this.pauseButtons.length * 23 - 20);
    this.pauseButtons.forEach((b, i) => b.setPosition(W / 2, H / 2 - (this.pauseButtons.length - 1) * 23 + i * 46));

    this.hintText.setPosition(W / 2, H - 14).setVisible(!L.touch);
  }

  /** 3・2・1・START のカウントダウン。各盤面の中央に出す。START でゲームが動き出し、BGM が始まる。 */
  private runCountdown(): void {
    this.starting = true;
    const texts = this.views.map((v) =>
      this.add
        .text(v.center.x, v.center.y, "", { fontFamily: FONT, fontSize: "64px", color: "#ffe066", fontStyle: "bold", stroke: "#1a1a2a", strokeThickness: 8 })
        .setOrigin(0.5)
        .setScale(v.scale)
        .setDepth(40),
    );
    const show = (label: string, big: boolean): void => {
      texts.forEach((text, i) => text.setText(label).setScale((big ? 1.8 : 1.5) * this.views[i].scale).setAlpha(1));
      texts.forEach((text, i) => this.tweens.add({ targets: text, scale: this.views[i].scale, duration: 180, ease: "Back.Out" }));
    };
    const STEP = 700;
    ["3", "2", "1"].forEach((label, i) => {
      this.time.delayedCall(i * STEP, () => {
        show(label, false);
        audio.count();
      });
    });
    this.time.delayedCall(3 * STEP, () => {
      show("START", true);
      this.beginPlay();
      this.tweens.add({ targets: texts, alpha: 0, delay: 400, duration: 250, onComplete: () => texts.forEach((t) => t.destroy()) });
    });
  }

  private beginPlay(): void {
    this.starting = false;
    this.touches.forEach((t) => t.clear());
    this.views.forEach((v) => v.resetTimer());
    this.accumulator = 0;
    audio.gameStart();
    audio.startBgm("game");
  }

  private restart(): void {
    this.scene.restart({ mode: this.mode, cpuLevel: this.cpuLevel });
  }

  private toMenu(): void {
    audio.stopBgm();
    this.touches.forEach((t) => t.destroy());
    this.touches = [];
    if (this.historyPushed) {
      // 自分で積んだ履歴を消す。popstate は shutdown で外したリスナーには届かない。
      this.historyPushed = false;
      this.scene.start("menu");
      history.back();
      return;
    }
    this.scene.start("menu");
  }

  private togglePause(): void {
    if (this.ended || this.starting) return;
    this.setPaused(!this.paused);
  }

  private setPaused(on: boolean): void {
    if (this.paused === on) return;
    this.paused = on;
    this.pauseMenu.setVisible(on);
    this.pauseButton.setVisible(!on);
    audio.pause(on);
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
    this.game_.boards.forEach((b, i) => this.views[i].handleEvents(b.events, true, Boolean(this.inputs[i])));
  }

  override update(_time: number, delta: number): void {
    if (!this.paused && !this.ended && !this.starting) {
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

  /** 結果を共有する。共有シートがなければクリップボードへコピーし、ボタンの文字で伝える。 */
  private async share(button: Button): Promise<void> {
    const g = this.game_;
    const b = g.boards[0];
    let text: string;
    if (this.mode === "endless") {
      text = `PANEPON  SCORE ${b.score}  MAX CHAIN x${b.maxChain}`;
    } else {
      const result = g.winner === 0 ? "WIN" : "LOSE";
      const foe = this.mode === "cpu" ? `CPU ${this.cpuLevel.toUpperCase()}` : "2P";
      text = `PANEPON  ${result} vs ${foe}  MAX CHAIN x${b.maxChain}`;
    }
    const outcome = await shareText(text);
    button.setText(outcome === "copied" ? "COPIED" : outcome === "failed" ? "SHARE FAILED" : "SHARE");
  }

  private finish(): void {
    this.ended = true;
    this.pauseButton.setVisible(false);
    const g = this.game_;
    // エンドレスと CPU に負けたときは負けの音、対戦は誰かが勝つので勝ちの音
    const humanWon = this.mode === "versus" ? g.winner >= 0 : this.mode === "cpu" && g.winner === 0;
    if (humanWon) {
      audio.win();
      haptics.win();
    } else {
      audio.lose();
      haptics.gameOver();
    }
    // 結果表示のあと、盤面の中をタップ（クリック）するとやり直す。自分の盤面には RETRY / MENU のボタンも出す
    this.time.delayedCall(800, () => {
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (this.touches.some((t) => t.cellAt(p.worldX, p.worldY))) this.restart();
      });
      const retry = new Button(this, -46, BOARD_H / 2 - 40, "RETRY", () => this.restart(), { minWidth: 84, minHeight: 36 });
      const menu = new Button(this, 46, BOARD_H / 2 - 40, "MENU", () => this.toMenu(), { minWidth: 84, minHeight: 36 });
      this.views[0].addToOverlay(retry);
      this.views[0].addToOverlay(menu);
      if (canShare()) {
        const share = new Button(this, 0, BOARD_H / 2 - 84, "SHARE", () => void this.share(share), { minWidth: 176, minHeight: 36 });
        this.views[0].addToOverlay(share);
      }
    });
    if (this.mode === "endless") {
      const b = g.boards[0];
      const rank = recordEndless(b.score, b.maxChain);
      const rankLine = rank === 1 ? "NEW RECORD!" : rank > 0 ? `RANK ${rank}` : "";
      this.views[0].showOverlay("GAME OVER", `SCORE ${b.score}\nMAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}\n${rankLine}`);
    } else {
      let recordLine = "";
      if (this.mode === "cpu" && g.winner >= 0) {
        const r = recordCpuResult(this.cpuLevel, g.winner === 0);
        recordLine = `\nVS ${this.cpuLevel.toUpperCase()}  ${r.wins}W ${r.losses}L`;
      }
      g.boards.forEach((b, i) => {
        const won = g.winner === i;
        this.views[i].showOverlay(won ? "WIN" : "LOSE", `MAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}${i === 0 ? recordLine : ""}`);
      });
    }
  }
}
