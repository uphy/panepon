import { describe, expect, it } from "vitest";
import {
  Board,
  Game,
  NO_INPUT,
  PUZZLES,
  PUZZLES_PER_STAGE,
  PUZZLE_STAGES,
  boardForStage,
  countSolutions,
  formatRows,
  hasDeadKind,
  panelCount,
  parseRows,
  parseSolution,
  puzzleName,
  replayOnBoard,
  resolve,
  settle,
  solve,
  swapResolved,
  type PuzzleStage,
} from "../../src/core";
import { run } from "./helpers";

/** 1手で消える面。(2,0) と (3,0) を入れ替えると下段が 0 0 0 になる。 */
const ONE_MOVE: PuzzleStage = { moves: 1, rows: ["00.0.."] };
/** 往復の確認用。 */
const SHAPE: PuzzleStage = { moves: 2, rows: ["1.....", "1.....", "01....", "00.1.."] };

describe("パズル: 盤面の文字列", () => {
  it("行文字列と盤面を往復できる", () => {
    const g = parseRows(SHAPE.rows);
    expect(formatRows(g)).toEqual(SHAPE.rows);
    expect(panelCount(g)).toBe(7);
  });

  it("幅が違う行は受け付けない", () => {
    expect(() => parseRows(["00"])).toThrow();
  });
});

describe("パズル: ソルバーの盤面の進行", () => {
  it("床に着いた3つ並びが消えて上が落ちる", () => {
    const g = parseRows(["2.....", "000..."]);
    resolve(g);
    expect(formatRows(g)).toEqual(["2....."]);
  });

  it("浮いているパネルは落ちてから揃う", () => {
    // (0,1) の 0 は入れ替えで空中に出た想定。落ちて下段の 0 0 と揃う
    const g = parseRows(["0.....", ".00..."]);
    resolve(g);
    expect(panelCount(g)).toBe(0);
  });

  it("入れ替えで揃わないときは盤面だけ変わる", () => {
    const g = parseRows(["01...."]);
    const r = swapResolved(g, 0, 0)!;
    expect(formatRows(r)).toEqual(["10...."]);
    // 両方空、同じ柄の入れ替えは意味がない
    expect(swapResolved(g, 3, 0)).toBeNull();
    expect(swapResolved(parseRows(["00...."]), 0, 0)).toBeNull();
  });
});

describe("パズル: ソルバー", () => {
  it("1手の解を見つける", () => {
    const g = parseRows(ONE_MOVE.rows);
    expect(solve(g, 1)).toEqual([{ x: 2, y: 0 }]);
    expect(countSolutions(g, 1)).toBe(1);
  });

  it("2手の面は1手では解けない", () => {
    const st = PUZZLES.find((p) => p.moves === 2)!;
    const g = parseRows(st.rows);
    expect(solve(g, 1)).toBeNull();
    const sol = solve(g, 2);
    expect(sol).not.toBeNull();
    expect(sol!.length).toBe(2);
    expect(replayOnBoard(st, sol!)).toBe(true);
  });

  it("揃わない枚数の柄が残る面は解けない", () => {
    const g = parseRows(["00...."]);
    expect(hasDeadKind(g)).toBe(true);
    expect(solve(g, 3)).toBeNull();
  });

  it("盤面の数の上限を超えたら打ち切る", () => {
    const g = parseRows(PUZZLES[PUZZLES.length - 1].rows);
    expect(solve(g, 5, { maxStates: 1 })).toBeNull();
  });
});

describe("パズル: Board のルール", () => {
  it("せり上がりがなく、次の行もなく、手動せり上げも効かない", () => {
    const b = boardForStage(ONE_MOVE);
    expect(b.nextRow).toEqual([]);
    run(b, 2000, { ...NO_INPUT, raise: true });
    expect(b.stats.manualRows).toBe(0);
    expect(b.panelCount()).toBe(3);
    expect(b.movesLeft).toBe(1);
  });

  it("成功した入れ替えだけを手と数え、静止していない間は受け付けない", () => {
    const b = new Board({ seed: 1, kinds: 5, initialHeight: 0, moveLimit: 3 });
    b.setColumns([[0], [1], [], [], [], []]);
    b.cursor.x = 0;
    b.cursor.y = 0;
    // 空同士の入れ替えは失敗するので手数は減らない
    b.cursor.x = 3;
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(3);
    b.cursor.x = 0;
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(2);
    // 入れ替えのアニメーション中（4フレーム）は次の入れ替えを受け付けない
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(2);
    expect(settle(b)).toBe(true);
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(1);
    settle(b);
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(0);
    settle(b);
    // 手数が尽きたら入れ替えできない
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(0);
    expect(b.cell(0, 0).kind).toBe(1);
  });
});

