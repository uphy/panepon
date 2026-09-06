/**
 * 対戦のシミュレーション。CPU 同士と、無操作 vs CPU を回して試合時間と攻撃量を出す。
 * おじゃまの送り方やせり上がりを変えたとき、「一瞬で負ける」試合が増えていないかをここで見る。
 *
 *   pnpm sim duel            12 試合ずつ
 *   pnpm sim duel 4          4 試合ずつ
 *   pnpm sim duel 12 1       seed=1 の normal 同士の攻撃の時系列も出す
 */
import { CpuPlayer, Game, NO_INPUT, type CpuLevel } from "../../src/core";
import { avg, fmt } from "./proxy";

function run(left: CpuLevel | "idle", right: CpuLevel, seed: number, speedLevel = 1) {
  const game = new Game({ mode: "versus", seed, speedLevel });
  const a = left === "idle" ? null : new CpuPlayer(game.boards[0], left);
  const b = new CpuPlayer(game.boards[1], right);
  let rowsB = 0;
  const recv: { f: number; rows: number }[] = [];
  const timeline: string[] = [];
  for (let f = 0; f < 60 * 60 * 5 && !game.finished; f++) {
    game.tick([a ? a.next() : NO_INPUT, b.next()]);
    const [A, B] = game.boards;
    for (const g of A.attacksOut) timeline.push(`${fmt(f / 60)}s L→R ${g.width}x${g.height}${g.type === "shock" ? "!" : ""}`);
    for (const g of B.attacksOut) {
      const rows = (g.height * g.width) / 6;
      rowsB += rows;
      recv.push({ f, rows });
      timeline.push(`${fmt(f / 60)}s R→L ${g.width}x${g.height}${g.type === "shock" ? "!" : ""}`);
    }
  }
  const [A, B] = game.boards;
  const end = A.frame;
  const last10 = recv.filter((r) => r.f >= end - 600).reduce((s, r) => s + r.rows, 0);
  return { sec: end / 60, winner: game.winner, rowsB, last10, maxChainB: B.maxChain, timeline };
}

const games = Number(process.argv[2]) || 12;
const showSeed = Number(process.argv[3]) || 0;
const pairs: [CpuLevel | "idle", CpuLevel][] = [
  ["normal", "normal"],
  ["hard", "hard"],
  ["idle", "easy"],
  ["idle", "normal"],
  ["idle", "hard"],
];
for (const [l, r] of pairs) {
  const rs: ReturnType<typeof run>[] = [];
  for (let seed = 1; seed <= games; seed++) {
    const res = run(l, r, seed);
    rs.push(res);
    if (showSeed && seed === showSeed && l === "normal" && r === "normal") console.log(res.timeline.join("\n"));
  }
  const secs = rs.map((x) => x.sec);
  const wl = rs.filter((x) => x.winner === 0).length;
  console.log(
    `${l} vs ${r}: 試合時間 平均${fmt(avg(secs))}s 最短${fmt(Math.min(...secs))} 最長${fmt(Math.max(...secs))} | 左の勝ち ${wl}/${games} | 右が送った段数 平均${fmt(avg(rs.map((x) => x.rowsB)))}（最後の10秒 平均${fmt(avg(rs.map((x) => x.last10)))}） | 右の最大連鎖 平均${fmt(avg(rs.map((x) => x.maxChainB)))}`,
  );
}
