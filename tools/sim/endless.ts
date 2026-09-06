/**
 * エンドレスのシミュレーション。遅い CPU（人の代わり）と easy / normal にエンドレスを遊ばせ、
 * 生存時間と各レベルへの到達時刻を出す。1回のプレイの長さを調整するときに見る。
 *
 *   pnpm sim endless         seed 1〜6
 *   pnpm sim endless 3       seed 1〜3
 */
import { Board, CpuPlayer, riseFramesPerRow, type CpuLevel } from "../../src/core";
import { avg, casualPlayer, fmt } from "./proxy";

const MAX = 60 * 60 * 15;

function play(kind: "casual" | CpuLevel, seed: number) {
  const b = new Board({ seed, speedLevel: 1, speedUp: true });
  const cpu = kind === "casual" ? casualPlayer(b) : new CpuPlayer(b, kind);
  const lvAt: Record<number, number> = {};
  for (let f = 0; f < MAX && !b.gameOver; f++) {
    b.tick(cpu.next());
    for (const e of b.events) if (e.type === "levelUp") lvAt[e.level] = f;
  }
  return { sec: b.frame / 60, level: b.level, manualRows: b.stats.manualRows, lvAt, dead: b.gameOver };
}

const seeds = Number(process.argv[2]) || 6;
console.log("せり上がり 1段の秒数: " + [1, 5, 10, 15, 20, 30, 40, 50, 70, 99].map((l) => `Lv${l}=${fmt(riseFramesPerRow(l) / 60)}s`).join(" "));
for (const kind of ["casual", "easy", "normal"] as const) {
  const rs = Array.from({ length: seeds }, (_, i) => play(kind, i + 1));
  const secs = rs.map((r) => r.sec);
  const at = (l: number): string => {
    const hit = rs.filter((r) => r.lvAt[l] !== undefined);
    return hit.length ? `${fmt(avg(hit.map((r) => r.lvAt[l] / 60)), 0)}s(${hit.length})` : "-";
  };
  console.log(
    `${kind}: 生存 平均${fmt(avg(secs), 0)}s 最短${fmt(Math.min(...secs), 0)} 最長${fmt(Math.max(...secs), 0)} 打ち切り${rs.filter((r) => !r.dead).length} | 到達Lv 平均${fmt(avg(rs.map((r) => r.level)), 0)} | Lv10到達 ${at(10)} Lv20 ${at(20)} Lv30 ${at(30)} Lv40 ${at(40)} | 手動せり上げ 平均${fmt(avg(rs.map((r) => r.manualRows)), 0)}段`,
  );
}
