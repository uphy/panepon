import { COLS, ROWS } from "./constants";

export type GarbageType = "normal" | "shock";

/** 相手に送るおじゃまパネルの仕様。 */
export interface GarbageSpec {
  width: number;
  height: number;
  type: GarbageType;
}

/**
 * 同時消し n個 で送られる板の幅（厚さは1段）。
 * 4〜7個: 幅 n-1。8個以上は複数枚に分離する（合計 n 枚）。
 */
export function garbageFromCombo(panels: number): GarbageSpec[] {
  if (panels < 4) return [];
  if (panels <= 7) return [{ width: panels - 1, height: 1, type: "normal" }];
  const split: Record<number, number[]> = {
    8: [3, 5],
    9: [4, 4],
    10: [5, 5],
    11: [5, 6],
    12: [6, 6],
  };
  let widths = split[panels];
  if (!widths) {
    // 13個以降は計算式が変わる。幅6の板を並べ、端数（3以上）を1枚足す近似。
    widths = [];
    let rest = panels;
    while (rest >= COLS) {
      widths.push(COLS);
      rest -= COLS;
    }
    if (rest >= 3) widths.push(rest);
  }
  return widths.map((width) => ({ width, height: 1, type: "normal" }));
}

/**
 * ビックリパネルを n 個消したときに送られる灰色の板。幅6・厚さ1段の板が「n-2」枚、1枚ずつ分離して落ちる。
 * 3個消しでも送れるのがビックリパネルの意味。単独で消せる最大は7個なので最大5枚。
 */
export function garbageFromShock(panels: number): GarbageSpec[] {
  if (panels < 3) return [];
  const count = Math.min(5, panels - 2);
  const out: GarbageSpec[] = [];
  for (let i = 0; i < count; i++) out.push({ width: COLS, height: 1, type: "shock" });
  return out;
}

/** n連鎖で送られる板。幅6固定、厚さ n-1、上限12段。 */
export function garbageFromChain(chain: number): GarbageSpec[] {
  if (chain < 2) return [];
  return [{ width: COLS, height: Math.min(ROWS, chain - 1), type: "normal" }];
}
