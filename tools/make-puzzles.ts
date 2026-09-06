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
  solutionSignature,
  solve,
  type Grid,
  type PuzzleStage,
  type Technique,
} from "../src/core/puzzle";

/** 1面あたりの探索で広げる盤面の上限。これを超える面は重いので捨てる（生成が終わらなくなるのを防ぐ）。 */
const MAX_STATES = 150_000;

interface Spec {
  moves: number;
  panels: number;
  kinds: number;
  /** 各列の最大の高さ。 */
  height: number;
  /** パネルを置く列の最小数。少ないと1本の塔ばかりになる。 */
  minCols: number;
  /** 許す解の数（これ以下なら採用）。 */
  maxSolutions: number;
  /** 解のどこかで必ず使う技法（`solutionSignature` の文字）。 */
  need: Technique[];
  /** 解に出てはいけない技法。STAGE 1 で技法を1つずつ見せるために使う。 */
  avoid?: Technique[];
}

/**
 * ステージごとの難しさ。
 *
 * 面が進むほど手数・枚数・柄を増やすだけでは、同じ解き方の面が並ぶ（以前の 1-1〜1-6 は全部「横に1枚ずらす」だった）。
 * そこで面ごとに使う技法を指定し、同じステージの中では解の技法の並び（signature）が重ならないようにする。
 *
 * - STAGE 1: 1手で技法を1つずつ覚える（横・縦・落として揃える・連鎖・同時消し）。後半は2手
 * - STAGE 2: 2手→3手、柄3種
 * - STAGE 3: 3手、柄3→4種
 * - STAGE 4: 3手→4手、柄4種
 * - STAGE 5: 4手、柄4→5種
 * - STAGE 6: 4手→5手、柄5種
 */