describe("パズル: Game の判定", () => {
  it("全消しで clear", () => {
    const g = new Game({ mode: "puzzle", seed: 1, puzzle: ONE_MOVE });
    expect(g.puzzle).toBe(ONE_MOVE);
    expect(g.boards).toHaveLength(1);
    expect(g.finished).toBe(false);
    g.tick([{ ...NO_INPUT, cursorTo: { x: 2, y: 0 }, swap: true }]);
    for (let i = 0; i < 600 && !g.finished; i++) g.tick([NO_INPUT]);
    expect(g.finished).toBe(true);
    expect(g.puzzleResult).toBe("clear");
    expect(g.boards[0].gameOver).toBe(false);
  });

  it("手数を使い切ってパネルが残ったら fail。判定は盤面が静止してから", () => {
    const g = new Game({ mode: "puzzle", seed: 1, puzzle: ONE_MOVE });
    // 消えない入れ替え
    g.tick([{ ...NO_INPUT, cursorTo: { x: 0, y: 0 }, swap: true }]);
    expect(g.boards[0].movesLeft).toBe(0);
    expect(g.finished).toBe(false);
    for (let i = 0; i < 600 && !g.finished; i++) g.tick([NO_INPUT]);
    expect(g.finished).toBe(true);
    expect(g.puzzleResult).toBe("fail");
    expect(g.boards[0].panelCount()).toBe(3);
  });

  it("stage で面データを引く。範囲外は端に丸める", () => {
    expect(new Game({ mode: "puzzle", seed: 1, stage: 3 }).puzzle).toBe(PUZZLES[3]);
    expect(new Game({ mode: "puzzle", seed: 1, stage: 999 }).stage).toBe(PUZZLES.length - 1);
    expect(new Game({ mode: "endless", seed: 1 }).puzzle).toBeNull();
    expect(new Game({ mode: "endless", seed: 1 }).stage).toBe(-1);
  });
});

describe("パズル: 面データ", () => {
  it("6 ステージ × 10 面ある", () => {
    expect(PUZZLES).toHaveLength(PUZZLE_STAGES * PUZZLES_PER_STAGE);
    expect(puzzleName(0)).toBe("1-1");
    expect(puzzleName(PUZZLES.length - 1)).toBe("6-10");
  });

  it("各面は形が正しく、置いた時点で揃っておらず、揃わない柄も残っていない", () => {
    PUZZLES.forEach((st, i) => {
      const g = parseRows(st.rows);
      expect(st.rows.length, puzzleName(i)).toBeLessThanOrEqual(8);
      expect(st.moves, puzzleName(i)).toBeGreaterThanOrEqual(1);
      expect(st.moves, puzzleName(i)).toBeLessThanOrEqual(5);
      const settled = new Int8Array(g);
      resolve(settled);
      expect(formatRows(settled), puzzleName(i)).toEqual(st.rows);
      expect(hasDeadKind(g), puzzleName(i)).toBe(false);
    });
  });

  it("記録された解は手数どおりで、本物の Board で再生すると全消しになる", () => {
    PUZZLES.forEach((st, i) => {
      const sol = parseSolution(st.solution ?? "");
      expect(sol.length, puzzleName(i)).toBe(st.moves);
      expect(replayOnBoard(st, sol), puzzleName(i)).toBe(true);
    });
  });

  it("1手少なくては解けない（ソルバーの範囲で）", () => {
    PUZZLES.forEach((st, i) => {
      if (st.moves === 1) return;
      const g = parseRows(st.rows);
      expect(solve(g, st.moves - 1, { maxStates: 150_000 }), puzzleName(i)).toBeNull();
    });
  });

  it("同じ面が2つない", () => {
    const keys = new Set(PUZZLES.map((st) => st.rows.join("/")));
    expect(keys.size).toBe(PUZZLES.length);
  });
});
