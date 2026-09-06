import { describe, expect, it } from "vitest";
import { Board, CpuPlayer, type CpuLevel } from "../../src/core";
import { matches } from "./helpers";

/**
 * col0 の 0 0 0 が消えている最中に、(0,3) の 2 と (1,3) の 1 を入れ替えると、
 * 消えたあとに落ちる 1 が row 0 の 1 1 と並んで連鎖になる。今すぐ揃う手はない。
 */
function activeChainBoard(): Board {
  const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
  b.setColumns([
    [0, 0, 0, 2],
    [1, 3, 4, 1],
    [1],
  ]);
  b.cursor.x = 4;
  b.cursor.y = 8;
  return b;
}

function playUntilChain(level: CpuLevel, frames: number): { chains: number[]; board: Board } {
  const b = activeChainBoard();
  const cpu = new CpuPlayer(b, level);
  const chains: number[] = [];
  for (let f = 0; f < frames; f++) {
    b.tick(cpu.next());
    chains.push(...matches(b.events).map((m) => m.chain));
  }
  return { chains, board: b };
}

describe("CPU のアクティブ連鎖", () => {
  it("hard は消去中に次の連鎖を仕込んで2連鎖にする", () => {
    const { chains } = playUntilChain("hard", 400);
    // 仕込みが成功して2連鎖。その後は残りのパネルで別の消去を続けてよい
    expect(chains.slice(0, 2)).toEqual([1, 2]);
  });

  it("normal も間に合えば仕込む", () => {
    const { chains } = playUntilChain("normal", 400);
    expect(chains[0]).toBe(1);
    expect(chains).toContain(2);
  });

  it("easy は先読みしないので仕込まない", () => {
    const { chains } = playUntilChain("easy", 400);
    expect(chains[0]).toBe(1);
    expect(chains).not.toContain(2);
  });
});
