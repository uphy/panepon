import { describe, expect, it } from "vitest";
import { Board, FRAMES_PER_LEVEL, Game, NO_INPUT, PANELS_PER_LEVEL } from "../../src/core";
import { run } from "./helpers";

function board(speedUp: boolean, speedLevel = 1): Board {
  return new Board({ seed: 1, speedLevel, speedUp, noRise: true, initialHeight: 0 });
}

describe("スピードレベル（エンドレス・タイムアタック）", () => {
  it("消した枚数 PANELS_PER_LEVEL ごとに1上がる", () => {
    const b = board(true);
    b.panelsCleared = PANELS_PER_LEVEL * 2 + 5;
    const events = run(b, 1);
    expect(b.level).toBe(3);
    expect(events.filter((e) => e.type === "levelUp").map((e) => (e as { level: number }).level)).toEqual([3]);
  });

  it("消していなくても FRAMES_PER_LEVEL ごとに1上がる", () => {
    const b = board(true);
    run(b, FRAMES_PER_LEVEL - 1);
    expect(b.level).toBe(1);
    run(b, 1);
    expect(b.level).toBe(2);
    run(b, FRAMES_PER_LEVEL);
    expect(b.level).toBe(3);
  });

  it("枚数と時間の高い方を採り、下がらない", () => {
    const b = board(true);
    b.panelsCleared = PANELS_PER_LEVEL * 4;
    run(b, 1);
    expect(b.level).toBe(5);
    // 時間によるレベルはまだ1なので、そのまま
    run(b, FRAMES_PER_LEVEL);
    expect(b.level).toBe(5);
    // 時間が追い越したら時間で上がる
    run(b, FRAMES_PER_LEVEL * 4);
    expect(b.level).toBe(6);
  });

  it("開始レベルを起点にし、99 で止まる", () => {
    const b = board(true, 98);
    run(b, FRAMES_PER_LEVEL * 5);
    expect(b.level).toBe(99);
  });

  it("パズル（speedUp なし）では時間が経っても枚数を消しても上がらない", () => {
    const b = board(false);
    b.panelsCleared = 100;
    run(b, FRAMES_PER_LEVEL * 3);
    expect(b.level).toBe(1);
  });

  it("対戦では2つの盤面のレベルを高い方に揃える。片方が多く消せば両方が速くなる", () => {
    const game = new Game({ mode: "versus", seed: 1 });
    const [a, b] = game.boards;
    a.panelsCleared = PANELS_PER_LEVEL * 3;
    game.tick([NO_INPUT, NO_INPUT]);
    expect(a.level).toBe(4);
    expect(b.level).toBe(4);
    // 時間でも両方が上がる
    for (let f = 0; f < FRAMES_PER_LEVEL * 4; f++) game.tick([NO_INPUT, NO_INPUT]);
    expect(a.level).toBe(5);
    expect(b.level).toBe(5);
  });

  it("パズルではレベルが上がらない", () => {
    const game = new Game({ mode: "puzzle", seed: 1, stage: 0 });
    for (let f = 0; f < FRAMES_PER_LEVEL * 2; f++) game.tick([NO_INPUT]);
    expect(game.boards[0].level).toBe(1);
  });
});
