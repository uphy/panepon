/**
 * CPU の難易度の強さ。無操作の相手と、遅い CPU（人の代わり）を相手に各難易度で対戦させる。
 * 難易度のパラメータを変えたときに、EASY が初心者に勝てる強さになっていないかを見る。
 *
 *   pnpm sim levels          8 試合ずつ
 *   pnpm sim levels 4        4 試合ずつ
 */
import { CpuPlayer, Game, NO_INPUT, type CpuLevel } from "../../src/core";
import { avg, casualPlayer, fmt } from "./proxy";

function run(left: "idle" | "casual", right: CpuLevel, seed: number) {
  const game = new Game({ mode: "versus", seed, speedLevel: 1 });
  const a = left === "casual" ? casualPlayer(game.boards[0]) : null;
  const b = new CpuPlayer(game.boards[1], right);
  let rows = 0;
  for (let f = 0; f < 60 * 60 * 5 && !game.finished; f++) {
    game.tick([a ? a.next() : NO_INPUT, b.next()]);
    for (const g of game.boards[1].attacksOut) rows += (g.height * g.width) / 6;
  }
  return { sec: game.boards[0].frame / 60, winner: game.winner, rows };
}

const games = Number(process.argv[2]) || 8;
for (const left of ["idle", "casual"] as const) {
  for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
    const rs = Array.from({ length: games }, (_, i) => run(left, level, i + 1));
    const wins = rs.filter((r) => r.winner === 0).length;
    const undecided = rs.filter((r) => r.winner === -1).length;
    console.log(
      `${left} vs ${level}: 試合時間 平均${fmt(avg(rs.map((r) => r.sec)))}s 最短${fmt(Math.min(...rs.map((r) => r.sec)), 0)} | 左の勝ち ${wins}/${games} 未決着（5分）${undecided} | CPU が送った段数 平均${fmt(avg(rs.map((r) => r.rows)))}`,
    );
  }
}
