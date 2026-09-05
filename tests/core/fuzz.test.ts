import { describe, expect, it } from "vitest";
import { COLS, Game, Rng, SCORE_CAP, TOTAL_ROWS, isEmptyCell, type Input } from "../../src/core";

/** 盤面とおじゃま台帳の整合性。ランダム入力で長時間回しても崩れないことを確かめる。 */
function checkInvariants(game: Game): void {
  for (const b of game.boards) {
    expect(b.score).toBeLessThanOrEqual(SCORE_CAP);
    const seen = new Map<number, number>();
    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = b.cells[r][c];
        if (cell.garbage >= 0) {
          const g = b.garbage.get(cell.garbage);
          expect(g, `garbage id ${cell.garbage} at (${c},${r}) has no block`).toBeDefined();
          expect(c >= g!.x && c < g!.x + g!.width && r >= g!.y && r < g!.y + g!.height).toBe(true);
          seen.set(cell.garbage, (seen.get(cell.garbage) ?? 0) + 1);
        }
      }
    }
    for (const g of b.garbage.values()) {
      expect(seen.get(g.id), `block ${g.id} cell count`).toBe(g.width * g.height);
      for (let r = g.y; r < g.y + g.height; r++) {
        for (let c = g.x; c < g.x + g.width; c++) expect(b.cells[r][c].garbage).toBe(g.id);
      }
    }
    // 浮いている idle パネルがない（重力が抜けていない）
    for (let r = 1; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = b.cells[r][c];
        if (cell.kind >= 0 && cell.garbage < 0 && cell.state === "idle") {
          expect(isEmptyCell(b.cells[r - 1][c]), `floating idle panel at (${c},${r})\n${b}`).toBe(false);
        }
      }
    }
  }
}

function randomInput(rng: Rng): Input {
  const r = rng.next();
  return {
    moveX: r < 0.2 ? -1 : r < 0.4 ? 1 : 0,
    moveY: r >= 0.4 && r < 0.55 ? -1 : r >= 0.55 && r < 0.7 ? 1 : 0,
    swap: rng.next() < 0.3,
    raise: rng.next() < 0.05,
  };
}

describe("ランダム入力での長時間実行", () => {
  it("エンドレス: 例外なく進み、盤面の整合性が保たれる", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const game = new Game({ mode: "endless", seed, speedLevel: 20 });
      const rng = new Rng(seed * 7919);
      for (let f = 0; f < 4000 && !game.finished; f++) {
        game.tick([randomInput(rng)]);
        if (f % 50 === 0) checkInvariants(game);
      }
      checkInvariants(game);
    }
  });

  it("対戦: 攻撃が行き交っても整合性が保たれ、いずれ勝敗が付く", () => {
    let decided = 0;
    let attacks = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const game = new Game({ mode: "versus", seed, speedLevel: 40 });
      const rng = new Rng(seed * 104729);
      for (let f = 0; f < 20000 && !game.finished; f++) {
        game.tick([randomInput(rng), randomInput(rng)]);
        attacks += game.boards[0].attacksOut.length + game.boards[1].attacksOut.length;
        if (f % 50 === 0) checkInvariants(game);
      }
      checkInvariants(game);
      if (game.finished) {
        decided++;
        expect([0, 1]).toContain(game.winner);
      }
    }
    expect(attacks).toBeGreaterThan(0);
    expect(decided).toBeGreaterThan(0);
  });
});
