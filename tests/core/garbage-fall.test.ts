import { describe, expect, it } from "vitest";
import { emptyBoard, run } from "./helpers";

/**
 * 報告された場面。おじゃまの下に積まれたパネルが、消去で落ちて着地し連鎖で揃う。
 * 原作ではおじゃまはパネルと一緒に落ちて着地するので、揃った瞬間に隣接していて変身する。
 *
 *   ###...   <- 3. 揃った 0 の真上にいるので変身するべき
 *   0.....
 *   0.....
 *   111...   <- 1. これが消えると
 *   023...
 *            2. 落ちた 0 が下の 0 と縦に揃う（連鎖）
 */
describe("おじゃまはパネルと一緒に落ちる", () => {
  it("下のパネルが落ちて着地し連鎖で揃うと、乗っていたおじゃまが変身する", () => {
    const b = emptyBoard();
    b.setColumns([[0, 1, 0, 0], [2, 1], [3, 1]]);
    b.placeGarbage(0, 4, 3, 1);
    const events = run(b, 300);
    const matches = events.filter((e) => e.type === "match");
    expect(matches.map((m) => (m.type === "match" ? m.chain : 0))).toEqual([1, 2]);
    expect(events.some((e) => e.type === "garbageTransform")).toBe(true);
    expect(b.garbage.size).toBe(0);
  });

  it("おじゃまは真下のパネルと同じフレームに落ち始め、同じフレームに着地する", () => {
    const b = emptyBoard();
    b.setColumns([[0, 1, 0, 0], [2, 1], [3, 1]]);
    const g = b.placeGarbage(0, 4, 3, 1);
    // 1 が消えたあと、0 が動き出すフレームとおじゃまが動き出すフレームが同じ
    let panelMoved = -1;
    let garbageMoved = -1;
    let panelLanded = -1;
    let garbageLanded = -1;
    for (let f = 1; f <= 300; f++) {
      b.tick();
      if (panelMoved < 0 && b.cell(0, 2).kind === 0 && b.cell(0, 3).kind !== 0) panelMoved = f;
      if (garbageMoved < 0 && g.y < 4) garbageMoved = f;
      for (const e of b.events) {
        if (e.type === "land" && panelLanded < 0) panelLanded = f;
        if (e.type === "garbageLand" && garbageLanded < 0) garbageLanded = f;
      }
      if (garbageLanded > 0) break;
    }
    expect(panelMoved).toBeGreaterThan(0);
    expect(garbageMoved).toBe(panelMoved);
    expect(garbageLanded).toBe(panelLanded);
  });
});
