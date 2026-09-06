import { describe, expect, it } from "vitest";
import { Board, NO_INPUT, garbageFromChain, garbageFromCombo } from "../../src/core";
import { run } from "./helpers";

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

/**
 * おじゃまの変身（原作の規則）。
 * 厚さ1段の板（同時消し・2連鎖）は、いくつ積み重なっていても1度の消去で全部が通常パネルになる。
 * 3連鎖以上の厚い板は1度の消去で最下段の1段だけが通常パネルになり、残りはおじゃまのまま。
 * 隣で消すたびに1段ずつ減る。変身の途中で全段が柄を見せてから上の段がおじゃまに戻るのも原作どおり。
 */
describe("おじゃまの変身", () => {
  function boardWithMatchReady(): Board {
    const b = new Board({ seed: 3, kinds: 5, initialHeight: 0, noRise: true });
    // 下段 0 0 1 0 2 3。(2,0) と (3,0) を入れ替えると 0 0 0 が揃い、その真上のおじゃまが変身する
    b.setColumns([[0], [0], [1], [0], [2], [3]]);
    return b;
  }
  function place(b: Board, x: number, y: number, w: number, h: number): void {
    (b as unknown as { placeGarbage: (x: number, y: number, w: number, h: number, t: "normal") => void }).placeGarbage(x, y, w, h, "normal");
  }
  function swapAndSettle(b: Board, x: number, y: number): void {
    b.cursor.x = x;
    b.cursor.y = y;
    b.tick({ ...NO_INPUT, swap: true });
    run(b, 900);
  }
  function garbageRows(b: Board): number {
    let n = 0;
    for (const g of b.garbage.values()) n += g.height;
    return n;
  }

  it("厚さ1段の板は、積み重なっていても1度の消去で全部が通常パネルになる", () => {
    const b = boardWithMatchReady();
    place(b, 0, 1, 3, 1);
    place(b, 2, 2, 4, 1);
    place(b, 0, 3, 5, 1);
    swapAndSettle(b, 2, 0);
    expect(b.garbage.size).toBe(0);
    expect(b.panelCount()).toBe(3 + 3 + 4 + 5);
  });

  it("厚い板は1度の消去で最下段の1段だけが通常パネルになり、残りはおじゃまのまま", () => {
    const b = boardWithMatchReady();
    place(b, 0, 1, 6, 3);
    swapAndSettle(b, 2, 0);
    expect(garbageRows(b)).toBe(2);
    expect(b.garbage.size).toBe(1);
    const g = [...b.garbage.values()][0];
    expect(g.state).toBe("idle");
  });

  it("残った厚い板は、隣でもう一度消すと次の1段が通常パネルになる", () => {
    const b = boardWithMatchReady();
    place(b, 0, 1, 6, 3);
    swapAndSettle(b, 2, 0);
    expect(garbageRows(b)).toBe(2);
    // 板の真下の行を 1 1 4 1 2 0 に置き換え、(2, y) を入れ替えて 1 1 1 を揃える
    const g = [...b.garbage.values()][0];
    const y = g.y - 1;
    [1, 1, 4, 1, 2, 0].forEach((k, x) => {
      b.cells[y][x].kind = k;
    });
    swapAndSettle(b, 2, y);
    expect(garbageRows(b)).toBe(1);
  });

  it("厚い板の上に乗った厚さ1段の板は、下の板と一緒に全部が通常パネルになる", () => {
    const b = boardWithMatchReady();
    place(b, 0, 1, 6, 2);
    place(b, 0, 3, 6, 1);
    swapAndSettle(b, 2, 0);
    // 厚い板は1段残り、上の薄い板は消える
    expect(garbageRows(b)).toBe(1);
    expect(b.garbage.size).toBe(1);
  });
});
