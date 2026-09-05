import { describe, expect, it } from "vitest";
import { garbageFromChain, garbageFromCombo } from "../../src/core";

describe("おじゃまパネルの送り方", () => {
  it("同時消し n個 は厚さ1段・幅 n-1 の板", () => {
    expect(garbageFromCombo(3)).toEqual([]);
    expect(garbageFromCombo(4)).toEqual([{ width: 3, height: 1, type: "normal" }]);
    expect(garbageFromCombo(7)).toEqual([{ width: 6, height: 1, type: "normal" }]);
  });

  it("8個以上は複数の板に分離する（8=3+5、9=4+4、10=5+5、12=6+6）", () => {
    expect(garbageFromCombo(8).map((g) => g.width)).toEqual([3, 5]);
    expect(garbageFromCombo(9).map((g) => g.width)).toEqual([4, 4]);
    expect(garbageFromCombo(10).map((g) => g.width)).toEqual([5, 5]);
    expect(garbageFromCombo(12).map((g) => g.width)).toEqual([6, 6]);
  });

  it("n連鎖は幅6・厚さ n-1 の板。13連鎖の12段が上限", () => {
    expect(garbageFromChain(1)).toEqual([]);
    expect(garbageFromChain(2)).toEqual([{ width: 6, height: 1, type: "normal" }]);
    expect(garbageFromChain(5)[0].height).toBe(4);
    expect(garbageFromChain(13)[0].height).toBe(12);
    expect(garbageFromChain(20)[0].height).toBe(12);
  });
});
