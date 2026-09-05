import { describe, expect, it } from "vitest";
import { Board, COLS, CpuPlayer, Game, NO_INPUT, ROWS, type CpuLevel } from "../../src/core";

function playAlone(level: CpuLevel, seed: number, frames: number): Board {
  const b = new Board({ seed, speedLevel: 5 });
  const cpu = new CpuPlayer(b, level);
  for (let f = 0; f < frames && !b.gameOver; f++) b.tick(cpu.next());
  return b;
}

/** 2つの CPU を戦わせる。勝者（0 = 左）を返す。決着しなければ -1。 */
function duel(left: CpuLevel, right: CpuLevel, seed: number, maxFrames = 60 * 60 * 5): number {
  const game = new Game({ mode: "versus", seed, speedLevel: 10 });
  const a = new CpuPlayer(game.boards[0], left);
  const b = new CpuPlayer(game.boards[1], right);
  for (let f = 0; f < maxFrames && !game.finished; f++) game.tick([a.next(), b.next()]);
  return game.winner;
}

describe("CPU プレイヤー", () => {
  it("カーソルは1マスずつしか動かず、入れ替えはカーソル位置でだけ行う", () => {
    const b = new Board({ seed: 3, noRise: true });
    const cpu = new CpuPlayer(b, "hard");
    for (let f = 0; f < 600; f++) {
      const input = cpu.next();
      expect(Math.abs(input.moveX) + Math.abs(input.moveY)).toBeLessThanOrEqual(2);
      expect(input.cursorTo).toBeUndefined();
      b.tick(input);
      expect(b.cursor.x).toBeGreaterThanOrEqual(0);
      expect(b.cursor.x).toBeLessThanOrEqual(COLS - 2);
      expect(b.cursor.y).toBeLessThanOrEqual(ROWS - 1);
    }
  });

  it("どの難易度でも1分以内にパネルを消し、ゲームオーバーにならない", () => {
    for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
      for (let seed = 1; seed <= 3; seed++) {
        const b = playAlone(level, seed, 60 * 60);
        expect(b.gameOver, `${level} seed=${seed}`).toBe(false);
        expect(b.panelsCleared, `${level} seed=${seed}`).toBeGreaterThan(0);
      }
    }
  });

  it("hard は easy より多く消す", () => {
    let hard = 0;
    let easy = 0;
    for (let seed = 1; seed <= 3; seed++) {
      hard += playAlone("hard", seed, 60 * 60).panelsCleared;
      easy += playAlone("easy", seed, 60 * 60).panelsCleared;
    }
    expect(hard).toBeGreaterThan(easy);
  });

  it("hard と easy を4回戦わせると hard が3回以上勝つ", () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const w = duel("hard", "easy", seed);
      if (w === 0) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(3);
  });

  it("cpu モードの Game は 2P 側を CPU が動かし、1P が放置すると負ける", () => {
    const game = new Game({ mode: "cpu", seed: 5, speedLevel: 30, cpuLevel: "normal" });
    for (let f = 0; f < 60 * 60 * 5 && !game.finished; f++) game.tick([NO_INPUT]);
    expect(game.finished).toBe(true);
    expect(game.winner).toBe(1);
    expect(game.boards[1].panelsCleared).toBeGreaterThan(0);
  });
});
