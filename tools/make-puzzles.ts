/**
 * パズルモードの面を生成して src/core/puzzles.ts に書く。
 *
 *   pnpm puzzles            # 既定の seed で 60 面
 *   pnpm puzzles -- 123     # seed を変える
 *
 * 面ごとに「手数・枚数・柄の種類・高さ」を決め、乱数で静止した盤面を作り、
 * ソルバーで「ちょうどその手数で解ける（1手少ないと解けない）」ものだけ残す。
 * 解は本物の Board で再生して全消しになることを確かめる。解の数が少ない面を優先する。
 */
import { writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { COLS, EMPTY, Rng } from "../src/core";
import {
  PUZZLES_PER_STAGE,
  PUZZLE_STAGES,
  countSolutions,
  emptyGrid,
  formatRows,
  formatSolution,
  gridKey,
  hasDeadKind,
  panelCount,
  puzzleName,
  replayOnBoard,
  resolve,
  solve,
  type Grid,
  type PuzzleStage,
} from "../src/core/puzzle";

/** 1面あたりの探索で広げる盤面の上限。これを超える面は重いので捨てる（生成が終わらなくなるのを防ぐ）。 */
const MAX_STATES = 150_000;

interface Spec {
  moves: number;
  panels: number;
  kinds: number;
  /** 各列の最大の高さ。 */
  height: number;
  /** 許す解の数（これ以下なら採用）。 */
  maxSolutions: number;
}

/** ステージごとの難しさ。面が進むほど枚数を増やす。 */
function specFor(stage: number, face: number): Spec {
  // stage, face とも 0 始まり
  const t = face / (PUZZLES_PER_STAGE - 1);
  const lerp = (a: number, b: number): number => Math.round(a + (b - a) * t);
  switch (stage) {
    case 0:
      return { moves: face < 6 ? 1 : 2, panels: face < 6 ? lerp(3, 7) : lerp(6, 8), kinds: face < 6 ? 2 : 3, height: 5, maxSolutions: 2 };
    case 1:
      return { moves: 2, panels: lerp(7, 10), kinds: 3, height: 6, maxSolutions: 2 };
    case 2:
      return { moves: face < 5 ? 2 : 3, panels: lerp(9, 12), kinds: 4, height: 7, maxSolutions: 2 };
    case 3:
      return { moves: 3, panels: lerp(10, 14), kinds: face < 5 ? 4 : 5, height: 7, maxSolutions: 2 };
    case 4:
      return { moves: 4, panels: lerp(11, 15), kinds: 5, height: 8, maxSolutions: 3 };
    default:
      return { moves: face < 5 ? 4 : 5, panels: lerp(13, 16), kinds: 5, height: 8, maxSolutions: 3 };
  }
}

/** 静止していて、揃いがなく、揃わない柄も残っていない盤面を1つ作る。 */
function randomGrid(rng: Rng, spec: Spec): Grid | null {
  for (let attempt = 0; attempt < 200; attempt++) {
    // 列の高さを配る
    const heights = new Array<number>(COLS).fill(0);
    let left = spec.panels;
    let guard = 0;
    while (left > 0 && guard++ < 1000) {
      const x = rng.int(COLS);
      if (heights[x] >= spec.height) continue;
      heights[x]++;
      left--;
    }
    if (left > 0) continue;
    const g = emptyGrid();
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < heights[x]; y++) g[y * COLS + x] = rng.int(spec.kinds);
    }
    // 置いた時点で揃っていたら作り直し
    const settled = new Int8Array(g);
    resolve(settled);
    if (panelCount(settled) !== spec.panels) continue;
    if (hasDeadKind(g)) continue;
    return g;
  }
  return null;
}

function generate(seed: number): PuzzleStage[] {
  const rng = new Rng(seed);
  const stages: PuzzleStage[] = [];
  const seen = new Set<string>();
  for (let s = 0; s < PUZZLE_STAGES; s++) {
    for (let f = 0; f < PUZZLES_PER_STAGE; f++) {
      const spec = specFor(s, f);
      const name = puzzleName(stages.length);
      const started = Date.now();
      let tried = 0;
      let best: { stage: PuzzleStage; solutions: number } | null = null;
      for (;;) {
        tried++;
        const g = randomGrid(rng, spec);
        if (!g) continue;
        if (seen.has(gridKey(g))) continue;
        // 最短の解がちょうど指定の手数のものだけ採る。探索が重すぎる面は捨てる
        const solution = solve(g, spec.moves, { maxStates: MAX_STATES });
        if (!solution || solution.length !== spec.moves) continue;
        const stage: PuzzleStage = { moves: spec.moves, rows: formatRows(g), solution: formatSolution(solution) };
        if (!replayOnBoard(stage, solution)) continue;
        const solutions = countSolutions(g, spec.moves, spec.maxSolutions + 1, { maxStates: MAX_STATES });
        if (!best || solutions < best.solutions) best = { stage, solutions };
        if (solutions <= spec.maxSolutions) break;
        // 解の数の条件を満たす面がなかなか出ないときは、いちばん解の少ないものを採る
        if (tried >= 2000) break;
      }
      if (!best) throw new Error(`${name}: 面を作れなかった`);
      seen.add(gridKey(parseBack(best.stage)));
      stages.push(best.stage);
      const ms = Date.now() - started;
      console.error(`${name}: ${spec.moves}手 ${spec.panels}枚 ${spec.kinds}種  解 ${best.solutions}  試行 ${tried}  ${ms}ms`);
    }
  }
  return stages;
}

function parseBack(stage: PuzzleStage): Grid {
  const g = emptyGrid();
  stage.rows.forEach((line, i) => {
    const y = stage.rows.length - 1 - i;
    for (let x = 0; x < COLS; x++) g[y * COLS + x] = line[x] === "." ? EMPTY : Number(line[x]);
  });
  return g;
}

function emit(stages: PuzzleStage[], seed: number): string {
  const lines: string[] = [];
  lines.push(`// tools/make-puzzles.ts が生成する（seed=${seed}）。手で直さない（直すなら生成し直す）。`);
  lines.push(`// rows は上から下へ、'.' が空、数字が柄。solution は「x,y」（x は左の列、y は下から数えた段）の並び。`);
  lines.push(`import type { PuzzleStage } from "./puzzle";`);
  lines.push(``);
  lines.push(`export const PUZZLES: PuzzleStage[] = [`);
  stages.forEach((st, i) => {
    lines.push(`  // ${puzzleName(i)}`);
    lines.push(`  {`);
    lines.push(`    moves: ${st.moves},`);
    lines.push(`    rows: [${st.rows.map((r) => `"${r}"`).join(", ")}],`);
    lines.push(`    solution: "${st.solution}",`);
    lines.push(`  },`);
  });
  lines.push(`];`);
  lines.push(``);
  return lines.join("\n");
}

const seed = Number(process.argv[2]) || 20260906;
const stages = generate(seed);
// esbuild で束ねて stdin から実行するので、出力先はリポジトリの直下（cwd）から決める
const out = resolvePath(process.cwd(), "src/core/puzzles.ts");
writeFileSync(out, emit(stages, seed));
console.error(`${stages.length} 面を ${out} に書いた`);
