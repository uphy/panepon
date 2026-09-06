import { describe, expect, it } from "vitest";
import { Game, NO_INPUT, TIME_ATTACK_FRAMES } from "../../src/core";

describe("タイムアタック", () => {
  it("制限時間は既定で2分（7200フレーム）", () => {
    const g = new Game({ mode: "timeattack", seed: 1 });
    expect(g.timeLimit).toBe(TIME_ATTACK_FRAMES);
    expect(TIME_ATTACK_FRAMES).toBe(120 * 60);
    expect(g.framesLeft).toBe(TIME_ATTACK_FRAMES);
  });

  it("時間切れで終わる。盤面はゲームオーバーにならず得点が残る", () => {
    const g = new Game({ mode: "timeattack", seed: 1, timeLimitFrames: 300 });
    for (let i = 0; i < 299; i++) g.tick([NO_INPUT]);
    expect(g.finished).toBe(false);
    expect(g.framesLeft).toBe(1);
    g.tick([NO_INPUT]);
    expect(g.finished).toBe(true);
    expect(g.timeUp).toBe(true);
    expect(g.boards[0].gameOver).toBe(false);
    expect(g.framesLeft).toBe(0);
    // 終わったあとは進まない
    g.tick([NO_INPUT]);
    expect(g.boards[0].frame).toBe(300);
  });

  it("時間内に天井へ届いたら通常のゲームオーバー", () => {
    const g = new Game({ mode: "timeattack", seed: 1, timeLimitFrames: 100_000 });
    // 手動せり上げを押し続けて天井まで積む
    for (let i = 0; i < 20_000 && !g.finished; i++) g.tick([{ ...NO_INPUT, raise: true }]);
    expect(g.finished).toBe(true);
    expect(g.timeUp).toBe(false);
    expect(g.boards[0].gameOver).toBe(true);
  });

  it("他のモードには制限時間がない", () => {
    expect(new Game({ mode: "endless", seed: 1 }).timeLimit).toBeNull();
    expect(new Game({ mode: "endless", seed: 1 }).framesLeft).toBeNull();
    expect(new Game({ mode: "cpu", seed: 1 }).timeLimit).toBeNull();
  });
});