function specFor(stage: number, face: number): Spec {
  // stage, face とも 0 始まり
  const t = face / (PUZZLES_PER_STAGE - 1);
  const lerp = (a: number, b: number): number => Math.round(a + (b - a) * t);
  // 2手以上の面は、技法を順に回して各ステージに縦・連鎖・同時消し・落下が1回ずつは入るようにする
  const rotate: Technique[][] = [["V"], ["C"], ["D"], ["F"], ["N"]];
  const rot = rotate[face % rotate.length];
  switch (stage) {
    case 0: {
      // 1手の面は全部を1手で消すので、柄が2種あれば必ず連鎖か同時消しになる。技法を1つずつ見せる順に並べる
      const faces: Spec[] = [
        {
          moves: 1,
          panels: 3,
          kinds: 1,
          height: 1,
          minCols: 3,
          maxSolutions: 1,
          need: ["H"],
        },
        {
          moves: 1,
          panels: 5,
          kinds: 1,
          height: 3,
          minCols: 3,
          maxSolutions: 1,
          need: ["F"],
          avoid: ["C", "D", "V"],
        },
        {
          moves: 1,
          panels: 6,
          kinds: 2,
          height: 4,
          minCols: 2,
          maxSolutions: 1,
          need: ["V"],
          avoid: ["F", "D"],
        },
        {
          moves: 1,
          panels: 7,
          kinds: 2,
          height: 4,
          minCols: 3,
          maxSolutions: 1,
          need: ["C"],
          avoid: ["D", "V"],
        },
        {
          moves: 1,
          panels: 6,
          kinds: 2,
          height: 3,
          minCols: 2,
          maxSolutions: 1,
          need: ["D"],
          avoid: ["C"],
        },
        {
          moves: 2,
          panels: 6,
          kinds: 1,
          height: 3,
          minCols: 3,
          maxSolutions: 2,
          need: [],
          avoid: ["C", "D", "F"],
        },
        {
          moves: 2,
          panels: 7,
          kinds: 2,
          height: 4,
          minCols: 3,
          maxSolutions: 2,
          need: ["N"],
          avoid: ["D"],
        },
        {
          moves: 2,
          panels: 8,
          kinds: 2,
          height: 4,
          minCols: 4,
          maxSolutions: 2,
          need: ["F"],
          avoid: ["N"],
        },
        {
          moves: 2,
          panels: 8,
          kinds: 3,
          height: 4,
          minCols: 4,
          maxSolutions: 2,
          need: ["V"],
        },
        {
          moves: 2,
          panels: 9,
          kinds: 3,
          height: 4,
          minCols: 4,
          maxSolutions: 2,
          need: ["D"],
        },
      ];
      return faces[face];
    }
    case 1:
      return {
        moves: face < 4 ? 2 : 3,
        panels: lerp(8, 12),
        kinds: 3,
        height: 5,
        minCols: 4,
        maxSolutions: 2,
        need: rot,
      };
    case 2:
      return {
        moves: 3,
        panels: lerp(10, 13),
        kinds: face < 5 ? 3 : 4,
        height: 6,
        minCols: 4,
        maxSolutions: 2,
        need: rot,
      };
    case 3:
      return {
        moves: face < 3 ? 3 : 4,
        panels: lerp(11, 14),
        kinds: 4,
        height: 7,
        minCols: 4,
        maxSolutions: 2,
        need: rot,
      };
    case 4:
      return {
        moves: 4,
        panels: lerp(12, 15),
        kinds: face < 5 ? 4 : 5,
        height: 7,
        minCols: 5,
        maxSolutions: 3,
        need: rot,
      };
    default:
      return {
        moves: face < 4 ? 4 : 5,
        panels: lerp(14, 16),
        kinds: 5,
        height: 8,
        minCols: 5,
        maxSolutions: 3,
        need: rot,
      };
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
    if (heights.filter((h) => h > 0).length < spec.minCols) continue;
    const g = emptyGrid();
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < heights[x]; y++)
        g[y * COLS + x] = rng.int(spec.kinds);
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

/** 面の候補。採用の優先順は 技法を満たす > ステージ内で signature が重ならない > 解が少ない。 */
interface Candidate {
  stage: PuzzleStage;
  signature: string;
  needOk: boolean;
  uniqueOk: boolean;
  solutions: number;
}

function better(a: Candidate, b: Candidate | null): boolean {
  if (!b) return true;
  if (a.needOk !== b.needOk) return a.needOk;
  if (a.uniqueOk !== b.uniqueOk) return a.uniqueOk;
  return a.solutions < b.solutions;
}

/** 1面あたりの試行の上限。これまでに条件を全部満たす面がなければ、いちばん良いものを採る。 */
const MAX_TRIES = 6000;

function generate(seed: number): {
  stages: PuzzleStage[];
  signatures: string[];
} {
  const rng = new Rng(seed);
  const stages: PuzzleStage[] = [];
  const signatures: string[] = [];
  const seen = new Set<string>();
  for (let s = 0; s < PUZZLE_STAGES; s++) {
    const stageSigs = new Set<string>();
    for (let f = 0; f < PUZZLES_PER_STAGE; f++) {
      const spec = specFor(s, f);
      const name = puzzleName(stages.length);
      const started = Date.now();
      let tried = 0;
      let best: Candidate | null = null;
      for (;;) {
        tried++;
        const g = randomGrid(rng, spec);
        if (!g) continue;
        if (seen.has(gridKey(g))) continue;
        // 最短の解がちょうど指定の手数のものだけ採る。探索が重すぎる面は捨てる
        const solution = solve(g, spec.moves, { maxStates: MAX_STATES });
        if (!solution || solution.length !== spec.moves) continue;
        const stage: PuzzleStage = {
          moves: spec.moves,
          rows: formatRows(g),
          solution: formatSolution(solution),
        };
        if (!replayOnBoard(stage, solution)) continue;
        const signature = solutionSignature(g, solution);
        const needOk =
          spec.need.every((k) => signature.includes(k)) &&
          !(spec.avoid ?? []).some((k) => signature.includes(k));
        // 技法を満たさない面は、上限に近づくまで候補にもしない（満たす面が出る余地を残す）
        if (!needOk && tried < MAX_TRIES / 2) continue;
        const uniqueOk = !stageSigs.has(signature);
        const solutions = countSolutions(g, spec.moves, spec.maxSolutions + 1, {
          maxStates: MAX_STATES,
        });
        const c: Candidate = { stage, signature, needOk, uniqueOk, solutions };
        if (better(c, best)) best = c;
        if (needOk && uniqueOk && solutions <= spec.maxSolutions) break;
        if (tried >= MAX_TRIES) break;
      }
      if (!best) throw new Error(`${name}: 面を作れなかった`);
      seen.add(gridKey(parseBack(best.stage)));
      stageSigs.add(best.signature);
      stages.push(best.stage);
      signatures.push(best.signature);
      const ms = Date.now() - started;
      const warn =
        (best.needOk ? "" : " 技法×") + (best.uniqueOk ? "" : " 重複");
      console.error(
        `${name}: ${spec.moves}手 ${spec.panels}枚 ${spec.kinds}種  ${best.signature.padEnd(14)} 解 ${best.solutions}  試行 ${tried}  ${ms}ms${warn}`,
      );
    }
  }
  return { stages, signatures };
}

function parseBack(stage: PuzzleStage): Grid {
  const g = emptyGrid();
  stage.rows.forEach((line, i) => {
    const y = stage.rows.length - 1 - i;
    for (let x = 0; x < COLS; x++)
      g[y * COLS + x] = line[x] === "." ? EMPTY : Number(line[x]);
  });
  return g;
}

function emit(
  stages: PuzzleStage[],
  signatures: string[],
  seed: number,
): string {
  const lines: string[] = [];
  lines.push(
    `// tools/make-puzzles.ts が生成する（seed=${seed}）。手で直さない（直すなら生成し直す）。`,
  );
  lines.push(
    `// rows は上から下へ、'.' が空、数字が柄。solution は「x,y」（x は左の列、y は下から数えた段）の並び。`,
  );
  lines.push(`// 面名の横は解の技法の並び（puzzle.ts の solutionSignature）。`);
  lines.push(`import type { PuzzleStage } from "./puzzle";`);
  lines.push(``);
  lines.push(`export const PUZZLES: PuzzleStage[] = [`);
  stages.forEach((st, i) => {
    lines.push(`  // ${puzzleName(i)}  ${signatures[i]}`);
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
const { stages, signatures } = generate(seed);
// esbuild で束ねて stdin から実行するので、出力先はリポジトリの直下（cwd）から決める
const out = resolvePath(process.cwd(), "src/core/puzzles.ts");
writeFileSync(out, emit(stages, signatures, seed));
console.error(`${stages.length} 面を ${out} に書いた`);
