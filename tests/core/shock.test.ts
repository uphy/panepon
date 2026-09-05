import { describe, expect, it } from "vitest";
import {
  Board,
  COLS,
  CpuPlayer,
  Game,
  NO_INPUT,
  ROWS,
  SHOCK_KIND,
  TIMING,
  garbageFromShock,
  isPanel,
} from "../../src/core";
import { matches, moveCursor, press, run } from "./helpers";

const RAISE = { ...NO_INPUT, raise: true };

describe("ビックリパネルの攻撃", () => {
  it("n個消しで「n-2」枚の幅6・厚さ1段の灰色の板を送る。最大5枚", () => {
    expect(garbageFromShock(2)).toEqual([]);
    expect(garbageFromShock(3)).toEqual([{ width: 6, height: 1, type: "shock" }]);
    expect(garbageFromShock(4)).toHaveLength(2);
    expect(garbageFromShock(7)).toHaveLength(5);
    expect(garbageFromShock(9)).toHaveLength(5);
  });

  it("ビックリパネルの3個消しは灰色の板を送り、通常パネルの3個消しは何も送らない", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns([[SHOCK_KIND], [SHOCK_KIND], [1], [SHOCK_KIND], [2], [3]]);
    moveCursor(b, 2, 0);
    const events = press(b, { swap: true }, TIMING.swap + 2);
    const m = matches(events);
    expect(m[0]?.panels).toBe(3);
    expect(b.score).toBe(30);
    const attack = events.find((e) => e.type === "attack");
    expect(attack && attack.type === "attack" ? attack.garbage : []).toEqual([{ width: 6, height: 1, type: "shock" }]);
    expect(b.stats.shockCleared).toBe(3);

    const c = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    c.setColumns([[0], [0], [1], [0]]);
    moveCursor(c, 2, 0);
    const ev2 = press(c, { swap: true }, TIMING.swap + 2);
    expect(matches(ev2)[0]?.panels).toBe(3);
    expect(ev2.some((e) => e.type === "attack")).toBe(false);
  });

  it("ビックリパネルは通常の柄とは揃わない", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns([[0], [0], [1], [SHOCK_KIND]]);
    moveCursor(b, 2, 0);
    const events = press(b, { swap: true }, 60);
    expect(b.cell(2, 0).kind).toBe(SHOCK_KIND);
    expect(matches(events)).toHaveLength(0);
  });
});

describe("ビックリパネルの出現", () => {
  it("1人用（shockMax 0）では出ない", () => {
    const b = new Board({ seed: 3, speedLevel: 30 });
    const cpu = new CpuPlayer(b, "hard");
    for (let f = 0; f < 60 * 60 && !b.gameOver; f++) b.tick(cpu.next());
    expect(b.panelsCleared).toBeGreaterThan(24);
    expect(b.stats.shockSpawned).toBe(0);
    expect(b.nextRow).not.toContain(SHOCK_KIND);
  });

  it("消した枚数が shockEvery を跨ぐと次のせり上がり行に1枚混ざり、上限で止まる", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 1, noRise: true, shockMax: 2, shockEvery: 3 });
    // 3枚消す → 次に生成される行に1枚入る
    b.setColumns([[0], [0], [1], [0], [3], [4]]);
    moveCursor(b, 2, 0);
    press(b, { swap: true }, 200);
    expect(b.panelsCleared).toBe(3);
    expect(b.nextRow).not.toContain(SHOCK_KIND); // 生成済みの行には入らない
    run(b, TIMING.manualRisePerRow, RAISE);
    expect(b.nextRow.filter((k) => k === SHOCK_KIND)).toHaveLength(1);
    expect(b.stats.shockSpawned).toBe(1);
    run(b, TIMING.manualRisePerRow, RAISE);
    expect(b.cells[0].filter((c) => isPanel(c) && c.kind === SHOCK_KIND)).toHaveLength(1);
    // 予約は1回ぶんだけ。続けてせり上げても増えない
    run(b, TIMING.manualRisePerRow * 3, RAISE);
    expect(b.stats.shockSpawned).toBe(1);
    let shocks = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isPanel(b.cells[r][c]) && b.cells[r][c].kind === SHOCK_KIND) shocks++;
    expect(shocks).toBe(1);
  });

  it("対戦では両方の盤面に出て、1試合の上限を超えない", () => {
    // easy 同士は試合が長引くので、両方の盤面が12枚以上消してせり上がりも進む
    const game = new Game({ mode: "versus", seed: 1, speedLevel: 10, shockMax: 6 });
    const a = new CpuPlayer(game.boards[0], "easy");
    const b = new CpuPlayer(game.boards[1], "easy");
    for (let f = 0; f < 60 * 60 * 3 && !game.finished; f++) game.tick([a.next(), b.next()]);
    const spawned = game.boards.map((board) => board.stats.shockSpawned);
    expect(spawned[0] + spawned[1]).toBeGreaterThan(0);
    for (const board of game.boards) {
      expect(board.stats.shockSpawned).toBeLessThanOrEqual(6);
      // 12枚以上消してせり上がりも進んだ盤面には必ず出ている
      if (board.panelsCleared >= 24) expect(board.stats.shockSpawned).toBeGreaterThan(0);
    }
  });
});

describe("灰色のおじゃま", () => {
  it("灰色のおじゃまと通常のおじゃまは同時に変身しない（サンドイッチ）", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns([[0], [0], [1], [0], [2], [3]]);
    b.placeGarbage(0, 1, 6, 1, "shock");
    b.placeGarbage(0, 2, 6, 1, "normal");
    run(b, 1);
    moveCursor(b, 2, 0);
    const events = press(b, { swap: true }, 400);
    expect(matches(events)[0]?.panels).toBe(3);
    // 灰色の板は変身して消え、通常の板は残る
    const remaining = [...b.garbage.values()];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("normal");
    // 変身で出たパネルにビックリパネルは混ざらない
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = b.cells[r][c];
        if (isPanel(cell)) expect(cell.kind).not.toBe(SHOCK_KIND);
      }
    }
  });

  it("接している同種の灰色の板は一緒に変身する", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns([[0], [0], [1], [0], [2], [3]]);
    b.placeGarbage(0, 1, 6, 1, "shock");
    b.placeGarbage(0, 2, 6, 1, "shock");
    run(b, 1);
    moveCursor(b, 2, 0);
    press(b, { swap: true }, 400);
    expect(b.garbage.size).toBe(0);
  });
});
